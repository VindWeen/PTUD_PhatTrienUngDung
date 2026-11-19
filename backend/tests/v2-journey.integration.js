import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import http from 'node:http';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { discardSource } from '../src/modules/regulationSources.js';
import app from '../src/app.js';
import { Pool, getDbPoolConfig, setPool } from '../src/config/database.js';
import { discardFile } from '../src/modules/files.js';

// Historical, deliberately partial pathway; see docs/testing/V2_JOURNEY.md.
const SOURCE = 'https://youth.ueh.edu.vn/wp-content/uploads/2025/09/DE-AN-SV5T-UEH-NAM-2025-1.pdf';
const ELIGIBLE = { category: 'SOCIAL_PRACTICAL_SKILL', completed: true, reputable_provider: true, live_interaction: true, participation_checked: true };
const rule = {
  type: 'count', target: 2, comparator: 'gte', measure_unit: 'khóa học',
  from: '2024-11-01', to: '2025-11-01',
  filters: Object.entries(ELIGIBLE).map(([key, value]) => ({ field: `attributes.${key}`, operator: 'eq', value })),
};

test('V2 journey: sourced UEH 2025 skills pathway → missing → KPI → completed course → MET → selected public CV', async (t) => {
  const native = new Pool(getDbPoolConfig());
  const client = await native.connect();
  await client.query('BEGIN');
  const query = (sql, params) => /^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)
    ? Promise.resolve({ rows: [], rowCount: 0 }) : client.query(sql, params);
  setPool({ query, connect: async () => ({ query, release: async () => {} }) });
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const tag = randomUUID(), files = [], sourceFiles=[], owner = {}, outsider = {};
  let version, first, second, excluded, gapRun, goal, task, cv;
  async function call(path, { method = 'GET', data, form, session = owner, expected = 200, raw = false } = {}) {
    const headers = {};
    if (session.token) headers.Authorization = `Bearer ${session.token}`;
    if (data) headers['Content-Type'] = 'application/json';
    const response = await fetch(base + path, { method, headers, body: form || (data ? JSON.stringify(data) : undefined), signal: AbortSignal.timeout(15000) });
    if (raw) { assert.equal(response.status, expected); return response; }
    const payload = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(payload)}`);
    if (payload.data?.accessToken) session.token = payload.data.accessToken;
    return payload.data;
  }
  function evidencePdf(){const content='BT /F1 16 Tf 30 120 Td (DU LIEU DEMO - fictional training evidence) Tj ET';const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${content.length} >>\nstream\n${content}\nendstream`];let pdf='%PDF-1.4\n',offsets=[0];for(const [i,o] of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(pdf);}
  async function upload(item, filename) {
    const form = new FormData();
    form.append('file', new Blob([evidencePdf()], { type: 'application/pdf' }), filename);
    const file = await call(`/achievements/${item.id}/evidences`, { method: 'POST', form, expected: 201 });
    files.push((await client.query('SELECT storage_key FROM app.evidence_files WHERE id=$1', [file.id])).rows[0].storage_key);
    const downloaded = await call(`/evidence-files/${file.id}/download`, { raw: true });
    assert.match(await downloaded.text(), /DU LIEU DEMO/);
    await call(`/evidence-files/${file.id}/download`, { session: outsider, expected: 403 });
  }
  try {
    await t.test('register two users and publish one accurately scoped sourced pathway', async () => {
      const account = await call('/auth/register', { method: 'POST', data: { email: `journey-${tag}@example.test`, password: 'Journey-Password-42', fullName: 'Sinh viên kiểm thử', personType: 'STUDENT' }, expected: 201 });
      owner.id = account.user.userId;
      await call('/auth/register', { method: 'POST', session: outsider, data: { email: `journey-other-${tag}@example.test`, password: 'Journey-Password-42', fullName: 'Người ngoài' }, expected: 201 });
      await client.query("INSERT app.global_role_grants(user_id,role_code) VALUES($1,'REGULATION_MANAGER')", [owner.id]);
      const doc = await call('/regulations/documents', { method: 'POST', data: { code: `UEH25-SKILL-${tag}`, name: 'Kiểm thử nhánh 5.2 kỹ năng UEH 2025 — không phải toàn bộ SV5T', description: 'Một nhánh độc lập phục vụ kiểm thử, chỉ đối chiếu dữ liệu tự khai.' }, expected: 201 });
      version = await call(`/regulations/documents/${doc.id}/versions`, { method: 'POST', data: { version_label: '2025-subcriterion-test', effective_from: '2025-03-14', effective_to: '2025-11-01', source_title: 'Quyết định 25/QĐ-ĐHKT-HSV ngày 14/03/2025 — nhánh I.5.2 và Phụ lục IV/V', source_url: SOURCE, applicability: { person_types: ['STUDENT'] } }, expected: 201 });
      await call(`/regulations/versions/${version.id}/criteria`, { method: 'POST', data: { code: 'I-5-2-SKILLS-PATH', title: 'Nhánh hoàn thành hai khóa kỹ năng thực hành xã hội', source_reference: 'I.5.2 (trang 5), Phụ lục IV (trang 10), V (trang 11), kỳ hồ sơ IV (trang 7)', rule }, expected: 201 });
      const originalSource=await fs.readFile(new URL('../../database/sqlserver/sources/ueh-sv5t-2025.pdf',import.meta.url));
      const sourceForm=new FormData();sourceForm.append('file',new Blob([originalSource],{type:'application/pdf'}),'ueh-sv5t-2025.pdf');sourceForm.append('sourceUrl',SOURCE);sourceForm.append('issuingAuthority','Ban Thư ký Hội Sinh viên Việt Nam UEH');
      const sourceFile=await call(`/regulations/versions/${version.id}/source`,{method:'POST',form:sourceForm,expected:201});
      sourceFiles.push((await client.query('SELECT storage_key FROM app.regulation_source_files WHERE id=$1',[sourceFile.id])).rows[0].storage_key);
      assert.equal(sourceFile.sha256,createHash('sha256').update(originalSource).digest('hex'));
      await call(`/regulations/versions/${version.id}/source/download`,{session:outsider,expected:403});
      const extracted=await call(`/regulations/versions/${version.id}/source/extract`,{method:'POST'});assert.match(extracted.extractedText,/25\/QĐ|5\.2/);
      await call(`/regulations/versions/${version.id}/source/review`,{method:'POST',data:{confirmed:true}});
      const published = await call(`/regulations/versions/${version.id}/publish`, { method: 'POST' });
      assert.equal(published.publication_status, 'PUBLISHED');
      assert.equal(published.source_url, SOURCE);
    });
    await t.test('upload one qualifying achievement; unrelated and out-of-window courses do not fill the gap', async () => {
      first = await call('/achievements', { method: 'POST', data: { title: 'Hoàn thành khóa giao tiếp trực tiếp — dữ liệu kiểm thử', achievedAt: '2025-03-15', attributes: ELIGIBLE }, expected: 201 });
      await upload(first, 'giao-tiep.pdf');
      excluded = await call('/achievements', { method: 'POST', data: { title: 'Khóa lập trình chuyên môn — không thuộc kỹ năng mềm', achievedAt: '2025-04-15', attributes: { ...ELIGIBLE, category: 'HARD_SKILL' } }, expected: 201 });
      await call('/achievements', { method: 'POST', data: { title: 'Khóa ngoài kỳ hồ sơ', achievedAt: '2021-01-01', attributes: ELIGIBLE }, expected: 201 });
      gapRun = await call('/ai/evaluations/structured', { method: 'POST', data: { regulation_version_id: version.id, evaluation_date: '2025-11-01' }, expected: 201 });
      assert.equal(gapRun.conclusion, 'NOT_MET');
      assert.equal(gapRun.stale, false);
      assert.equal(Number(gapRun.results[0].actual_value), 1);
      assert.equal(Number(gapRun.results[0].target_value), 2);
      assert.equal(gapRun.results[0].missing_details.remaining, 1);
    });
    await t.test('create owned KPI from the stored gap, plan a task and record progress', async () => {
      goal = await call('/kpi/from-ai-gap', { method: 'POST', data: { source_result_id: gapRun.results[0].id, title: 'Hoàn thành thêm một khóa kỹ năng mềm', start_date: '2025-08-01', due_date: '2025-11-01' }, expected: 201 });
      assert.equal(Number(goal.owner_user_id), Number(owner.id));
      assert.equal(Number(goal.target_value), 1);
      assert.equal(goal.source_result_id, gapRun.results[0].id);
      await call(`/kpi/goals/${goal.id}`, { session: outsider, expected: 404 });
      await call('/kpi/from-ai-gap', { method: 'POST', data: { source_result_id: gapRun.results[0].id }, session: outsider, expected: 404 });
      task = await call(`/kpi/goals/${goal.id}/tasks`, { method: 'POST', data: { title: 'Đăng ký, tham dự và hoàn thành khóa làm việc nhóm', due_date: '2025-10-31' }, expected: 201 });
      const started = await call(`/kpi/goals/${goal.id}`, { method: 'PATCH', data: { status: 'IN_PROGRESS' } });
      assert.equal(started.status, 'IN_PROGRESS');
      const initial = await call(`/kpi/goals/${goal.id}/progress`, { method: 'POST', data: { current_value: 0, note: 'Đã đăng ký, chưa hoàn thành.' } });
      assert.equal(initial.current_value, 0);
    });
    await t.test('add actual completion, link achievement, complete task and record KPI progress', async () => {
      second = await call('/achievements', { method: 'POST', data: { title: 'Hoàn thành khóa làm việc nhóm — dữ liệu kiểm thử', achievedAt: '2025-10-20', attributes: ELIGIBLE }, expected: 201 });
      await upload(second, 'lam-viec-nhom.pdf');
      const linked = await call(`/kpi/goals/${goal.id}/achievements`, { method: 'POST', data: { achievement_id: second.id, contribution_value: 1 }, expected: 201 });
      assert.equal(linked.achievements.length, 1);
      const done = await call(`/kpi/goals/${goal.id}/tasks/${task.id}`, { method: 'PATCH', data: { status: 'DONE' } });
      assert.equal(done.status, 'DONE');
      const progress = await call(`/kpi/goals/${goal.id}/progress`, { method: 'POST', data: { current_value: 1, note: 'Hoàn thành khóa học và lưu chứng nhận.' } });
      assert.equal(progress.current_value, 1);
      assert.equal(progress.completion_percent, 100);
      await call(`/kpi/goals/${goal.id}`, { method: 'PATCH', data: { status: 'COMPLETED' } });
    });
    await t.test('old assessment is immutable and stale; fresh assessment reaches MET', async () => {
      const old = await call(`/ai/evaluations/structured/${gapRun.id}`);
      assert.equal(old.stale, true);
      assert.equal(old.conclusion, 'NOT_MET');
      assert.equal(Number(old.results[0].actual_value), 1);
      await call('/kpi/from-ai-gap', { method: 'POST', data: { source_result_id: gapRun.results[0].id }, expected: 400 });
      const fresh = await call('/ai/evaluations/structured', { method: 'POST', data: { regulation_version_id: version.id, evaluation_date: '2025-11-01' }, expected: 201 });
      assert.equal(fresh.conclusion, 'MET');
      assert.equal(fresh.stale, false);
      assert.equal(Number(fresh.results[0].actual_value), 2);
      assert.equal(fresh.results[0].missing_details.remaining, 0);
      assert.match(fresh.explanation, /không phải quyết định công nhận/);
      const matched = (await client.query('SELECT achievement_id FROM app.result_evidence WHERE criterion_result_id=$1 ORDER BY achievement_id', [fresh.results[0].id])).rows.map(x => Number(x.achievement_id));
      assert.deepEqual(matched, [Number(first.id), Number(second.id)].sort((a, b) => a - b));
    });
    await t.test('public CV includes only explicitly selected achievements and hides contacts/files', async () => {
      cv = await call('/me/cv', { method: 'PUT', data: { slug: '', templateId: 'Academic', isPublic: true, headline: 'Hồ sơ kỹ năng cá nhân', selectedAchievementIds: [first.id, second.id] } });
      const publicCv = await call(`/public/cv/${cv.slug}`, { session: {} });
      assert.deepEqual(publicCv.achievements.map(x => Number(x.id)).sort((a, b) => a - b), [Number(first.id), Number(second.id)].sort((a, b) => a - b));
      assert.ok(!publicCv.achievements.some(x => Number(x.id) === Number(excluded.id)));
      assert.equal(publicCv.contact.email, '');
      assert.equal(publicCv.contact.phone, '');
      assert.ok(!JSON.stringify(publicCv).includes('storage_key'));
      await call('/me/cv', { method: 'PUT', data: { templateId: 'Academic', isPublic: false, selectedAchievementIds: [first.id, second.id] } });
      await call(`/public/cv/${cv.slug}`, { session: {}, expected: 404 });
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    setPool(null);
    await client.release();
    await native.end();
    for (const key of files) await discardFile(key);
    for (const key of sourceFiles) await discardSource(key);
  }
});
