// Functional UI checks with intentionally delayed, intercepted responses; no production writes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { createServer } from '../frontend/node_modules/vite/dist/node/index.js';
import react from '../frontend/node_modules/@vitejs/plugin-react/dist/index.js';
import tailwindConfig from '../frontend/tailwind.config.js';
const require = createRequire(import.meta.url);
const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));
const { chromium } = require(process.env.W6_PLAYWRIGHT_PATH || 'C:/Users/fw622/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = fileURLToPath(new URL('../frontend', import.meta.url));
const vite = await createServer({
  root, configFile: false, plugins: [react()],
  define: { 'import.meta.env.VITE_DATA_SOURCE': JSON.stringify('api'), 'import.meta.env.VITE_API_URL': JSON.stringify('/api/v1') },
  css: { postcss: { plugins: [frontendRequire('tailwindcss')({ ...tailwindConfig, content: [`${root.replaceAll('\\', '/')}/src/**/*.{js,jsx}`, `${root}/index.html`] }), frontendRequire('autoprefixer')()] } },
  server: { host: '127.0.0.1', port: 0 },
});
let browser;
const failures = [];
const calls = new Map();
const user = { userId: 1, displayName: 'Giảng viên kiểm tra', roles: ['LECTURER', 'MANAGER'], lecturerProfile: { lecturerId: 1, LecturerId: 1, fullName: 'Giảng viên kiểm tra' } };
const documents = [1, 2].map((id) => ({ document_id: id, document_code: `QD-0${id}`, title: `Quy định ${id}`, document_type: 'UNIVERSITY_REGULATION', versions_count: 1 }));
const criteria = [{ criteria_version_id: 1, criterion_code: 'NCKH-01', name: 'Nghiên cứu khoa học', target_type: 'LECTURER', min_threshold: 1, is_confirmed: true }];
let failCriteria = false;
try {
  await vite.listen();
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => failures.push(error.message));
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    calls.set(path, (calls.get(path) || 0) + 1);
    let data;
    if (path === '/auth/refresh') data = { accessToken: 'ui-check-token' };
    else if (path === '/auth/me') data = user;
    else {
      await new Promise((resolve) => setTimeout(resolve, 1400));
      if (path === '/regulations/criteria') {
        assert.equal(url.searchParams.has('limit'), false, 'AI must not send unsupported limit');
        if (failCriteria) {
          await route.fulfill({ status: 503, json: { success: false, error: { message: 'Tiêu chí tạm thời không khả dụng' } } });
          return;
        }
        data = criteria;
      } else if (path === '/dashboard/summary' || path === '/reports') data = { summary: [{ kind: 'ACHIEVEMENT', subject_type: 'LECTURER', valid_count: 4, total: 4, distinct_years: 2 }], items: [], total: 0 };
      else if (path === '/me/profile') data = { lecturerId: 1, employeeCode: 'GV01', fullName: user.displayName, email: 'ui@example.test', version: 1, workHistory: [], titlesAndHonors: [], stats: {} };
      else if (path === '/organizations') data = [{ unitId: 1, name: 'Khoa kiểm tra', code: 'K01', type: 'FACULTY' }];
      else if (path === '/units/1/profile') data = { unitId: 1, name: 'Khoa kiểm tra', code: 'K01', type: 'FACULTY', stats: {}, version: 1 };
      else if (path === '/kpi/catalogs') data = { types: [], units: [] };
      else if (path === '/kpi/recommendations') data = { items: [{ recommendation_id: 1, version: 1, status: 'PENDING', payload: { title: 'Đề xuất nghiên cứu', target: 2, measureUnit: 'Bài báo', actualRecorded: 0, priority: 1, explanation: 'Gợi ý từ tiêu chí đã xác nhận.', legalReferences: [], assumptions: [], plan: 'Chuẩn bị đề cương', periodStart: '', periodEnd: '' }, provider_evidence: { provider: 'mock', model: 'functional-ui', cached: false } }] };
      else if (path === '/kpi/goals') data = { items: [{ goal_id: 1, code: 'KPI01', title: 'Mục tiêu nghiên cứu', measure_unit: 'Bài báo', period_start: '2026-01-01', period_end: '2026-12-31', target: 2, status: 'DRAFT', source: 'MANUAL', version: 1 }] };
      else if (path === '/award-cycles') data = [{ award_period_id: 1, name: 'Kỳ năm 2026', status: 'OPEN' }];
      else if (path === '/award-applications') data = { items: [{ application_id: 1, target_award_type_id: 1, award_period_id: 1, status: 'DRAFT' }] };
      else if (path === '/regulations') data = documents;
      else if (/^\/regulations\/[12]$/.test(path)) data = { ...documents[Number(path.slice(-1)) - 1], versions: [{ version_id: 1, version_number: '1.0', effective_from_str: '2026-01-01', sha256_hash: 'a'.repeat(64), is_confirmed: true, lhu_application_status: 'CONFIRMED_LHU_POLICY' }] };
      else if (path.endsWith('/chunks')) data = [{ chunk_id: 1, article_no: 'Điều 1', content: 'Nội dung quy định kiểm tra', chunk_hash: 'b'.repeat(64) }];
      else if (path === '/notifications') data = { items: [], total: 0, unreadCount: 0 };
      else if (path === '/ai/evaluations') data = { items: [] };
      else if (path === '/ai/evaluations/1/stale-check') data = { isStale: false };
      else if (path === '/achievements') data = { items: [], pagination: { page: Number(url.searchParams.get('page') || 1), pageSize: Number(url.searchParams.get('pageSize') || 10), total: 0, totalPages: 1 } };
      else if (path === '/achievements/catalogs') data = { achievementTypes: [], academicYears: [] };
      else if (path.includes('achievement-types')) data = [];
      else { failures.push(`Unhandled UI API: ${path}`); data = []; }
    }
    await route.fulfill({ json: { success: true, data } });
  });
  const go = async (path) => {
    await page.locator('nav[aria-label="Menu chính"]').ariaSnapshot();
    await page.locator(`nav[aria-label="Menu chính"] a[href="${path}"]`).click();
  };
  const skeleton = () => page.locator('[aria-busy="true"]').first();
  const noSkeleton = async () => { await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]')); };
  const revisitCached = async (path, endpoint) => {
    const before = calls.get(endpoint);
    await go('/me/dashboard'); await noSkeleton();
    await go(path); await noSkeleton();
    assert.equal(calls.get(endpoint), before, `${path} must reuse its cached list`);
  };
  await page.goto(origin + '/me/dashboard');
  await page.getByRole('heading', { name: /Chào mừng trở lại/ }).waitFor();
  await skeleton().waitFor();
  assert.ok(await page.getByText('Hệ thống Quản lý', { exact: false }).isVisible());
  await noSkeleton();
  console.log('PASS Dashboard renders static content while summary loads');

  await go('/me/profile');
  await page.getByRole('heading', { name: 'Hồ sơ năng lực', exact: true }).waitFor();
  await skeleton().waitFor(); await noSkeleton();
  await page.getByRole('heading', { name: 'Thông tin hồ sơ cá nhân' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Xuất Excel', exact: true }).evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(0, 128, 128)');
  console.log('PASS Profile skeleton -> real profile');

  const dashboardCalls = calls.get('/dashboard/summary');
  await go('/me/dashboard'); await noSkeleton();
  assert.equal(calls.get('/dashboard/summary'), dashboardCalls);
  console.log('PASS Revisiting dashboard uses session memory cache');

  await go('/achievements');
  await skeleton().waitFor();
  assert.equal(await page.getByText('Đang tải danh sách thành tích...').getAttribute('class'), 'sr-only', 'loading label is screen-reader only');
  await noSkeleton();
  console.log('PASS Achievements skeleton -> settled list');
  await revisitCached('/achievements', '/achievements');
  let beforeRefresh = calls.get('/achievements');
  await page.getByTitle('Làm mới', { exact: true }).click(); await noSkeleton();
  assert.equal(calls.get('/achievements'), beforeRefresh + 1);

  await go('/kpi'); await skeleton().waitFor();
  assert.equal(await page.getByText('Chưa có mục tiêu KPI nào').count(), 0);
  await page.getByRole('heading', { name: 'Mục tiêu nghiên cứu' }).waitFor();
  const csvHeading = page.getByRole('heading', { name: 'Nhập mục tiêu bằng file CSV' });
  const aiHeading = page.getByRole('heading', { name: 'Gợi ý KPI bằng AI' });
  const listHeading = page.getByRole('heading', { name: 'Danh sách mục tiêu đã lưu' });
  assert.ok((await csvHeading.boundingBox()).y < (await aiHeading.boundingBox()).y);
  assert.ok((await aiHeading.boundingBox()).y < (await listHeading.boundingBox()).y);
  await page.getByPlaceholder('Nhập mã phiên đã thẩm định').fill('1');
  await page.getByRole('button', { name: 'Xem gợi ý đã lưu' }).click();
  await page.getByRole('heading', { name: 'Đề xuất nghiên cứu' }).waitFor();
  await fs.mkdir(new URL('../output/playwright/', import.meta.url), { recursive: true });
  await page.locator('section').filter({ has: csvHeading }).screenshot({ path: fileURLToPath(new URL('../output/playwright/kpi-csv.png', import.meta.url)) });
  await page.locator('section').filter({ has: aiHeading }).screenshot({ path: fileURLToPath(new URL('../output/playwright/kpi-ai.png', import.meta.url)) });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.locator('section').filter({ has: csvHeading }).evaluate((element) => element.scrollWidth <= element.clientWidth + 1));
  await page.locator('section').filter({ has: csvHeading }).screenshot({ path: fileURLToPath(new URL('../output/playwright/kpi-csv-mobile.png', import.meta.url)) });
  await page.setViewportSize({ width: 1440, height: 1000 });
  console.log('PASS KPI has no false empty state before populated response');
  console.log('PASS KPI CSV order, responsive layout and themed AI recommendations');
  await revisitCached('/kpi', '/kpi/goals');
  beforeRefresh = calls.get('/kpi/goals');
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click(); await noSkeleton();
  assert.equal(calls.get('/kpi/goals'), beforeRefresh + 1);

  await go('/award-applications'); await skeleton().waitFor();
  await page.getByText('Hồ sơ #1', { exact: true }).waitFor();
  assert.ok(await page.locator('form.soft-card').count());
  await fs.mkdir(new URL('../output/playwright/', import.meta.url), { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL('../output/playwright/applications-light.png', import.meta.url)), fullPage: true });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.award-applications header')).backgroundColor === 'rgb(37, 45, 58)');
  await page.screenshot({ path: fileURLToPath(new URL('../output/playwright/applications-dark.png', import.meta.url)), fullPage: true });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  console.log('PASS Applications auto-load and theme screenshots');
  await revisitCached('/award-applications', '/award-applications');
  beforeRefresh = calls.get('/award-applications');
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click(); await noSkeleton();
  assert.equal(calls.get('/award-applications'), beforeRefresh + 1);

  await go('/regulations'); await skeleton().waitFor();
  await page.getByText('Phiên bản: 1.0').waitFor();
  const before = calls.get('/regulations');
  await page.getByText('Quy định 2', { exact: true }).click();
  await page.getByRole('heading', { name: 'Quy định 2', exact: true }).waitFor();
  assert.equal(calls.get('/regulations'), before, 'document selection must not refetch all regulations');
  console.log('PASS Regulations decode unwrapped data and avoid duplicate list requests');

  await go('/me/ai-forecast'); await skeleton().waitFor();
  await page.getByText('NCKH-01', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Cá nhân (Giảng viên)', exact: true }).evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(0, 128, 128)');
  assert.equal(await page.getByRole('alert').count(), 0);
  console.log('PASS AI criteria load without unsupported query');
  await page.getByRole('button', { name: 'Lịch sử Phiên AI' }).click();
  await page.getByText('Chưa có phiên đánh giá nào được lưu.', { exact: true }).waitFor();
  const historyCalls = calls.get('/ai/evaluations');
  await page.getByRole('button', { name: '12 Hồ sơ Thử nghiệm (W3-Q4)' }).click();
  await page.getByRole('button', { name: 'Lịch sử Phiên AI' }).click(); await noSkeleton();
  assert.equal(calls.get('/ai/evaluations'), historyCalls);
  beforeRefresh = calls.get('/ai/evaluations');
  await page.getByRole('button', { name: 'Tải lại', exact: true }).click(); await noSkeleton();
  assert.equal(calls.get('/ai/evaluations'), beforeRefresh + 1);

  await go('/reports'); await skeleton().waitFor();
  for (const title of ['Thành tích Cá nhân', 'Thành tích Tập thể', 'Khen thưởng Cá nhân', 'Khen thưởng Tập thể']) assert.ok(await page.getByText(title, { exact: true }).isVisible());
  await noSkeleton();
  console.log('PASS Reports keep all four cards visible during loading');
  await revisitCached('/reports', '/reports');
  beforeRefresh = calls.get('/reports');
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click(); await noSkeleton();
  assert.equal(calls.get('/reports'), beforeRefresh + 1);

  await go('/organizations');
  await page.getByRole('heading', { name: 'Tổ chức & Tập thể' }).waitFor();
  await page.getByRole('button', { name: /Khoa kiểm tra/ }).waitFor();
  assert.ok(await skeleton().isVisible(), 'unit list visible before unit profile finishes');
  await noSkeleton();
  assert.equal(await page.getByRole('button', { name: 'Làm mới', exact: true }).evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(0, 128, 128)');
  const unitCalls = calls.get('/organizations');
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await noSkeleton();
  assert.equal(calls.get('/organizations'), unitCalls + 1, 'explicit refresh bypasses cached list');
  console.log('PASS Organizations list renders before detail request finishes');

  await go('/notifications'); await skeleton().waitFor(); await noSkeleton();
  await page.getByText('Không có thông báo nào', { exact: true }).waitFor();
  console.log('PASS Notifications skeleton -> confirmed empty state');
  await revisitCached('/notifications', '/notifications');
  beforeRefresh = calls.get('/notifications');
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click(); await noSkeleton();
  assert.equal(calls.get('/notifications'), beforeRefresh + 1);
  beforeRefresh = calls.get('/notifications');
  await page.evaluate(() => window.dispatchEvent(new Event('notifications-changed'))); await noSkeleton();
  assert.equal(calls.get('/notifications'), beforeRefresh + 1);
  console.log('PASS New page caches, manual refresh and notification events');

  // Invoke the real frontend client against intercepted responses to verify write invalidation.
  await go('/kpi'); await noSkeleton();
  const beforeWrite = calls.get('/kpi/goals');
  await page.evaluate(async () => {
    const { request } = await import('/src/services/request.js');
    await request({ method: 'POST', url: '/kpi/goals', data: {} });
  });
  await go('/me/dashboard'); await noSkeleton();
  await go('/kpi'); await noSkeleton();
  assert.equal(calls.get('/kpi/goals'), beforeWrite + 2, 'one POST and one fresh GET after invalidation');
  await page.evaluate(async () => {
    const { request } = await import('/src/services/request.js');
    await request({ url: '/ai/evaluations/1/stale-check' });
    await request({ url: '/ai/evaluations/1/stale-check' });
  });
  assert.equal(calls.get('/ai/evaluations/1/stale-check'), 2);
  console.log('PASS Writes invalidate cached lists and stale checks always call API');

  // A full reload starts a new session cache. Verify an actual failure and recovery.
  failCriteria = true;
  await page.goto(origin + '/me/ai-forecast');
  await page.getByRole('alert').filter({ hasText: 'Tiêu chí tạm thời không khả dụng' }).waitFor();
  failCriteria = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await skeleton().waitFor();
  await page.getByText('NCKH-01', { exact: true }).waitFor();
  assert.equal(await page.getByRole('alert').count(), 0);
  console.log('PASS AI error -> retry skeleton -> recovered criteria');
  assert.deepEqual(failures, []);
} finally {
  await browser?.close();
  await vite.close();
}
