import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from '../frontend/node_modules/vite/dist/node/index.js';
import react from '../frontend/node_modules/@vitejs/plugin-react/dist/index.js';
import tailwindConfig from '../frontend/tailwind.config.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.W6_PLAYWRIGHT_PATH || 'C:/Users/fw622/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = fileURLToPath(new URL('../frontend', import.meta.url));
const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));
const vite = await createServer({ root, configFile: false, plugins: [react()], define: { 'import.meta.env.VITE_DATA_SOURCE': JSON.stringify('api'), 'import.meta.env.VITE_API_URL': JSON.stringify('/api/v1') }, css: { postcss: { plugins: [frontendRequire('tailwindcss')({ ...tailwindConfig, content: [`${root.replaceAll('\\', '/')}/src/**/*.{js,jsx}`, `${root}/index.html`] }), frontendRequire('autoprefixer')()] } }, server: { host: '127.0.0.1', port: 0 } });
let browser;
let version = 0, draft, published = null;
let publicId = '0123456789abcdef0123456789abcdef';
const originalPublicId = publicId;
const profile = { fullName: 'Nguyễn Văn An', email: 'an@example.test', phone: '0123456789', workHistory: [{ assignmentId: 1, unitName: 'Khoa CNTT', period: '2020 – Hiện tại' }] };
const initial = { version: 0, template: 'classic', headline: '', summary: '', showEmail: false, showPhone: false, workHistoryIds: [], achievementIds: [], experiences: [] };
try {
  await vite.listen();
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.context().route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); const path = url.pathname.replace('/api/v1', '');
    let data = [];
    if (path === '/auth/refresh') data = { accessToken: 'test' };
    else if (path === '/auth/me') data = { userId: 1, displayName: profile.fullName, roles: ['LECTURER'] };
    else if (path === '/me/cv' && route.request().method() === 'GET') data = { profile, achievements: [{ achievementId: 2, title: 'Bài báo thử', recognitionYear: 2026 }], draft: draft || initial, isPublished: !!published, publicId: version ? publicId : null };
    else if (path === '/me/cv' && route.request().method() === 'PUT') { draft = route.request().postDataJSON(); draft.version = ++version; data = { version, publicId }; }
    else if (path === '/me/cv/publish') { assert.equal(route.request().postDataJSON().version, version); published = { ...draft, fullName: profile.fullName, email: draft.showEmail ? profile.email : null, phone: draft.showPhone ? profile.phone : null, workHistory: [], achievements: [] }; data = { version: ++version, publicId }; }
    else if (path === '/me/cv/unpublish') { published = null; data = { version: ++version }; }
    else if (path === '/me/cv/rotate-link') { assert.equal(route.request().postDataJSON().version, version); publicId = 'fedcba9876543210fedcba9876543210'; data = { version: ++version, publicId }; }
    else if (path === `/cv/${originalPublicId}` && publicId !== originalPublicId) return route.fulfill({ status: 404, json: { success: false } });
    else if (path === `/cv/${publicId}`) { if (!published) return route.fulfill({ status: 404, json: { success: false } }); data = published; }
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto(`${origin}/me/cv`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (process.env.CV_UI_SCREENSHOT) await page.screenshot({ path: process.env.CV_UI_SCREENSHOT, fullPage: true });
  await page.getByLabel('Chức danh hoặc lĩnh vực').fill('Giảng viên thử');
  await page.getByLabel(/Hiển thị email/).check();
  await page.getByLabel('Lĩnh vực chuyên môn').fill('Kỹ thuật phần mềm');
  await page.getByRole('button', { name: 'Thêm học vấn' }).click();
  await page.getByLabel('Bằng cấp / chuyên ngành').fill('Thạc sĩ CNTT');
  await page.getByLabel('Cơ sở đào tạo').fill('Đại học Lạc Hồng');
  const [preview] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Xem trước trong tab mới' }).click()]);
  await preview.getByRole('heading', { name: 'Nguyễn Văn An' }).waitFor();
  await preview.getByText('Thạc sĩ CNTT').waitFor();
  await preview.getByText('Kỹ thuật phần mềm').waitFor();
  assert.equal(version, 0, 'preview must not save or publish the draft');
  await page.getByRole('button', { name: 'Công khai CV', exact: true }).click();
  await page.getByText('Đã công khai CV. Ai có đường dẫn đều có thể xem.').waitFor();
  assert.equal(draft.showEmail, true); assert.equal(draft.showPhone, false);
  const link = page.getByRole('link', { name: new RegExp(`/cv/${publicId}`) });
  assert.ok(await link.count());
  const publicPage = await page.context().newPage();
  await publicPage.goto(`${origin}/cv/${publicId}`, { waitUntil: 'domcontentloaded' });
  try { await publicPage.getByText('Giảng viên thử').waitFor({ timeout: 12000 }); } catch (error) { console.error('Public page:', await publicPage.locator('body').innerText()); throw error; }
  await publicPage.getByText('an@example.test').waitFor();
  assert.equal(await publicPage.getByText('0123456789').count(), 0);
  await page.getByLabel('Kỹ năng').fill('Thiết kế phần mềm');
  await page.getByText(/Bạn có thay đổi chưa công khai/).waitFor();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Đổi link chia sẻ' }).click();
  await page.getByText('Đã đổi link. Link cũ không còn xem được.').waitFor();
  await publicPage.reload();
  await publicPage.getByText('CV không tồn tại hoặc đã ngừng chia sẻ.').waitFor();
  await publicPage.goto(`${origin}/cv/${publicId}`, { waitUntil: 'domcontentloaded' });
  await publicPage.getByText('Giảng viên thử').waitFor();
  await page.getByRole('button', { name: 'Ngừng chia sẻ' }).click();
  await page.getByText('Đã ngừng chia sẻ CV.').waitFor();
  await publicPage.reload();
  await publicPage.getByText('CV không tồn tại hoặc đã ngừng chia sẻ.').waitFor();
  console.log('CV UI: preview, publication, chosen contacts and unpublication passed');
} finally { await browser?.close(); await vite.close(); }
