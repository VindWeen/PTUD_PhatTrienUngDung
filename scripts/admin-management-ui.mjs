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
const accountsOnly = process.argv.includes('--accounts-only');
let accountWrites = [];
let accountRows = [{user_id:1,display_name:'Tài khoản kiểm tra',username:'admin_test',email:'admin@example.test',status:'ACTIVE',version:1}];
const permissionsOnly = process.argv.includes('--permissions-only');
const calls = new Map();
const user = { userId: 1, displayName: 'Giảng viên kiểm tra', roles: ['ADMIN'], lecturerProfile: { lecturerId: 1, LecturerId: 1, fullName: 'Giảng viên kiểm tra' } };
const documents = [1, 2].map((id) => ({ document_id: id, document_code: `QD-0${id}`, title: `Quy định ${id}`, document_type: 'UNIVERSITY_REGULATION', versions_count: 1 }));
const criteria = [{ criteria_version_id: 1, criterion_code: 'NCKH-01', name: 'Nghiên cứu khoa học', target_type: 'LECTURER', min_threshold: 1, is_confirmed: true }];
let failCriteria = false;
let adminTypes = [{achievement_type_id:1,code:"RESEARCH",name:"Nghiên cứu kiểm tra",description:"",applicable_subject_type:"BOTH",is_active:true}];
let permissions = { revision: 'a'.repeat(64), 'user-roles': [], scopes: [], representatives: [], lecturer: null };
let permissionWrites = 0;
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
      if (path === '/admin/users') {
 if(route.request().method()==='POST') {const body=route.request().postDataJSON();accountWrites.push(body);accountRows.push({user_id:2,username:body.username,email:body.email,display_name:body.displayName,status:'ACTIVE',version:1});data=accountRows[1];}else data=accountRows;
 } else if(path === '/admin/users/1') {const body=route.request().postDataJSON();accountWrites.push(body);accountRows[0]={...accountRows[0],email:body.email,display_name:body.displayName,status:body.status,version:accountRows[0].version+1};data=accountRows[0];}
      else if (path === '/admin/achievement-types') {
        if(route.request().method()==='POST') {const body=route.request().postDataJSON();assert.equal(body.name,'Loại mới kiểm tra'); assert.equal(body.applicableSubjectType,'BOTH','Vietnamese label preserves API enum');adminTypes.push({achievement_type_id:2,code:body.code,name:body.name,description:body.description,applicable_subject_type:body.applicableSubjectType,is_active:body.isActive}); data=adminTypes[1];}
        else data=adminTypes;
      }
      else if (path === '/admin/award-types') data=[{award_type_id:1,code:'AWARD',name:'Khen thưởng kiểm tra',is_active:true}];
      else if (path === '/admin/roles') data=[{role_id:1,code:'MANAGER',is_active:true}];
      else if (path === '/admin/users/1/permissions') {
        if (route.request().method() === 'POST') {
          const body = route.request().postDataJSON();
          assert.equal(body.additions.length, 2, 'one save includes role and selected scope');
          assert.equal(body.revocations.length, 0, 'new grants do not remove unrelated assignments');
          assert.equal(body.additions.find(row => row.resource === 'scopes').values.unitId, 1);
          assert.equal(body.additions.find(row => row.resource === 'scopes').values.includeDescendants, true);
          for (const { resource, values } of body.additions) {
            const key = resource === 'user-roles' ? 'user_role_id' : 'user_unit_scope_id';
            permissions[resource].push({ [key]: 1, user_id: values.userId, role_id: values.roleId, unit_id: values.unitId,
              valid_from: values.validFrom, valid_to: values.validTo, include_descendants: values.includeDescendants, revoked_at: null });
          }
          permissionWrites++; data = { id: 1, added: 2, revoked: 0 };
        } else data = permissions;
      }
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
      else if (path === '/me/calendar' || path === '/me/calendar/system') data = [];
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
  if (accountsOnly) {
 await page.getByRole('button',{name:'Thêm tài khoản',exact:true}).waitFor(); await noSkeleton();
 assert.equal(await page.getByLabel('Tên đăng nhập',{exact:true}).count(),0,'creation form is hidden until requested');
 await page.screenshot({path:'output/playwright/admin-accounts-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Thêm tài khoản',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Thêm tài khoản',exact:true});
 await dialog.getByLabel('Tên đăng nhập',{exact:true}).fill('new_user');
 await dialog.getByLabel('Email',{exact:true}).fill('new@example.test');
 await dialog.getByLabel('Tên hiển thị',{exact:true}).fill('Tài khoản mới');
 await dialog.getByLabel('Mật khẩu ban đầu (ít nhất 10 ký tự)',{exact:true}).fill('test-only-password');
 await dialog.getByRole('button',{name:'Tạo tài khoản',exact:true}).click();
 await dialog.waitFor({state:'detached'}); await noSkeleton();assert.equal(accountWrites[0].username,'new_user');
 await page.getByRole('row').filter({hasText:'admin_test'}).getByRole('button',{name:'Sửa tài khoản',exact:true}).click();
 const editDialog=page.getByRole('dialog',{name:'Sửa tài khoản',exact:true});
 assert.equal(await editDialog.getByLabel('Email',{exact:true}).inputValue(),'admin@example.test');
 await page.setViewportSize({width:390,height:844});
 assert.ok(await editDialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 await page.screenshot({path:'output/playwright/admin-account-edit-mobile.png',fullPage:true});
 await editDialog.getByLabel('Tên hiển thị',{exact:true}).fill('Đã sửa tên');
 await editDialog.getByRole('button',{name:'Lưu thay đổi',exact:true}).click();await editDialog.waitFor({state:'detached'});await noSkeleton();
 const row=page.getByRole('row').filter({hasText:'admin_test'});
 assert.ok(await row.innerText().then(t=>t.includes('Đã sửa tên')));
 await row.getByRole('button',{name:'Khóa tài khoản',exact:true}).click();await noSkeleton();
 await row.getByRole('button',{name:'Tài khoản đã khóa',exact:true}).waitFor();
 assert.equal(accountWrites.at(-1).status,'LOCKED');
 assert.ok(await row.getByRole('button',{name:'Tài khoản đã khóa',exact:true}).isDisabled());
 assert.equal(await row.getByRole('button',{name:'Sửa tài khoản',exact:true}).getAttribute('title'),'Sửa tài khoản');
 console.log('PASS account create/edit dialogs, save payloads, icon labels/tooltips, LOCKED action and mobile layout');assert.deepEqual(failures,[]);
 } else {
  if (!permissionsOnly) {
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
  assert.ok(calls.get('/admin/users') <= 2,'initial notification sync may invalidate an in-flight users read once');
  await tabs.getByRole('button',{name:'Loại thành tích',exact:true}).click(); await noSkeleton();
  assert.ok(calls.get('/admin/achievement-types') <= 2,'initial notification sync may invalidate an in-flight catalog read once');
  const typesBeforeWrite = calls.get('/admin/achievement-types');
  assert.ok(await page.getByRole('option',{name:'Cá nhân và tập thể',exact:true}).count());
  assert.equal(await page.getByRole('option',{name:'BOTH',exact:true}).count(),0);
  await page.getByLabel('Mã',{exact:true}).fill('NEWTYPE');
  await page.getByLabel('Tên',{exact:true}).fill('Loại mới kiểm tra');
  await page.getByRole('button',{name:'Tạo mới',exact:true}).click();
  await page.getByRole('cell',{name:/Loại mới kiểm tra/}).waitFor();
  assert.equal(calls.get('/admin/achievement-types'),typesBeforeWrite+2,'POST invalidates and reloads GET');
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
  }
  await noSkeleton();
  await fs.mkdir(new URL('../output/playwright/',import.meta.url),{recursive:true});
  await page.setViewportSize({width:1440,height:1000});
  assert.equal(await tabs.getByRole('button',{name:'Phạm vi quản lý',exact:true}).count(),0,'permissions are managed per account');
  await tabs.getByRole('button',{name:'Tài khoản',exact:true}).click(); await noSkeleton();
  await page.getByRole('button',{name:'Quản lý quyền',exact:true}).click();
  const permissionDialog = page.getByRole('dialog',{name:/Quản lý quyền/});
  await permissionDialog.getByRole('checkbox',{name:'Quản lý đơn vị',exact:true}).waitFor();
  await permissionDialog.getByRole('checkbox',{name:'Quản lý đơn vị',exact:true}).check();
  await permissionDialog.getByRole('checkbox',{name:'Khoa kiểm tra',exact:true}).check();
  await permissionDialog.getByRole('checkbox',{name:'Bao gồm đơn vị con',exact:true}).check();
  await page.setViewportSize({width:390,height:844});
  assert.ok(await permissionDialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'dialog fits mobile width');
  await page.screenshot({path:fileURLToPath(new URL('../output/playwright/admin-permissions-mobile.png',import.meta.url)),fullPage:true});
  await permissionDialog.getByRole('button',{name:'Lưu quyền',exact:true}).click();
  await permissionDialog.waitFor({state:'detached'}); await noSkeleton();
  assert.equal(permissionWrites,1,'roles and scopes save in one request');
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'Quản lý quyền',exact:true}).click();
  await permissionDialog.getByRole('checkbox',{name:'Quản lý đơn vị',exact:true}).waitFor();
  assert.ok(await permissionDialog.getByRole('checkbox',{name:'Quản lý đơn vị',exact:true}).isChecked());
  assert.ok(await permissionDialog.getByRole('checkbox',{name:'Khoa kiểm tra',exact:true}).isChecked());
  await permissionDialog.getByRole('button',{name:'Lưu quyền',exact:true}).click();
  await permissionDialog.waitFor({state:'detached'});
  assert.equal(permissionWrites,1,'saving unchanged permissions sends no mutations');
  if (!permissionsOnly) {
  await go('/kpi');
  await page.getByRole('heading',{name:'Mục tiêu / KPI',exact:true}).waitFor();
  await page.getByRole('button',{name:'Pull qua HTTP',exact:true}).waitFor();
  assert.equal(calls.get('/kpi/goals')||0,0,'admin-only does not call personal KPI endpoint');
  assert.equal(calls.get('/kpi/catalogs')||0,0);
  }
  console.log(permissionsOnly ? 'PASS unified admin permissions: checkbox role and unit, descendants, single save, mobile dialog, unchanged permissions preserved' : 'PASS Admin-only KPI route and external management; immediate tab changes, stale response protection, shared read cache, refresh and writes; unified permissions; light/dark/mobile');
  assert.deepEqual(failures,[]);
}
} finally {await browser?.close();await vite.close();}
