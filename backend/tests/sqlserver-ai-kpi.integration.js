import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { connectDB, closeDB, setPool } from '../src/config/database.js';
import * as regulations from '../src/modules/regulations/regulationRepository.js';
import * as kpi from '../src/modules/kpi/kpiService.js';
import * as kpiRepo from '../src/modules/kpi/kpiRepository.js';
import * as evaluations from '../src/modules/ai/evaluationRepository.js';
import { indexConfirmedChunks, retrieveRelevantChunks } from '../src/modules/ai/rag/ragRetrievalService.js';
import { saveExplanationRecord } from '../src/modules/ai/rag/ragExplanationService.js';

// Every fixture and service mutation uses one real SQL Server transaction; no live AI is called.
test('SQL Server: AI, KPI, regulations and RAG native integration (rolled back)', async (t) => {
  const nativePool = await connectDB();
  const client = await nativePool.connect();
  const code = `SQLTEST-${randomUUID().toUpperCase()}`;
  let document;
  try {
    await client.query('BEGIN');
    const fixtureUser = (await client.query(`INSERT INTO app.users(username,email,password_hash,display_name)
      OUTPUT INSERTED.user_id VALUES($1,$2,N'not-a-real-login',N'Giảng viên kiểm thử SQL Server')`, [code, code+'@example.test'])).rows[0];
    let role = (await client.query("SELECT role_id FROM app.roles WHERE code='LECTURER'")).rows[0];
    if (!role) role = (await client.query("INSERT INTO app.roles(code,name) OUTPUT INSERTED.role_id VALUES('LECTURER',N'Giảng viên')")).rows[0];
    await client.query("INSERT INTO app.user_roles(user_id,role_id,valid_from) VALUES($1,$2,CAST('2020-01-01' AS datetime2))", [fixtureUser.user_id,role.role_id]);
    const unit = (await client.query(`INSERT INTO app.organization_units(code,name,type) VALUES($1,N'Đơn vị kiểm thử','DEPARTMENT');
      SELECT unit_id FROM app.organization_units WHERE unit_id=SCOPE_IDENTITY()`, [code])).rows[0];
    const fixtureLecturer = (await client.query(`INSERT INTO app.lecturers(user_id,employee_code,full_name,email)
      OUTPUT INSERTED.lecturer_id,INSERTED.user_id VALUES($1,$2,N'Giảng viên kiểm thử',$3)`, [fixtureUser.user_id,code,code+'@example.test'])).rows[0];
    await client.query(`INSERT INTO app.lecturer_assignments(lecturer_id,unit_id,is_primary,valid_from,assigned_by)
      VALUES($1,$2,1,CAST('2020-01-01' AS datetime2),$3)`, [fixtureLecturer.lecturer_id,unit.unit_id,fixtureUser.user_id]);
    const lecturer = { ...fixtureLecturer, context_unit_id: unit.unit_id };
    const actor = Number(lecturer.user_id);
    // Service helpers open their own transactions. In this test only, their boundaries
    // are contained by the outer real transaction so their normal COMMIT cannot persist fixtures.
    const scopedClient = {
      query: (sql, params) => /^(BEGIN|COMMIT|ROLLBACK);?$/i.test(sql.trim())
        ? Promise.resolve({ rows: [], rowCount: 0 }) : client.query(sql, params),
      release: async () => {},
    };
    const facade = {
      ready: async () => facade,
      query: client.query.bind(client),
      connect: async () => scopedClient,
      end: async () => {},
    };
    setPool(facade);
    let version;
    let criterion;
    let goal;
    let run;

    await t.test('native parameter types, SQL NULL and date round-trip', async () => {
      const row = (await client.query(`SELECT CAST($1 AS bit) AS flag, CAST($2 AS bigint) AS entity_id,
        CAST($3 AS date) AS period_start, CAST($4 AS nvarchar(100)) AS optional_value,
        CAST($5 AS nvarchar(max)) AS payload`, [true, actor, '2026-10-01', null, { text: 'Tiếng Việt', ids: [1, 2] }])).rows[0];
      assert.equal(Boolean(row.flag), true);
      assert.equal(Number(row.entity_id), actor);
      assert.equal(row.period_start, '2026-10-01');
      assert.equal(row.optional_value, null);
      assert.deepEqual(row.payload, { text: 'Tiếng Việt', ids: [1, 2] });
    });

    await t.test('regulation CRUD, version dates, JSON aggregates and nullable ordering', async () => {
      document = await regulations.createDocument(client, {
        documentCode: code, title: 'Quy định kiểm thử SQL Server', documentType: 'GUIDELINE',
      });
      version = await regulations.createVersion(client, {
        documentId: document.document_id, versionNumber: 'SQLTEST-v1',
        sha256Hash: 'a'.repeat(64), effectiveFrom: '2026-10-01', signedDate: '2026-09-30',
        lhuApplicationStatus: 'CONFIRMED_LHU_POLICY',
      }, actor);
      assert.equal(version.effective_from_str, '2026-10-01');
      assert.equal(version.effective_to_str, null);
      version = await regulations.confirmVersion(client, version.version_id, {
        isConfirmed: true, lhuApplicationStatus: 'CONFIRMED_LHU_POLICY', confirmedBy: actor,
      });
      assert.equal(Boolean(version.is_confirmed), true);
      const docs = await regulations.listDocuments(client, { asOfDate: '2026-10-10', confirmedOnly: true });
      const found = docs.find(d => String(d.document_id) === String(document.document_id));
      assert.ok(Array.isArray(found.active_versions));
      assert.equal(found.active_versions[0].effectiveFrom, '2026-10-01');
      assert.equal(found.active_versions[0].effectiveTo, null);
      const detail = await regulations.findVersionById(client, version.version_id);
      assert.equal(detail.signed_date_str, '2026-09-30');
      const content = 'Khen thưởng giảng viên cần minh chứng thành tích chính xác, công khai và minh bạch.';
      for (const pageNo of [null, 1]) await regulations.createChunk(client, {
        versionId: version.version_id, articleNo: 'Điều 1', pageNo, content,
        chunkHash: createHash('sha256').update(`${pageNo}:${content}`).digest('hex'),
      });
      const chunks = await regulations.listChunksByVersionId(client, version.version_id);
      assert.deepEqual(chunks.map(c => c.page_no), [1, null]);
    });

    await t.test('criteria trigger revision, audit, confirmation invalidation and stale guard', async () => {
      const rules = { sourceType: 'ACHIEVEMENT', sourceTypeIds: [1], aggregation: 'COUNT' };
      criterion = await regulations.createCriteriaVersion(client, {
        versionId: version.version_id, criterionCode: 'SQLTEST-CRITERION', name: 'Tiêu chí thử nghiệm',
        targetType: 'INDIVIDUAL', minThreshold: 2, unitMetric: 'hồ sơ',
        legalReferences: 'Điều 1, quy định kiểm thử', sourceRules: rules, sourceRulesBy: actor,
      });
      assert.equal(Number(criterion.source_rules_revision), 1);
      assert.deepEqual(criterion.source_rules, rules);
      criterion = await regulations.confirmCriteriaVersion(client, criterion.criteria_version_id, {
        isConfirmed: true, confirmedBy: actor, expectedSourceRulesRevision: 1,
      });
      assert.equal(Boolean(criterion.is_confirmed), true);
      assert.equal(Number(criterion.source_rules_revision), 1);
      const changed = { ...rules, sourceTypeIds: [2] };
      criterion = await regulations.updateSourceRules(client, criterion.criteria_version_id, {
        sourceRules: changed, expectedRevision: 1,
      }, actor);
      assert.equal(Number(criterion.source_rules_revision), 2);
      assert.equal(Boolean(criterion.is_confirmed), false);
      assert.equal(criterion.confirmed_by, null);
      assert.equal(criterion.confirmed_at, null);
      const stale = await regulations.updateSourceRules(client, criterion.criteria_version_id, {
        sourceRules: rules, expectedRevision: 1,
      }, actor);
      assert.equal(stale, null);
      const unchanged = await regulations.updateSourceRules(client, criterion.criteria_version_id, {
        sourceRules: changed, expectedRevision: 2,
      }, actor);
      assert.equal(Number(unchanged.source_rules_revision), 2);
      const history = (await client.query('SELECT revision,previous_rules,source_rules FROM app.criteria_source_rule_history WHERE criteria_version_id=$1 ORDER BY revision', [criterion.criteria_version_id])).rows;
      assert.equal(history.length, 2);
      assert.deepEqual(history.map(h => Number(h.revision)), [1, 2]);
      assert.equal(history[0].previous_rules, null);
      const filtered = await regulations.listCriteriaVersions(client, { versionId: version.version_id, confirmedOnly: false, asOfDate: '2026-10-10', targetType: 'INDIVIDUAL' });
      assert.equal(filtered.length, 1);
    });

    await t.test('KPI service create, list nested JSON, update, accept, result CRUD and nullable duplicate matching', async () => {
      const user = { userId: actor };
      const payload = { subjectType: 'LECTURER', code, title: 'Mục tiêu SQL Server',
        measureUnit: 'hồ sơ', periodStart: '2026-10-01', periodEnd: '2026-12-31',
        target: 2, plan: 'Chuẩn bị hồ sơ minh chứng', sourceNote: 'Kiểm thử giao dịch' };
      goal = await kpi.create(user, payload);
      assert.equal(goal.period_start, '2026-10-01');
      assert.equal(goal.unit_id, null);
      const duplicate = await kpiRepo.findDuplicate(client, lecturer, payload);
      assert.equal(String(duplicate.goal_id), String(goal.goal_id));
      const wrongSubject = await kpiRepo.findDuplicate(client, { unit_id: lecturer.context_unit_id }, payload);
      assert.equal(wrongSubject, undefined);
      const { subjectType, ...updateFields } = payload;
      goal = await kpi.mutateGoal(user, goal.goal_id, 'update', { ...updateFields,
        version: Number(goal.version), title: 'Mục tiêu đã sửa' });
      assert.equal(goal.title, 'Mục tiêu đã sửa');
      goal = await kpi.mutateGoal(user, goal.goal_id, 'accept', { version: Number(goal.version) });
      assert.equal(goal.status, 'ACCEPTED');
      let result = await kpi.result(user, goal.goal_id, 'create', { actual: 1, sourceNote: 'Nguồn thử', evidenceNote: 'Minh chứng thử' });
      let listed = await kpi.list(user, {});
      const item = listed.items.find(g => String(g.goal_id) === String(goal.goal_id));
      assert.equal(Number(item.result.actual), 1);
      assert.equal(String(item.result.result_id), String(result.result_id));
      assert.equal(item.period_end, '2026-12-31');
      result = await kpi.result(user, goal.goal_id, 'update', { version: Number(result.version), actual: 2, sourceNote: 'Nguồn thử', evidenceNote: 'Minh chứng đủ' });
      assert.equal(Number(result.actual), 2);
      await kpi.result(user, goal.goal_id, 'delete', { version: Number(result.version) });
      listed = await kpi.list(user, {});
      assert.equal(listed.items.find(g => String(g.goal_id) === String(goal.goal_id)).result, null);
      const removable = await kpi.create(user, { ...payload, code: `${code}-DEL` });
      const removed = await kpi.mutateGoal(user, removable.goal_id, 'delete', { version: Number(removable.version) });
      assert.equal(String(removed.goal_id), String(removable.goal_id));
    });

    await t.test('AI evaluation persistence, criterion JSON, stale state and officer pagination CTE', async () => {
      run = await evaluations.saveEvaluationRun(client, {
        runId: randomUUID(), evaluationType: 'CRITERION_ASSESSMENT',
        targetSubject: { subjectType: 'LECTURER', subjectId: Number(lecturer.lecturer_id) },
        providerInfo: { provider: 'mock', model: 'sql-native-test', isMock: true },
        overallStatus: 'COMPLETED', overallConclusion: 'NEEDS_HUMAN_REVIEW',
        inputSnapshot: { fixture: code, criterion: { rules: criterion.source_rules } }, inputHash: 'b'.repeat(64),
        usageMetrics: {}, executedBy: actor,
      }, [{ criterionId: Number(criterion.criteria_version_id), criterionCode: criterion.criterion_code,
        criterionName: criterion.name, isConfirmedByLhu: false, isSimulation: true,
        thresholdMetric: { targetMin: 2, actualRecorded: 1, unitMetric: 'hồ sơ', isSatisfied: false },
        legalReferences: [{ documentCode: code, articleNo: 'Điều 1' }], aiAnalysis: 'Cần người rà soát', humanReviewRequired: true,
      }]);
      const loaded = await evaluations.getEvaluationRunById(client, run.run.run_id);
      assert.equal(loaded.inputSnapshot.fixture, code);
      assert.equal(loaded.criterionResults[0].legalReferences[0].documentCode, code);
      assert.equal(loaded.criterionResults[0].thresholdMetric.isSatisfied, false);
      assert.equal(loaded.criterionResults[0].consecutiveYears, null);
      assert.equal(Boolean((await evaluations.markRunStale(client, loaded.runId)).is_stale), true);
      const page = await evaluations.listEvaluationRuns(client, { subjectType: 'LECTURER',
        subjectId: Number(lecturer.lecturer_id), officerUserId: actor, limit: 10, offset: 0 });
      assert.ok(page.some(r => r.runId.toLowerCase() === loaded.runId.toLowerCase()));
      assert.deepEqual(await evaluations.listEvaluationRuns(client, { subjectId: Number(lecturer.lecturer_id), limit: 10, offset: 100000 }), []);
    });

    await t.test('RAG vector index upsert, date filters, retrieval and explanation JSON arrays', async () => {
      const indexed = await indexConfirmedChunks(client);
      assert.ok(indexed.indexedCount >= 2);
      const again = await indexConfirmedChunks(client);
      assert.equal(again.indexedCount, indexed.indexedCount);
      const embeddings = (await client.query('SELECT e.embedding_vector FROM app.regulation_chunk_embeddings e JOIN app.regulation_chunks c ON c.chunk_id=e.chunk_id WHERE c.version_id=$1', [version.version_id])).rows;
      assert.equal(embeddings.length, 2);
      assert.ok(embeddings.every(e => Array.isArray(e.embedding_vector) && e.embedding_vector.length === 128));
      const relevant = await retrieveRelevantChunks({ queryText: 'Khen thưởng giảng viên cần minh chứng thành tích chính xác',
        versionId: version.version_id, asOfDate: '2026-10-10', minSimilarity: 0, topK: 2 }, client);
      assert.equal(relevant.chunks.length, 2);
      const expired = await retrieveRelevantChunks({ queryText: 'khen thưởng', versionId: version.version_id, asOfDate: '2020-01-01' }, client);
      assert.equal(expired.isSufficient, false);
      const saved = await saveExplanationRecord(client, { runId: run.run.run_id,
        criterionId: Number(criterion.criteria_version_id), queryText: 'khen thưởng',
        retrievedChunkIds: relevant.chunks.map(c => c.chunkId), citations: [{ articleNo: 'Điều 1', documentCode: code }],
        explanationText: 'Bản ghi kiểm thử, chưa có đánh giá của AI trực tuyến.', model: 'local-test', provider: 'mock',
        promptVersion: 'test-v1', retrievalVersion: 'test-v1', isSufficientData: true,
      });
      assert.deepEqual(saved.retrieved_chunk_ids, relevant.chunks.map(c => c.chunkId));
      assert.equal(saved.citations[0].documentCode, code);
    });
  } finally {
    setPool(nativePool);
    await client.query('ROLLBACK');
    await client.release();
    if (document) {
      const count = (await nativePool.query('SELECT COUNT(*) AS count FROM app.regulation_documents WHERE document_code=$1', [code])).rows[0].count;
      assert.equal(Number(count), 0, 'Fixture rollback must leave no documents');
    }
    await closeDB();
  }
});
