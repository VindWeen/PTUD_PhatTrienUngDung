// Called only by W5-P3 after real migrate/seed in its randomly named test schema.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from '../frontend/node_modules/vite/dist/node/index.js';
import react from '../frontend/node_modules/@vitejs/plugin-react/dist/index.js';
import config from '../backend/src/config/env.js';
import tailwindConfig from '../frontend/tailwind.config.js';
import { startScreenRecording } from './w6-p3-recorder.mjs';
const require = createRequire(import.meta.url);
const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function samplePdf() {
  const text = 'BT /F1 16 Tf 60 750 Td (W6-P3 SYNTHETIC DEMO - NO REAL AWARD) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${text.length} >>\nstream\n${text}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((o, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const start = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(pdf);
}

export async function recordDemo({ base, query }) {
  assert.ok(process.env.W6_PLAYWRIGHT_PATH, 'Set W6_PLAYWRIGHT_PATH');
  const { chromium } = require(process.env.W6_PLAYWRIGHT_PATH);
  const dir = path.resolve('output/w6-p3');
  await fs.mkdir(path.join(dir, 'images'), { recursive: true });
  const baselineCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const sourceFiles = ['scripts/w6-p3-video.mjs', 'scripts/w6-p3-recorder.mjs', 'backend/tests/w5-p3.integration.js', 'frontend/src/services/awardsApi.js', 'frontend/src/pages/AwardApplications.jsx', 'frontend/src/pages/Awards.jsx', 'frontend/src/pages/Achievements.jsx'];
  const sourceHashes = await Promise.all(sourceFiles.map(async p => ({ path: p, sha256: hash(await fs.readFile(p)) })));
  const report = { task: 'W6-P3', baselineCommit, sourceState: 'HEAD plus uncommitted W6-P3 capture harness and decision multipart upload fix; source hashes below', sourceHashes, integration: 'real browser/Vite/Express/pg/Supabase; synthetic isolated schema; no fixture responses', steps: [], assertions: [], status: 'FAILED', ai: 'NOT_RUN; no source/criteria approval or award inference', restore: 'BLOCKED per W6-P2 evidence at 2774075; not part of this recording' };
  const pdf = samplePdf();
  await fs.writeFile(path.join(dir, 'synthetic-demo.pdf'), pdf);
  const tokens = {};
  const calls = [];
  async function api(username, method, route, body, expected = 200) {
    const started = Date.now();
    const r = await fetch(base + route, { method, headers: { Authorization: `Bearer ${tokens[username]}`, ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) }, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) });
    calls.push({ roleAccount: username, method, route, status: r.status, durationMs: Date.now() - started });
    assert.equal(r.status, expected, `${username} ${method} ${route}`);
    return (await r.json()).data;
  }
  for (const username of ['an.nv', 'bich.tt', 'cuong.lh', 'records.demo', 'duc.pm']) {
    const r = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: 'demo1234' }) });
    assert.equal(r.status, 200); tokens[username] = (await r.json()).data.accessToken;
  }
  const council = await api('duc.pm', 'POST', '/admin/users', { username: 'council.video', email: 'council-video@example.invalid', displayName: 'W6-P3 SYNTHETIC Council', password: 'W6-demo-only-1234' });
  const grant = { userId: Number(council.id), roleId: 4, validFrom: '2026-01-01T00:00:00Z', validTo: null };
  await api('duc.pm', 'POST', '/admin/user-roles', grant);
  await api('duc.pm', 'POST', '/admin/scopes', { ...grant, unitId: 1, includeDescendants: true });
  const vite = await createServer({ configFile: false, root: fileURLToPath(new URL('../frontend/', import.meta.url)), plugins: [react()],
    define: { 'import.meta.env.VITE_DATA_SOURCE': JSON.stringify('api'), 'import.meta.env.VITE_API_URL': JSON.stringify('/api/v1') },
    css: { postcss: { plugins: [frontendRequire('tailwindcss')({ ...tailwindConfig, content: [fileURLToPath(new URL('../frontend/index.html', import.meta.url)), fileURLToPath(new URL('../frontend/src/', import.meta.url)).replaceAll('\\', '/') + '**/*.{js,ts,jsx,tsx}'] }), frontendRequire('autoprefixer')()] } },
    server: { host: '127.0.0.1', port: 0, proxy: { '/api/v1': { target: base.replace('/api/v1', ''), changeOrigin: true, configure(proxy) { proxy.on('proxyReq', req => req.setHeader('origin', config.CORS_ORIGIN.split(',')[0].trim())); } } } },
  });
  let browser, context, recorder, page;
  try {
    await vite.listen();
    const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true, channel: 'msedge', args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
    context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce', acceptDownloads: true });
    page = await context.newPage(); page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', async d => { errors.push('Unexpected dialog'); await d.dismiss(); });
    await context.addInitScript(({ sha }) => {
      const add = () => {
        const banner = document.createElement('div'); banner.id = 'w6-caption';
        banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;padding:10px 20px;background:#09283f;color:white;font:16px Arial;pointer-events:none;min-height:55px';
        banner.textContent = `W6-P3 · API/Supabase THẬT · DỮ LIỆU MÔ PHỎNG · SHA ${sha.slice(0, 12)} + W6-P3 diff chưa commit`;
        document.body.appendChild(banner);
      };
      if (document.body) add(); else document.addEventListener('DOMContentLoaded', add, { once: true });
    }, { sha: baselineCommit });
    await page.goto(origin + '/login');
    recorder = await startScreenRecording(browser, page, path.join(dir, 'demo.webm'));
    async function caption(id, text, image = false) {
      report.steps.push({ id, atSeconds: Number(recorder.elapsed().toFixed(3)), text });
      await page.evaluate(({ text, sha }) => { document.getElementById('w6-caption').textContent = `W6-P3 · THẬT Express/pg/Supabase · MÔ PHỎNG · ${sha.slice(0, 12)}\n${text}`; }, { text, sha: baselineCommit });
      await page.waitForTimeout(1800); // Deliberate reading time in the recorded demo.
      if (image) await page.screenshot({ path: path.join(dir, 'images', id + '.png') });
    }
    async function login(username, route) {
      await page.waitForLoadState('networkidle');
      await context.clearCookies(); await page.goto(origin + '/login');
      await page.getByPlaceholder('Tên đăng nhập hoặc email').fill(username);
      await page.getByLabel('Mật khẩu', { exact: true }).fill(username === 'council.video' ? 'W6-demo-only-1234' : 'demo1234');
      const response = page.waitForResponse(r => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Sign In', exact: true }).click();
      const r = await response; assert.equal(r.status(), 200); tokens[username] = (await r.json()).data.accessToken;
      await page.waitForURL(url => url.pathname !== '/login');
      await page.waitForLoadState('networkidle');
      if (new URL(page.url()).pathname !== route) await page.locator(`a[href="${route}"]:visible`).first().click();
      await page.getByRole('heading').first().waitFor();
    }
    async function achievements() {
      const loaded = page.waitForResponse(r => /\/api\/v1\/achievements\?/.test(r.url()) && r.request().method() === 'GET');
      if (new URL(page.url()).pathname === '/achievements') await page.getByTitle('Làm mới', { exact: true }).click();
      else await page.locator('a[href="/achievements"]:visible').first().click();
      assert.ok([200, 304].includes((await loaded).status()));
      await page.getByText('Đang tải danh sách thành tích...', { exact: true }).waitFor({ state: 'hidden' });
    }
    async function createAchievement(username, collective = false) {
      await caption(collective ? 'collective-api' : 'individual-api', `${username}: gọi API thật để kê khai, upload PDF và nộp; đây là thao tác HTTP, không giả lập nút UI.`);
      const a = await api(username, 'POST', '/achievements', { ...(collective ? { subjectType: 'UNIT', organizationUnitId: 2, achievementTypeId: 2 } : { lecturerId: 1, achievementTypeId: 1 }), title: collective ? 'W6-P3 MÔ PHỎNG tập thể' : 'W6-P3 MÔ PHỎNG cá nhân', description: 'Synthetic rehearsal only; not an actual LHU achievement', recognitionYear: 2026 }, 201);
      const form = new FormData(); form.append('title', 'W6-P3 MÔ PHỎNG minh chứng'); form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'synthetic-demo.pdf');
      await api(username, 'POST', `/achievements/${a.achievementId}/evidences`, form, 201);
      await api(username, 'POST', `/achievements/${a.achievementId}/submit`, { version: 1 });
      await achievements();
      await caption(collective ? 'collective-submitted' : 'individual-submitted', `${username}: API 201/200, hồ sơ #${a.achievementId} SUBMITTED. Dữ liệu/file tổng hợp trong schema riêng.`, true);
      return a.achievementId;
    }
    async function clickMutation(button, suffix, expected = 200) {
      const received = page.waitForResponse(r => r.url().endsWith(suffix) && r.request().method() === 'POST');
      await page.getByRole('button', { name: button, exact: true }).click();
      const r = await received; assert.equal(r.status(), expected, suffix);
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Tải danh sách' && !b.disabled));
      return (await r.json()).data;
    }
    async function queueApplication(id) {
      await page.getByLabel('Mã đơn vị xem hồ sơ').fill('2');
      const loaded = page.waitForResponse(r => r.url().includes('/award-applications?') && r.request().method() === 'GET');
      await page.getByRole('button', { name: 'Tải danh sách', exact: true }).click();
      assert.equal((await loaded).status(), 200);
      await page.getByRole('button', { name: new RegExp(`^#${id} —`) }).click();
      await page.getByRole('heading', { name: new RegExp(`Đề nghị #${id}`) }).waitFor();
    }

    await caption('intro', 'Kịch bản tích hợp thật; sáu vai trò. Xác nhận ≠ đề nghị ≠ ghi nhận. Không chạy AI hoặc tự trao thưởng.', true);
    await login('duc.pm', '/admin');
    await page.getByRole('button', { name: 'Vai trò tài khoản', exact: true }).click();
    await page.getByRole('option', { name: 'COUNCIL', exact: true }).waitFor({ state: 'attached' });
    await caption('admin', `Admin API đã tạo Council demo #${council.id}, cấp COUNCIL + scope. Chỉ trong schema kiểm thử, không sửa app chung.`, true);
    await login('an.nv', '/achievements');
    const individual = await createAchievement('an.nv');
    await api('an.nv', 'GET', '/admin/users', null, 403);
    await page.evaluate(() => { history.pushState({}, '', '/admin'); window.dispatchEvent(new PopStateEvent('popstate')); });
    await page.waitForURL('**/404');
    await caption('wrong-role', 'Giảng viên truy cập quản trị: backend 403, UI /404. Không có thao tác quản trị được ghi.', true);
    await login('cuong.lh', '/achievements');
    const collective = await createAchievement('cuong.lh', true);
    await login('bich.tt', '/achievements');
    for (const id of [individual, collective]) await api('bich.tt', 'POST', `/achievements/${id}/verify`, { version: 2 });
    await achievements();
    await caption('verified', 'Manager: API xác nhận hai hồ sơ → VERIFIED. Đây là xác nhận thành tích, chưa là khen thưởng.', true);
    await page.locator('a[href="/reports"]:visible').first().click(); await page.getByRole('button', { name: 'Xuất Báo Cáo CSV', exact: true }).waitFor();
    const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Xuất Báo Cáo CSV', exact: true }).click();
    const csv = await downloaded; await csv.saveAs(path.join(dir, 'reports-synthetic.csv'));
    await caption('reports', 'Báo cáo/CSV API thật theo quyền Manager; dữ liệu MÔ PHỎNG, không tuyên bố p95 đã đạt.', true);
    await login('records.demo', '/award-applications');
    for (const [label, value] of [['Mã kỳ', 'W6-P3-VIDEO'], ['Tên kỳ', 'W6-P3 MÔ PHỎNG'], ['Bắt đầu', '2026-01-01'], ['Kết thúc', '2027-12-31']]) await page.getByLabel(label, { exact: true }).fill(value);
    const cycle = await clickMutation('Mở kỳ', '/award-cycles', 201);
    await caption('cycle', `RecordsOfficer mở kỳ #${cycle.award_period_id} qua nút UI/API 201.`, true);
    await login('an.nv', '/award-applications');
    for (const [label, value] of [['Mã giảng viên / đơn vị', '1'], ['Mã mục tiêu khen thưởng', '1'], ['Mục đích đề nghị', 'W6-P3 MÔ PHỎNG đề nghị cá nhân'], ['Mã thành tích VERIFIED, phân cách dấu phẩy', String(individual)]]) await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByLabel('Kỳ đề nghị').selectOption(String(cycle.award_period_id));
    const proposal = await clickMutation('Tạo hồ sơ nháp', '/award-applications', 201);
    await page.getByRole('heading', { name: new RegExp(`Đề nghị #${proposal.application_id}`) }).waitFor();
    await clickMutation('Nộp và đóng băng input', `/${proposal.application_id}/submit`);
    await page.getByRole('heading', { name: /SUBMITTED/ }).waitFor();
    await caption('proposal-submitted', `Cá nhân nộp đề nghị #${proposal.application_id} bằng UI. Input đã đóng băng; không tạo quyết định.`, true);
    await login('bich.tt', '/award-applications'); await queueApplication(proposal.application_id);
    await page.getByLabel('Ý kiến đơn vị', { exact: true }).fill('MÔ PHỎNG: đơn vị chuyển hồ sơ đúng phạm vi');
    await clickMutation('Chuyển Hội đồng', `/${proposal.application_id}/forward`);
    await page.getByRole('heading', { name: /COUNCIL_PENDING/ }).waitFor();
    await caption('forward', 'Manager chuyển đề nghị → COUNCIL_PENDING bằng UI. Quyền/trạng thái do backend kiểm.', true);
    await login('council.video', '/award-applications'); await queueApplication(proposal.application_id);
    const countsBefore = (await query('SELECT (SELECT COUNT(*)::int FROM app.award_records) records, (SELECT COUNT(*)::int FROM app.award_decisions) decisions')).rows[0];
    await page.getByLabel('Ý kiến hoặc nội dung bổ sung', { exact: true }).fill('MÔ PHỎNG: phân công người xét, không tự xét');
    await page.getByLabel('Mã người xét', { exact: true }).fill(String(council.id));
    await clickMutation('Phân công', `/${proposal.application_id}/assign`);
    await page.getByRole('heading', { name: /UNDER_REVIEW/ }).waitFor();
    await api('council.video', 'POST', `/award-applications/${proposal.application_id}/comment`, { version: 3, reason: 'MÔ PHỎNG phiên cũ thử xung đột' }, 409);
    await caption('occ', 'Council đã phân công → UNDER_REVIEW. Request phiên cũ v3 bị backend trả 409; không ghi ý kiến cũ.', true);
    await page.getByLabel('Ý kiến hoặc nội dung bổ sung', { exact: true }).fill('MÔ PHỎNG: ý kiến đã đọc snapshot, không dùng AI');
    await clickMutation('Ghi ý kiến', `/${proposal.application_id}/comment`);
    await page.getByLabel('Ý kiến hoặc nội dung bổ sung', { exact: true }).fill('MÔ PHỎNG kết luận đề nghị; không ban hành quyết định');
    await clickMutation('Đề nghị khen thưởng', `/${proposal.application_id}/recommend`);
    await page.getByRole('heading', { name: /RECOMMENDED/ }).waitFor();
    const countsAfter = (await query('SELECT (SELECT COUNT(*)::int FROM app.award_records) records, (SELECT COUNT(*)::int FROM app.award_decisions) decisions')).rows[0];
    assert.deepEqual(countsAfter, countsBefore);
    report.assertions.push({ gate: 'Council does not create award record or decision', before: countsBefore, after: countsAfter, status: 'PASS' });
    await caption('recommended', 'RECOMMENDED chỉ là kết luận đề nghị. DB kiểm: số quyết định/bản ghi khen thưởng không tăng.', true);
    await login('records.demo', '/awards');
    for (const [label, value] of [['Mã giảng viên / đơn vị', '1'], ['Mã loại khen thưởng', '1'], ['Năm ghi nhận', '2026'], ['Số quyết định', 'W6-P3-SYNTHETIC'], ['Ngày quyết định', '2026-10-09'], ['Cơ quan ban hành', 'MÔ PHỎNG - không có giá trị pháp lý'], ['Tên quyết định', 'W6-P3 MÔ PHỎNG quyết định demo'], ['Mã thành tích tùy chọn, ngăn bằng dấu phẩy', String(individual)]]) await page.getByLabel(label, { exact: true }).fill(value);
    const award = await clickMutation('Tạo bản nháp', '/award-records', 201);
    await page.getByRole('heading', { name: new RegExp(`Bản ghi #${award.record_id}`) }).waitFor();
    await api('records.demo', 'POST', `/award-records/${award.record_id}/record`, { version: 1 }, 400);
    await caption('missing-file', 'Nháp khen thưởng chưa có file quyết định: API ghi nhận bị chặn 400. Quyết định/file trong video đều MÔ PHỎNG.', true);
    await page.getByLabel('File quyết định', { exact: true }).setInputFiles(path.join(dir, 'synthetic-demo.pdf'));
    const multipart = page.waitForRequest(r => r.url().endsWith(`/${award.decision_id}/files`) && r.method() === 'POST');
    await clickMutation('Tải file quyết định', `/${award.decision_id}/files`, 201);
    assert.match((await multipart).headers()['content-type'], /^multipart\/form-data;.*boundary=/i);
    report.assertions.push({ gate: 'UI decision upload is multipart with browser-generated boundary', status: 'PASS' });
    await clickMutation('Ghi nhận RECORDED', `/${award.record_id}/record`);
    await page.getByRole('heading', { name: /RECORDED/ }).waitFor();
    const decisionDownload = page.waitForEvent('download'); await page.getByRole('button', { name: /^Tải synthetic-demo.pdf/ }).click();
    const file = await decisionDownload; const bytes = await fs.readFile(await file.path()); assert.equal(hash(bytes), hash(pdf));
    report.assertions.push({ gate: 'Decision private download SHA256/size', sha256: hash(bytes), bytes: bytes.length, status: 'PASS' });
    await caption('recorded', 'RecordsOfficer: UI upload quyết định/file → RECORDED; tải private đúng SHA256/size. Không phải AI trao thưởng.', true);
    await caption('release-gates', 'Release dự kiến 28/10/2026: restore verified_by còn BLOCKED (bằng chứng W6-P2). Chưa có Quang ký review W6-P2/video. Không tự chốt PASS.', true);
    assert.deepEqual(errors, []);
    report.status = 'PASS';
    report.browserErrors = errors;
    console.log('W6-P3 VIDEO PASS: real six-role workflow, UI application/council/record, API achievements/403/409/400, decision SHA256');
  } finally {
    report.apiCalls = calls; report.finishedAt = new Date().toISOString();
    if (recorder) report.recording = await recorder.stop();
    if (context) await context.close();
    if (browser) await browser.close();
    await vite.close();
    await fs.writeFile(path.join(dir, 'recording-result.json'), JSON.stringify(report, null, 2));
  }
}
