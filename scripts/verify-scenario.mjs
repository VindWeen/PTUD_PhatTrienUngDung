/** HTTP smoke/integration checks against the SCN database, rolled back after testing. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Pool, getDbPoolConfig, setPool } from '../backend/src/config/database.js';
import { transactionPool } from '../database/scripts/seedScenario.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'output/scenario/manifest.json'), 'utf8'));
const pool = new Pool({ ...getDbPoolConfig(), max: 1, min: 0 });
const results = [], tokens = {}, newFiles = [];
let client, server, mockServer, storage, originalSave, baselineFingerprint, fingerprintSql, rolledBack = false;
const sourceEnv = { url: process.env.KPI_SOURCE_URL, token: process.env.KPI_SOURCE_TOKEN };
async function check(name, fn) { await fn(); results.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
async function listen(app) { const s = app.listen(0, '127.0.0.1'); await new Promise(resolve => s.once('listening', resolve)); return s; }
async function close(s) { if (s) { s.closeAllConnections(); await new Promise(resolve => s.close(resolve)); } }
let base;
async function request(route, user, method = 'GET', body, expected = 200) {
  const headers = user ? { Authorization: 'Bearer ' + tokens[user] } : {};
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const r = await fetch(base + route, { method, headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const raw = await r.text(); let json; try { json = JSON.parse(raw); } catch {}
  assert.equal(r.status, expected, `${method} ${route}: ${raw.slice(0, 400)}`);
  return json ? json.data : raw;
}
function form(file = 'evidence-demo.pdf', title = 'Minh chứng kiểm tra rollback') {
  const f = new FormData(); f.set('title', title); f.set('file', new Blob([fs.readFileSync(path.join(root, 'docs/testing/scenario/fixtures', file))], { type: 'application/pdf' }), file); return f;
}
const aId = key => manifest.achievements[key].id;
const pId = key => manifest.applications[key].id;
const rId = key => manifest.awards[key].id;
const councilId = manifest.accounts.find(u => u.username === 'council.demo').userId;
async function version(route, user) { return Number((await request(route, user)).version); }
try {
  client = await pool.connect();
  const tables = (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='app' AND table_type='BASE TABLE' ORDER BY table_name")).rows;
  fingerprintSql = tables.map(({ table_name: t }) => {
    if (!/^[a-z_]+$/.test(t)) throw new Error('Unexpected table identifier');
    return `SELECT '${t}' table_name,COUNT(*)::int n,md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text)::text,'[]')) fingerprint FROM app.${t} r`;
  }).join(' UNION ALL ');
  baselineFingerprint = (await client.query(fingerprintSql)).rows;
  await client.query('BEGIN');
  await client.query("SET LOCAL statement_timeout='30s'");
  setPool(transactionPool(client));
  storage = (await import('../backend/src/modules/evidences/storage/localStorageAdapter.js')).default;
  storage.baseDir = manifest.storageDirectory; originalSave = storage.saveFile.bind(storage);
  storage.saveFile = async (key, bytes) => { newFiles.push(storage.resolveSafePath(key)); return originalSave(key, bytes); };
  server = await listen((await import('../backend/src/app.js')).default);
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
  for (const user of ['an.nv','bich.tt','duc.pm','cuong.lh','records.demo','council.demo','council.other','linh.pharm','rep.expired']) {
    await check('Login ' + user, async () => { const data = await request('/auth/login', null, 'POST', { username: user, password: 'demo1234' }); assert.ok(data.accessToken); tokens[user] = data.accessToken; });
  }
  await check('Locked account and incorrect password rejected', async () => {
    await request('/auth/login', null, 'POST', { username: 'locked.demo', password: 'demo1234' }, 401);
    await request('/auth/login', null, 'POST', { username: 'an.nv', password: 'incorrect' }, 401);
  });
  await check('Baseline counts, snapshots, and file hashes', async () => {
    for (const [table, n] of [['achievements',12],['award_applications',8],['award_records',4],['kpi_goals',4]]) assert.equal((await client.query('SELECT COUNT(*)::int n FROM app.' + table)).rows[0].n, n);
    assert.equal((await client.query("SELECT COUNT(*)::int n FROM app.award_applications a LEFT JOIN app.award_application_inputs i USING(application_id) WHERE a.status<>'DRAFT' AND i.application_id IS NULL")).rows[0].n, 0);
    const rows = (await client.query('SELECT storage_key,sha256_hash,file_size FROM app.evidence_files UNION ALL SELECT storage_key,sha256_hash,file_size FROM app.award_decision_files')).rows;
    for (const f of rows) { const bytes = fs.readFileSync(storage.resolveSafePath(f.storage_key)); assert.equal(bytes.length, Number(f.file_size)); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), f.sha256_hash); }
  });
  await check('Admin cannot verify and manager cannot self approve', async () => {
    const a2 = '/achievements/' + aId('SCN-A02'), a9 = '/achievements/' + aId('SCN-A09');
    await request(a2 + '/verify', 'duc.pm', 'POST', { version: await version(a2, 'an.nv') }, 403);
    await request(a9 + '/verify', 'bich.tt', 'POST', { version: await version(a9, 'bich.tt') }, 403);
  });
  await check('Outside scope and expired representative denied', async () => {
    await request('/achievements/' + aId('SCN-A10'), 'bich.tt', 'GET', undefined, 403);
    const type = (await client.query("SELECT achievement_type_id FROM app.achievement_types WHERE code='RESEARCH_PATENT'")).rows[0];
    await request('/achievements', 'rep.expired', 'POST', { subjectType: 'UNIT', organizationUnitId: manifest.units.FIT_CS, achievementTypeId: Number(type.achievement_type_id), title: 'Kiểm tra đại diện hết hạn', recognitionYear: Number(manifest.date.slice(0,4)) }, 403);
  });
  await check('Unassigned council cannot conclude P04', async () => {
    const route = '/award-applications/' + pId('SCN-P04');
    const d = await request(route, 'council.other'); assert.equal(d.canReview, false);
    await request(route + '/recommend', 'council.other', 'POST', { version: Number(d.version), reason: 'Kiểm thử chưa được phân công' }, 403);
  });
  await check('Private evidence HTTP download matches hash', async () => {
    const f = (await client.query('SELECT evidence_file_id,sha256_hash FROM app.evidence_files ORDER BY evidence_file_id LIMIT 1')).rows[0];
    const route = '/evidence-files/' + f.evidence_file_id + '/download';
    await request(route, null, 'GET', undefined, 401); await request(route, 'linh.pharm', 'GET', undefined, 403);
    const response = await fetch(base + route, { headers: { Authorization: 'Bearer ' + tokens['an.nv'] } }); assert.equal(response.status, 200);
    assert.equal(crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), f.sha256_hash);
  });
  await check('Main achievement: missing file, correction, v2, verify, stale version', async () => {
    const route = '/achievements/' + aId('SCN-A01'); const initial = await version(route, 'an.nv');
    await request(route + '/submit', 'an.nv', 'POST', { version: initial }, 400);
    const ev = await request(route + '/evidences', 'an.nv', 'POST', form(), 201);
    await request(route, 'an.nv', 'PATCH', { version: initial, description: 'Đã kiểm thử sửa bản nháp.' });
    await request(route, 'an.nv', 'PATCH', { version: initial, description: 'Version cũ phải bị từ chối.' }, 409);
    await request(route + '/submit', 'an.nv', 'POST', { version: await version(route, 'an.nv') });
    await request(route + '/request-correction', 'bich.tt', 'POST', { version: await version(route, 'bich.tt'), reason: 'Bổ sung minh chứng phiên bản mới.' });
    await request('/evidences/' + ev.evidenceId + '/versions', 'an.nv', 'POST', form(), 201);
    await request(route + '/submit', 'an.nv', 'POST', { version: await version(route, 'an.nv') });
    const verified = await request(route + '/verify', 'bich.tt', 'POST', { version: await version(route, 'bich.tt') }); assert.equal(verified.status, 'VERIFIED');
    await request(route, 'an.nv', 'PATCH', { version: Number(verified.version), title: 'Không được sửa sau xác nhận' }, 409);
  });
  await check('Personal application: submit, forward, assign, comment, recommend', async () => {
    const awardType = (await client.query("SELECT award_type_id FROM app.award_types WHERE code='CSTĐ_CS'")).rows[0];
    const r = await request('/award-applications', 'an.nv', 'POST', { lecturerId: manifest.lecturers['an.nv'], cycleId: manifest.cycleId, targetAwardTypeId: Number(awardType.award_type_id), purpose: 'SCN-VERIFY | Hồ sơ kiểm tra rollback', achievementIds: [aId('SCN-A01')] }, 201);
    const route = '/award-applications/' + r.application_id;
    await request(route + '/submit', 'an.nv', 'POST', { version: Number(r.version) });
    await request(route + '/forward', 'bich.tt', 'POST', { version: await version(route, 'bich.tt'), reason: 'Đơn vị chuyển hồ sơ trong ca kiểm thử.' });
    await request(route + '/assign', 'council.demo', 'POST', { version: await version(route, 'council.demo'), reviewerId: councilId, reason: 'Phân công người xét trong ca kiểm thử.' });
    await request(route + '/comment', 'council.demo', 'POST', { version: await version(route, 'council.demo'), reason: 'Đã kiểm tra nguồn và minh chứng mô phỏng.' });
    const out = await request(route + '/recommend', 'council.demo', 'POST', { version: await version(route, 'council.demo'), reason: 'Đề nghị thưởng trong ca kiểm thử mô phỏng.' }); assert.equal(out.status, 'RECOMMENDED');
  });
  await check('Collective submission and council review', async () => {
    const route = '/achievements/' + aId('SCN-T01');
    await request(route + '/submit', 'cuong.lh', 'POST', { version: await version(route, 'cuong.lh') });
    await request(route + '/verify', 'bich.tt', 'POST', { version: await version(route, 'bich.tt') });
    const pRoute = '/award-applications/' + pId('SCN-PT01');
    await request(pRoute + '/assign', 'council.demo', 'POST', { version: await version(pRoute, 'council.demo'), reviewerId: councilId, reason: 'Phân công xét hồ sơ tập thể mô phỏng.' });
    const r = await request(pRoute + '/not-recommend', 'council.demo', 'POST', { version: await version(pRoute, 'council.demo'), reason: 'Không đề nghị trong ca kiểm thử tập thể.' }); assert.equal(r.status, 'NOT_RECOMMENDED');
  });
  await check('Application correction and resubmission', async () => {
    const route = '/award-applications/' + pId('SCN-P05');
    await request(route + '/resubmit', 'an.nv', 'POST', { version: await version(route, 'an.nv'), reason: 'Đã ghi chú bổ sung của chủ hồ sơ mô phỏng.' });
    const r = await request(route + '/forward', 'bich.tt', 'POST', { version: await version(route, 'bich.tt'), reason: 'Đơn vị chuyển lại hồ sơ bổ sung.' }); assert.equal(r.status, 'COUNCIL_PENDING');
  });
  await check('Award requires file, records, revokes, private decision download', async () => {
    const route = '/award-records/' + rId('SCN-R01'); const initial = await version(route, 'records.demo');
    await request(route + '/record', 'records.demo', 'POST', { version: initial }, 400);
    const upload = await request('/award-decisions/' + manifest.awards['SCN-R01'].decisionId + '/files', 'records.demo', 'POST', form('decision-demo.pdf'), 201);
    const out = await request(route + '/record', 'records.demo', 'POST', { version: initial }); assert.equal(out.status, 'RECORDED');
    const download = await fetch(base + '/award-decision-files/' + upload.decision_file_id + '/download', { headers: { Authorization: 'Bearer ' + tokens['records.demo'] } }); assert.equal(download.status, 200);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), fs.readFileSync(path.join(root, 'docs/testing/scenario/fixtures/decision-demo.pdf')));
    const revoked = await request(route + '/revoke', 'records.demo', 'POST', { version: Number(out.version), reason: 'Thu hồi mô phỏng trong lượt kiểm tra rollback.' }); assert.equal(revoked.status, 'REVOKED');
  });
  await check('KPI accepted result becomes only DRAFT achievement', async () => {
    const goal = manifest.kpi['SCN-K03'].id; const row = (await client.query('SELECT * FROM app.kpi_results WHERE goal_id=$1', [goal])).rows[0];
    const type = (await client.query("SELECT achievement_type_id FROM app.achievement_types WHERE code='RESEARCH_JOURNAL_Q1'")).rows[0];
    await request('/kpi/goals/' + goal + '/result/draft', 'an.nv', 'POST', { version: Number(row.version), achievementTypeId: Number(type.achievement_type_id) }, 201);
    const status = (await client.query('SELECT a.status FROM app.kpi_results r JOIN app.achievements a ON a.achievement_id=r.achievement_id WHERE goal_id=$1', [goal])).rows[0]; assert.equal(status.status, 'DRAFT');
  });
  await check('CSV preview, import, duplicates and invalid rows', async () => {
    const csv = fs.readFileSync(path.join(root, 'docs/testing/scenario/fixtures/kpi-valid.csv'), 'utf8');
    const preview = await request('/kpi/import/preview', 'an.nv', 'POST', { csv }); assert.ok(preview);
    await request('/kpi/import/commit', 'an.nv', 'POST', { csv });
    assert.equal((await client.query("SELECT COUNT(*)::int n FROM app.kpi_goals WHERE code LIKE 'SCN-CSV-%'")).rows[0].n, 2);
    const duplicate = await request('/kpi/import/commit', 'an.nv', 'POST', { csv }); assert.equal(duplicate.imported, 0); assert.equal(duplicate.duplicates, 2);
    const invalid = fs.readFileSync(path.join(root, 'docs/testing/scenario/fixtures/kpi-invalid.csv'), 'utf8');
    await request('/kpi/import/commit', 'an.nv', 'POST', { csv: invalid }, 400);
  });
  await check('Mock external KPI mapping, sync and duplicate detection', async () => {
    const { createMockSource } = await import('../backend/src/mock/kpiServer.js');
    const token = crypto.randomBytes(20).toString('hex'); mockServer = await listen(createMockSource({ token }));
    process.env.KPI_SOURCE_URL = `http://127.0.0.1:${mockServer.address().port}/kpi`; process.env.KPI_SOURCE_TOKEN = token;
    await request('/kpi/external/mappings', 'duc.pm', 'POST', { employeeId: 'SIM-EMP-001', lecturerId: manifest.lecturers['an.nv'] }, 201);
    await request('/kpi/external/runs', 'duc.pm', 'POST', {}, 201);
    await request('/kpi/external/runs', 'duc.pm', 'POST', {}, 201);
    assert.equal((await client.query('SELECT COUNT(*)::int n FROM app.external_kpi_records')).rows[0].n, 1);
    const owned = await request('/kpi/external', 'an.nv'); assert.equal(owned.records.length, 1);
    const other = await request('/kpi/external', 'linh.pharm'); assert.equal(other.records.length, 0);
  });
  await check('AI simulation gate, RAG index/retrieval and evaluation history', async () => {
    const run = await request('/ai/evaluations/' + manifest.ai['SCN-AI01'].runId, 'an.nv'); assert.equal(run.automaticAwardGranted, false);
    const choices = await request('/regulations/criteria', 'an.nv');
    assert.ok(choices.some(c => Number(c.criteria_version_id) === manifest.criterionId));
    assert.ok(!choices.some(c => Number(c.criteria_version_id) === manifest.unconfirmedCriterionId));
    const out = await request('/ai/evaluations/structured', 'an.nv', 'POST', { subjectType: 'LECTURER', subjectId: manifest.lecturers['an.nv'], criteriaVersionIds: [manifest.criterionId], provider: 'mock' }, 201); assert.equal(out.automaticAwardGranted, false); assert.ok(['NEEDS_HUMAN_REVIEW','SIMULATION_ONLY'].includes(out.overallConclusion));
    const draft = await request('/ai/evaluations/structured', 'an.nv', 'POST', { subjectType: 'LECTURER', subjectId: manifest.lecturers['an.nv'], criteriaVersionIds: [manifest.unconfirmedCriterionId], provider: 'mock' }, 201); assert.equal(draft.automaticAwardGranted, false); assert.equal(draft.criterionResults[0].thresholdMetric.isSatisfied, 'UNCONFIRMED');
    await request('/ai/rag/index-chunks', 'duc.pm', 'POST', {});
    await request('/ai/rag/retrieve', 'an.nv', 'POST', { queryText: 'nguyên tắc khen thưởng', minSimilarity: 0, topK: 5 });
  });
  await check('Reports, CSV scope and notifications', async () => {
    const data = await request('/reports?contextUnitId=' + manifest.units.FIT_SE, 'bich.tt'); assert.ok(Number(data.total) > 0);
    const csv = await request('/reports/export.csv?contextUnitId=' + manifest.units.FIT_SE, 'bich.tt'); assert.ok(csv.includes('SCN-'));
    await request('/reports/export.csv', 'an.nv', 'GET', undefined, 403);
    await request('/notifications', 'an.nv'); await request('/dashboard/summary', 'an.nv');
  });
} catch (e) { results.push({ name: 'Verification stopped', status: 'FAIL', message: e.message }); console.error(e.message); process.exitCode = 1; }
finally {
  await close(server); await close(mockServer);
  if (client) {
    await client.query('ROLLBACK');
    try { assert.deepEqual((await client.query(fingerprintSql)).rows, baselineFingerprint); rolledBack = true;
      results.push({ name: 'All app table contents unchanged after verification rollback', status: 'PASS' });
    } catch (e) { process.exitCode = 1; results.push({ name: 'Rollback fingerprint', status: 'FAIL', message: e.message }); }
    client.release();
  }
  if (storage && originalSave) storage.saveFile = originalSave;
  for (const file of newFiles) if (file.startsWith(manifest.storageDirectory + path.sep) && fs.existsSync(file)) fs.unlinkSync(file);
  if (sourceEnv.url === undefined) delete process.env.KPI_SOURCE_URL; else process.env.KPI_SOURCE_URL = sourceEnv.url;
  if (sourceEnv.token === undefined) delete process.env.KPI_SOURCE_TOKEN; else process.env.KPI_SOURCE_TOKEN = sourceEnv.token;
  setPool(null); await pool.end();
  const report = { checkedAt: new Date().toISOString(), target: 'app SCN via temporary loopback HTTP server', rolledBack, tests: results,
    notRun: ['Browser UI interaction', 'Real external KPI integration', 'Live AI provider / confirmed-policy KPI recommendation', 'Restore into an isolated schema'] };
  fs.mkdirSync(path.join(root, 'output/scenario'), { recursive: true }); fs.writeFileSync(path.join(root, 'output/scenario/verification.json'), JSON.stringify(report, null, 2));
  console.log(results.filter(r => r.status === 'PASS').length + ' checks passed; test mutations rolled back.');
}
