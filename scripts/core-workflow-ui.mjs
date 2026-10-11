// Functional browser check; invoked only inside W3-Q1's rollback-only synthetic schema.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { createServer } from '../frontend/node_modules/vite/dist/node/index.js';
import react from '../frontend/node_modules/@vitejs/plugin-react/dist/index.js';
import config from '../backend/src/config/env.js';
import tailwindConfig from '../frontend/tailwind.config.js';
const require = createRequire(import.meta.url);
const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));

export async function verifyCoreWorkflowUi({ base }) {
  assert.ok(process.env.W6_PLAYWRIGHT_PATH, 'Set W6_PLAYWRIGHT_PATH to bundled Playwright');
  const { chromium } = require(process.env.W6_PLAYWRIGHT_PATH);
  const vite = await createServer({
    configFile: false, root: fileURLToPath(new URL('../frontend', import.meta.url)),
    plugins: [react()], define: { 'import.meta.env.VITE_DATA_SOURCE': JSON.stringify('api'), 'import.meta.env.VITE_API_URL': JSON.stringify('/api/v1') },
    css: { postcss: { plugins: [frontendRequire('tailwindcss')({ ...tailwindConfig, content: [fileURLToPath(new URL('../frontend/index.html', import.meta.url)), fileURLToPath(new URL('../frontend/src/', import.meta.url)).replaceAll('\\', '/') + '**/*.{js,ts,jsx,tsx}'] }), frontendRequire('autoprefixer')()] } },
    server: { host: '127.0.0.1', port: 0, proxy: { '/api/v1': { target: base.replace('/api/v1', ''), changeOrigin: true, configure(proxy) { proxy.on('proxyReq', req => req.setHeader('origin', config.CORS_ORIGIN.split(',')[0].trim())); } } } },
  });
  let browser;
  const errors = [];
  try {
    await vite.listen();
    const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const login = async username => {
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(45000);
      page.on('pageerror', e => errors.push(e.message));
      page.on('dialog', dialog => dialog.accept());
      await page.goto(origin + '/login');
      await page.getByPlaceholder('Tên đăng nhập hoặc email').fill(username);
      await page.getByLabel('Mật khẩu', { exact: true }).fill('demo1234');
      await page.getByRole('button', { name: 'Sign In', exact: true }).click();
      await page.waitForURL(url => !url.pathname.includes('/login'));
      await page.goto(origin + '/achievements');
      return page;
    };
    const owner = await login('an.nv');
    const title = `Core workflow browser ${Date.now()}`;
    const waitApi = (page, method, ending) => page.waitForResponse(r => r.request().method() === method && r.url().endsWith(ending));
    await owner.getByRole('button', { name: 'Kê khai Thành tích', exact: true }).click();
    await owner.getByPlaceholder('Ví dụ: Ứng dụng Deep Learning trong phân tích dữ liệu lớn...').fill(title);
    const created = waitApi(owner, 'POST', '/achievements');
    await owner.getByRole('button', { name: 'Lưu bản nháp', exact: true }).click();
    const creation = await created;
    assert.equal(creation.status(), 201);
    const id = (await creation.json()).data.achievementId;
    await owner.getByRole('button', { name: 'Thêm minh chứng', exact: true }).waitFor();
    assert.equal(await owner.getByRole('button', { name: 'Nộp duyệt hồ sơ', exact: true }).isDisabled(), true);
    await owner.getByRole('button', { name: 'Thêm minh chứng', exact: true }).click();
    await owner.getByPlaceholder('VD: Hợp đồng NCKH số 45/HĐ-KHCN').fill('Minh chứng trình duyệt');
    const proof = Buffer.from('%PDF-1.4\nSYNTHETIC CORE BROWSER V1\n%%EOF');
    await owner.locator('input[type=file]').first().setInputFiles({ name: 'proof.pdf', mimeType: 'application/pdf', buffer: proof });
    const uploaded = waitApi(owner, 'POST', `/achievements/${id}/evidences`);
    await owner.getByRole('button', { name: 'Tải lên minh chứng', exact: true }).click();
    assert.equal((await uploaded).status(), 201, 'browser multipart upload');
    await owner.getByRole('button', { name: 'Tải về', exact: true }).waitFor();
    const downloading = owner.waitForEvent('download');
    await owner.getByRole('button', { name: 'Tải về', exact: true }).click();
    assert.deepEqual(await fs.readFile(await (await downloading).path()), proof);
    const action = async (page, method, ending, button, note) => {
      await button.click();
      if (note) await page.locator('textarea').last().fill(note);
      const response = waitApi(page, method, ending);
      await page.getByRole('button', { name: 'Xác nhận thực hiện', exact: true }).click();
      assert.equal((await response).status(), 200);
      await page.getByRole('button', { name: 'Xác nhận thực hiện', exact: true }).waitFor({ state: 'hidden' });
    };
    await action(owner, 'POST', `/achievements/${id}/submit`, owner.getByRole('button', { name: 'Nộp duyệt hồ sơ', exact: true }));
    const manager = await login('bich.tt');
    const row = page => page.locator('tr').filter({ hasText: title });
    await action(manager, 'POST', `/achievements/${id}/request-correction`, row(manager).getByTitle('Yêu cầu bổ sung (NEED_CORRECTION)'), 'Bổ sung trang phụ lục minh chứng');
    await owner.reload();
    await row(owner).getByTitle('Xem chi tiết', { exact: true }).click();
    await owner.getByRole('button', { name: 'Gửi lại hồ sơ', exact: true }).waitFor();
    const replacement = waitApi(owner, 'POST', '/versions');
    await owner.getByTitle('Thay tệp mới (tăng phiên bản)').locator('input').setInputFiles({ name: 'proof-v2.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nSYNTHETIC CORE BROWSER V2\n%%EOF') });
    assert.equal((await replacement).status(), 201);
    await owner.getByText('proof-v2.pdf', { exact: false }).waitFor();
    await action(owner, 'POST', `/achievements/${id}/submit`, owner.getByRole('button', { name: 'Gửi lại hồ sơ', exact: true }));
    await owner.getByRole('button', { name: 'Lần nộp & Snapshot (2)', exact: true }).click();
    await owner.getByText('Lần nộp #1', { exact: true }).waitFor();
    await owner.getByText('Lần nộp #2', { exact: true }).waitFor();
    await manager.reload();
    await action(manager, 'POST', `/achievements/${id}/verify`, row(manager).getByTitle('Xác nhận / Phê duyệt (VERIFY)'));
    await owner.reload();
    await row(owner).getByTitle('Xem chi tiết', { exact: true }).click();
    await owner.getByText('Minh chứng số & Phiên bản tệp', { exact: false }).waitFor();
    assert.equal(await owner.getByRole('button', { name: 'Thêm minh chứng', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log('CORE UI PASS: create, multipart upload, private download bytes, correction, replace file, resubmit, two snapshots, manager verification, locked files');
  } finally {
    if (browser) await browser.close();
    await vite.close();
  }
}
