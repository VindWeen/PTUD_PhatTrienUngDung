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
const user = { userId: 1, displayName: 'Giảng viên kiểm tra', roles: ['ADMIN'], lecturerProfile: { lecturerId: 1, LecturerId: 1, fullName: 'Giảng viên kiểm tra' } };
const documents = [1, 2].map((id) => ({ document_id: id, document_code: `QD-0${id}`, title: `Quy định ${id}`, document_type: 'UNIVERSITY_REGULATION', versions_count: 1 }));
const criteria = [{ criteria_version_id: 1, criterion_code: 'NCKH-01', name: 'Nghiên cứu khoa học', target_type: 'LECTURER', min_threshold: 1, is_confirmed: true }];
let failCriteria = false;
let adminTypes = [{achievement_type_id:1,code:"RESEARCH",name:"Nghiên cứu kiểm tra",description:"",applicable_subject_type:"BOTH",is_active:true}];
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
      if (path === '/admin/users') { await new Promise(resolve=>setTimeout(resolve,1600)); data=[{user_id:1,display_name:'Tài khoản kiểm tra',username:'admin_test',email:'admin@example.test',status:'ACTIVE',version:1}]; }
      else if (path === '/admin/achievement-types') {
        if(route.request().method()==='POST') {const body=route.request().postDataJSON();assert.equal(body.name,'Loại mới kiểm tra'); assert.equal(body.applicableSubjectType,'BOTH','Vietnamese label preserves API enum');adminTypes.push({achievement_type_id:2,code:body.code,name:body.name,description:body.description,applicable_subject_type:body.applicableSubjectType,is_active:body.isActive}); data=adminTypes[1];}
        else data=adminTypes;
      }
      else if (path === '/admin/award-types') data=[{award_type_id:1,code:'AWARD',name:'Khen thưởng kiểm tra',is_active:true}];
      else if (path === '/admin/roles') data=[{role_id:1,code:'MANAGER',is_active:true}];
      else if (path === '/admin/user-roles') data=[];
      else if (path === '/admin/scopes') data=[];
      else if (path === '/admin/representatives') data=[];
      else if (path === '/admin/academic-years') data=[];
      else if (path === '/regulations/criteria') {
        assert.equal(url.searchParams.has('limit'), false, 'AI must not send unsupported limit');
        if (failCriteria) {
          await route.fulfill({ status: 503, json: { success: false, error: { message: 'Tiêu chí tạm thời không khả dụng' } } });
          return;
        }
        data = criteria;
      } else if (path === '/dashboard/summary' || path === '/reports') data = { summary: [{ kind: 'ACHIEVEMENT', subject_type: 'LECTURER', valid_count: 4, total: 4, distinct_years: 2 }], items: [], total: 0 };
      else if (path === '/me/profile') data = { lecturerId: 1, employeeCode: 'GV01', fullName: user.displayName, email: 'ui@example.test', version: 1, workHistory: [], titlesAndHonors: [], stats: {} };
      else if (path === '/organizations') data = [{ unitId: 1, name: 'Khoa kiểm tra', code: 'K01', type: 'FACULTY', isActive: true }];
      else if (path === '/units/1/profile') data = { unitId: 1, name: 'Khoa kiểm tra', code: 'K01', type: 'FACULTY', stats: {}, version: 1 };
      else if (path === '/kpi/external') data = {isAdmin:true,isSimulation:true,records:[],runs:[],mappings:[],items:[]};
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
  await page.goto(origin + '/admin');
  const tabs=page.getByRole('navigation',{name:'Danh mục quản trị'});
  await page.getByRole('heading',{name:'Quản trị hệ thống',exact:true}).waitFor();
  await skeleton().waitFor();
  assert.ok(await tabs.getByRole('button',{name:'Loại thành tích',exact:true}).isEnabled());
  await tabs.getByRole('button',{name:'Loại thành tích',exact:true}).click();
  await page.getByRole('cell',{name:/Nghiên cứu kiểm tra/}).waitFor();
  await page.waitForTimeout(1800);
  assert.equal(await page.getByRole('cell',{name:/Tài khoản kiểm tra/}).count(),0,'late users must not replace selected tab');
  assert.equal(calls.get('/admin/users'),1);
  assert.equal(calls.get('/admin/roles')||0,0,'catalog tabs skip role choices');
  assert.equal(calls.get('/organizations')||0,0,'catalog tabs skip organization choices');
  await tabs.getByRole('button',{name:'Tài khoản',exact:true}).click(); await noSkeleton();
  await page.getByRole('cell',{name:/Tài khoản kiểm tra/}).waitFor();
  assert.equal(calls.get('/admin/users'),1,'reuse users cache');
  await tabs.getByRole('button',{name:'Loại thành tích',exact:true}).click(); await noSkeleton();
  assert.equal(calls.get('/admin/achievement-types'),1,'reuse catalog cache');
  assert.ok(await page.getByRole('option',{name:'Cá nhân và tập thể',exact:true}).count());
  assert.equal(await page.getByRole('option',{name:'BOTH',exact:true}).count(),0);
  await page.getByLabel('Mã',{exact:true}).fill('NEWTYPE');
  await page.getByLabel('Tên',{exact:true}).fill('Loại mới kiểm tra');
  await page.getByRole('button',{name:'Tạo mới',exact:true}).click();
  await page.getByRole('cell',{name:/Loại mới kiểm tra/}).waitFor();
  assert.equal(calls.get('/admin/achievement-types'),3,'POST invalidates and reloads GET');
  let before=calls.get('/admin/achievement-types');
  await page.getByRole('button',{name:'Làm mới',exact:true}).click(); await noSkeleton();
  assert.equal(calls.get('/admin/achievement-types'),before+1);
  await fs.mkdir(new URL('../output/playwright/',import.meta.url),{recursive:true});
  await page.screenshot({path:fileURLToPath(new URL('../output/playwright/admin-themed-light.png',import.meta.url)),fullPage:true});
  await page.getByRole('button',{name:'Chuyển sang chế độ tối',exact:true}).click();
  await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));
  await page.waitForTimeout(350);
  await page.screenshot({path:fileURLToPath(new URL('../output/playwright/admin-themed-dark.png',import.meta.url)),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.locator('form.soft-card').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.screenshot({path:fileURLToPath(new URL('../output/playwright/admin-themed-mobile.png',import.meta.url)),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await tabs.getByRole('button',{name:'Phạm vi quản lý',exact:true}).click();
  await page.getByRole('option',{name:'Quản lý đơn vị',exact:true}).waitFor({state:'attached'}); await noSkeleton();
  assert.equal(calls.get('/admin/roles'),1); assert.equal(calls.get('/organizations'),1);
  await tabs.getByRole('button',{name:'Vai trò tài khoản',exact:true}).click(); await noSkeleton();
  assert.equal(calls.get('/admin/roles'),1,'role choices reused');
  await go('/kpi');
  await page.getByRole('heading',{name:'Mục tiêu / KPI',exact:true}).waitFor();
  await page.getByRole('button',{name:'Pull qua HTTP',exact:true}).waitFor();
  assert.equal(calls.get('/kpi/goals')||0,0,'admin-only does not call personal KPI endpoint');
  assert.equal(calls.get('/kpi/catalogs')||0,0);
  console.log('PASS Admin-only KPI route and external management; immediate tab changes, stale response protection, shared read cache, refresh and writes; light/dark/mobile');
  assert.deepEqual(failures,[]);
} finally {await browser?.close();await vite.close();}
