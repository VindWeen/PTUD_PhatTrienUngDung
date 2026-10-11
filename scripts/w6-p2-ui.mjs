// Optional W5-P3 hook. Only called after seed in that runner's isolated schema.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from '../frontend/node_modules/vite/dist/node/index.js';
import react from '../frontend/node_modules/@vitejs/plugin-react/dist/index.js';
import config from '../backend/src/config/env.js';
import tailwindConfig from '../frontend/tailwind.config.js';
const require = createRequire(import.meta.url);
const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));

export async function verifyRoleUi({ base }) {
  assert.ok(process.env.W6_PLAYWRIGHT_PATH, 'Set W6_PLAYWRIGHT_PATH to installed Playwright module');
  const { chromium } = require(process.env.W6_PLAYWRIGHT_PATH);
  const dir = 'output/w6-p2/ui';
  await fs.mkdir(dir, { recursive: true });
  // Create Council through the authorized Admin API; no shared DB grants or tokens in output.
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'duc.pm', password: 'demo1234' }) });
  assert.equal(login.status, 200);
  const token = (await login.json()).data.accessToken;
  async function admin(resource, data) {
    const r = await fetch(base + '/admin/' + resource, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    assert.ok(r.ok, `Admin ${resource}: ${r.status}`);
    return (await r.json()).data;
  }
  const council = await admin('users', { username: 'council.w6.demo', email: 'council-w6@example.invalid', displayName: 'W6 SYNTHETIC Council', password: 'W6-demo-only-1234' });
  const grant = { userId: Number(council.id), roleId: 4, validFrom: '2026-01-01T00:00:00Z', validTo: null };
  await admin('user-roles', grant);
  await admin('scopes', { ...grant, unitId: 1, includeDescendants: true });
  const vite = await createServer({ configFile: false, root: fileURLToPath(new URL('../frontend/', import.meta.url)), plugins: [react()],
    define: { 'import.meta.env.VITE_DATA_SOURCE': JSON.stringify('api'), 'import.meta.env.VITE_API_URL': JSON.stringify('/api/v1') },
    css: { postcss: { plugins: [frontendRequire('tailwindcss')({ ...tailwindConfig, content: [fileURLToPath(new URL('../frontend/index.html', import.meta.url)), fileURLToPath(new URL('../frontend/src/', import.meta.url)).replaceAll('\\', '/') + '**/*.{js,ts,jsx,tsx}'] }), frontendRequire('autoprefixer')()] } },
    server: { host: '127.0.0.1', port: 0, proxy: { '/api/v1': { target: base.replace('/api/v1', ''), changeOrigin: true, configure(proxy) { proxy.on('proxyReq', req => req.setHeader('origin', config.CORS_ORIGIN.split(',')[0].trim())); } } } },
  });
  let browser;
  let completed = false;
  const checks = [], errors = [];
  try {
    await vite.listen();
    const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    for (const [username, password, route, heading] of [
      ['an.nv', 'demo1234', '/achievements', 'Thành tích'],
      ['cuong.lh', 'demo1234', '/achievements', 'Thành tích'],
      ['bich.tt', 'demo1234', '/achievements', 'Thành tích'],
      ['duc.pm', 'demo1234', '/admin', 'Quản trị tài khoản'],
      ['records.demo', 'demo1234', '/awards', 'Nhập quyết định'],
      ['council.w6.demo', 'W6-demo-only-1234', '/award-applications', 'Hồ sơ đề nghị khen thưởng'],
    ]) {
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(60000);
      page.on('pageerror', e => errors.push(`${username}: ${e.message}`));
      await page.goto(origin + '/login');
      await page.getByPlaceholder('Tên đăng nhập hoặc email').fill(username);
      await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
      const authenticated = page.waitForResponse(r => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Sign In', exact: true }).click();
      const sessionToken = (await (await authenticated).json()).data.accessToken;
      await page.waitForURL(url => !url.pathname.includes('/login'));
      const listLoaded = route === '/achievements' ? page.waitForResponse(r => /\/api\/v1\/achievements\?/.test(r.url()) && r.request().method() === 'GET') : null;
      await page.goto(origin + route);
      await page.getByRole('heading', { name: new RegExp(heading) }).first().waitFor();
      if (listLoaded) {
        assert.equal((await listLoaded).status(), 200);
        await page.getByText('Đang tải danh sách thành tích...', { exact: true }).waitFor({ state: 'hidden' });
        assert.equal(await page.getByRole('alert').count(), 0);
      }
      if (username === 'duc.pm') {
        await page.getByRole('button', { name: 'Vai trò tài khoản', exact: true }).click();
        await page.getByRole('option', { name: 'COUNCIL', exact: true }).waitFor({ state: 'attached' });
      }
      if (username === 'records.demo' || username === 'council.w6.demo') {
        if (username === 'council.w6.demo') await page.getByLabel('Mã đơn vị xem hồ sơ').fill('1');
        else await page.getByLabel('Mã đơn vị lọc').fill('1');
        const loaded = page.waitForResponse(r => r.url().includes(username === 'records.demo' ? '/award-records?' : '/award-applications?') && r.request().method() === 'GET');
        await page.getByRole('button', { name: 'Tải danh sách', exact: true }).click();
        assert.equal((await loaded).status(), 200);
      }
      await page.screenshot({ path: `${dir}/${username}.png`, fullPage: true });
      if (username === 'an.nv') {
        const denied = await context.request.get(origin + '/api/v1/admin/users', { headers: { Authorization: `Bearer ${sessionToken}` } });
        assert.equal(denied.status(), 403, 'Backend rejects Lecturer admin access');
        await page.goto(origin + '/admin');
        await page.waitForURL('**/404');
        checks.push({ username, wrongRoleRoute: '404', wrongRoleAdminApi: 403 });
      }
      checks.push({ username, route, login: 'real browser/Express/Supabase', navigation: 'PASS' });
      await context.close();
    }
    assert.deepEqual(errors, []);
    completed = true;
    console.log('W6-P2 UI PASS: six real logins, role pages, scoped queues, wrong-role route');
  } finally {
    await fs.writeFile(`${dir}/result.json`, JSON.stringify({ status: completed ? 'PASS' : 'FAILED', checks, errors, scope: 'navigation smoke only; workflow transitions covered separately by API integration' }, null, 2));
    if (browser) await browser.close();
    await vite.close();
  }
}
