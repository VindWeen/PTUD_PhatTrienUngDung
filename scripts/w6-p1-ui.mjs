// Real browser -> Vite proxy -> Express -> isolated Supabase schema.
// Called inside W3-P1's transaction; all data and authentication writes roll back.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import bcrypt from '../backend/node_modules/bcryptjs/index.js';
import { createServer } from '../frontend/node_modules/vite/dist/node/index.js';
import react from '../frontend/node_modules/@vitejs/plugin-react/dist/index.js';
import config from '../backend/src/config/env.js';
import tailwindConfig from '../frontend/tailwind.config.js';
const require = createRequire(import.meta.url);
const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));
export async function verifyFinalUi({ base, exec }) {
  const { chromium } = require(process.env.W6_PLAYWRIGHT_PATH || 'playwright');
  const dir = 'output/w6-p1/ui';
  await fs.mkdir(dir, { recursive: true });
  const password = 'W6-local-test-only';
  await exec("UPDATE app.users SET password_hash=$1,display_name='W6 SYNTHETIC / Supabase integration' WHERE user_id IN (1,2)", [await bcrypt.hash(password, 10)]);
  await exec("UPDATE app.lecturers SET full_name='W6 SYNTHETIC subject ' || lecturer_id");
  const vite = await createServer({
    configFile: false, root: fileURLToPath(new URL('../frontend/', import.meta.url)), plugins: [react()],
    css: { postcss: { plugins: [frontendRequire('tailwindcss')({ ...tailwindConfig, content: [fileURLToPath(new URL('../frontend/index.html', import.meta.url)), fileURLToPath(new URL('../frontend/src/', import.meta.url)).replaceAll('\\', '/') + '**/*.{js,ts,jsx,tsx}'] }), frontendRequire('autoprefixer')()] } },
    server: { host: '127.0.0.1', port: 0, proxy: { '/api/v1': {
      target: base.replace('/api/v1', ''), changeOrigin: true,
      configure(proxy) { proxy.on('proxyReq', req => req.setHeader('origin', config.CORS_ORIGIN.split(',')[0].trim())); },
    } } },
  });
  let browser;
  try {
    await vite.listen();
    const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const context = await browser.newContext({ acceptDownloads: true });
    const login = await context.request.post(origin + '/api/v1/auth/login', { data: { username: 'bich.tt', password } });
    assert.equal(login.status(), 200, 'Real Express login');
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', async d => { errors.push('Unexpected dialog: ' + d.message()); await d.dismiss(); });
    const checks = [];
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin + '/reports');
      await page.getByText('Cùng năm', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `report overflow ${width}`);
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Xuất Báo Cáo CSV' }).click();
      const download = await downloadPromise;
      const csv = await fs.readFile(await download.path(), 'utf8');
      assert.ok(csv.includes('Cùng năm') && csv.includes('is_valid'));
      await page.screenshot({ path: `${dir}/reports-${width}.png`, fullPage: true });
      checks.push({ width, page: 'reports', overflow: false, csvDownload: 'PASS' });
    }
    await context.close();
    const lecturer = await browser.newContext({ acceptDownloads: true });
    const response = await lecturer.request.post(origin + '/api/v1/auth/login', { data: { username: 'an.nv', password } });
    assert.equal(response.status(), 200);
    const token = (await response.json()).data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };
    async function api(path, data) {
      const r = await lecturer.request.post(origin + '/api/v1/kpi' + path, { headers, data });
      assert.ok(r.ok(), `KPI ${path}: ${r.status()}`);
      return (await r.json()).data;
    }
    const goal = await api('/goals', { subjectType: 'LECTURER', code: 'W6-ZERO', title: 'W6 SYNTHETIC zero progress', measureUnit: 'bài', periodStart: '2026-01-01', periodEnd: '2026-12-31', target: 2, sourceNote: 'MÔ PHỎNG / synthetic integration', plan: 'Kiểm thử cuối W6-P1' });
    await api(`/goals/${goal.goal_id}/accept`, { version: goal.version });
    await api(`/goals/${goal.goal_id}/result`, { actual: 0, sourceNote: 'MÔ PHỎNG', evidenceNote: 'Synthetic only' });
    const kpi = await lecturer.newPage();
    kpi.on('pageerror', e => errors.push(e.message));
    kpi.on('dialog', async d => { errors.push('Unexpected dialog: ' + d.message()); await d.dismiss(); });
    for (const width of [390, 768, 1440]) {
      await kpi.setViewportSize({ width, height: 900 });
      await kpi.goto(origin + '/kpi');
      const bar = kpi.getByRole('progressbar', { name: 'Mức độ hoàn thành W6 SYNTHETIC zero progress' });
      await bar.waitFor({ state: 'attached' });
      assert.equal(await bar.getAttribute('aria-valuenow'), '0');
      assert.equal(await bar.evaluate(el => el.style.width), '0%');
      await kpi.getByRole('button', { name: 'Tải nguồn và nhật ký' }).click();
      await kpi.getByText('Loại thành tích để tạo nháp', { exact: false }).waitFor();
      assert.equal(await kpi.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `KPI overflow ${width}`);
      const pending = kpi.waitForEvent('download');
      await kpi.getByRole('button', { name: 'Tải file mẫu CSV' }).click();
      assert.ok((await fs.readFile(await (await pending).path(), 'utf8')).includes('sourceNote'));
      await kpi.getByPlaceholder('Dữ liệu CSV hiển thị tại đây...').fill('code,title,measureUnit,periodStart,periodEnd,target,plan,sourceNote,actual,evidenceNote\r\nW6-CSV,W6 SYNTHETIC CSV,bai,2026-01-01,2026-12-31,2,Ke hoach,MO PHONG,,\r\n');
      await kpi.getByRole('button', { name: 'Kiểm tra dữ liệu trước' }).click();
      const ready = kpi.getByText('READY_GOAL', { exact: true });
      await ready.waitFor();
      assert.ok((await ready.getAttribute('class')).includes('text-emerald-700'));
      await kpi.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Xác nhận import vào hệ thống') && !b.disabled));
      await kpi.screenshot({ path: `${dir}/kpi-${width}.png`, fullPage: true });
      checks.push({ width, page: 'kpi', zeroProgress: 'PASS', simulationLabel: true, sourceApi: 'PASS', templateDownload: 'PASS', overflow: false });
    }
    await kpi.route('**/api/v1/kpi/template.csv', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'SYNTHETIC_FAILURE', message: 'W6 SYNTHETIC template unavailable' } }) }));
    await kpi.getByRole('button', { name: 'Tải file mẫu CSV' }).click();
    await kpi.getByRole('alert').filter({ hasText: 'W6 SYNTHETIC template unavailable' }).waitFor();
    await kpi.unroute('**/api/v1/kpi/template.csv');
    await kpi.getByRole('button', { name: 'Kê khai nháp', exact: true }).click();
    await kpi.locator('select[required]').selectOption('1');
    await kpi.getByRole('button', { name: 'Xác nhận tạo kê khai DRAFT' }).click();
    const source = kpi.getByRole('link', { name: /Đã tạo hồ sơ nháp/ });
    await source.waitFor();
    assert.equal(await source.getAttribute('href'), '/achievements');
    const catalogResponse = kpi.waitForResponse(r => r.url().endsWith('/api/v1/achievements/catalogs'));
    await source.click();
    const catalog = await catalogResponse;
    assert.equal(catalog.status(), 200);
    assert.ok((await catalog.json()).data.length > 0);
    await kpi.getByText('W6 SYNTHETIC zero progress', { exact: true }).waitFor();
    assert.ok(kpi.url().endsWith('/achievements'));
    checks.push({ sourceDraftLink: 'PASS', templateFailure: 'PASS (only negative response simulated)' });
    assert.deepEqual(errors, []);
    await fs.writeFile(`${dir}/result.json`, JSON.stringify({ task: 'W6-P1', integration: 'real Express/pg/Supabase; isolated synthetic data; rollback', checks, errors }, null, 2));
    console.log('W6-P1 UI PASS: real login, reports CSV, KPI zero, source, template; 390/768/1440px');
  } finally {
    if (browser) await browser.close();
    await vite.close();
  }
}
