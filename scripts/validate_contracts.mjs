import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('KIỂM TRA TĨNH HỢP ĐỒNG KỸ THUẬT W1-Q1 / W1-P2 / W1-P3 (SUPABASE)');
console.log('Phạm vi: tệp OpenAPI, fixture, migration, seed và tài liệu trong repository');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${message}`);
  }
}

// 1. Kiểm tra OpenAPI JSON
try {
  const openapiJsonPath = path.resolve('docs/api/openapi.json');
  assert(fs.existsSync(openapiJsonPath), 'Tệp docs/api/openapi.json tồn tại');
  
  const spec = JSON.parse(fs.readFileSync(openapiJsonPath, 'utf8'));
  assert(spec.openapi === '3.0.3', 'Phiên bản OpenAPI đúng 3.0.3');
  assert(spec.info && spec.info.title, 'OpenAPI có tiêu đề và thông tin hợp lệ');
  assert(Object.keys(spec.paths).length >= 20, `Số lượng endpoints đầy đủ (hiện có: ${Object.keys(spec.paths).length})`);
  assert(spec.paths['/auth/login'], 'Có endpoint /auth/login');
  assert(spec.paths['/achievements'], 'Có endpoint /achievements');
  assert(spec.paths['/achievements/{id}/verify'], 'Có endpoint /achievements/{id}/verify');
  assert(spec.paths['/achievements/{id}/submit'], 'Có endpoint /achievements/{id}/submit');
  assert(spec.paths['/award-records'], 'Có endpoint /award-records');
  assert(spec.paths['/organizations']?.get && spec.paths['/organizations']?.post, 'W1-P3 có API danh sách/tạo tổ chức');
  assert(spec.paths['/organizations/{id}']?.patch && spec.paths['/organizations/{id}']?.delete, 'W1-P3 có API sửa/xóa tổ chức');
  assert(spec.paths['/lecturers/{id}/assignments']?.post, 'W1-P3 có API chuyển đơn vị công tác');
} catch (err) {
  assert(false, `Lỗi đọc openapi.json: ${err.message}`);
}

// 2. Kiểm tra OpenAPI YAML
try {
  const openapiYamlPath = path.resolve('docs/api/openapi.yaml');
  assert(fs.existsSync(openapiYamlPath), 'Tệp docs/api/openapi.yaml tồn tại');
  const yamlContent = fs.readFileSync(openapiYamlPath, 'utf8');
  assert(yamlContent.includes('openapi: 3.0.3'), 'YAML chứa tiêu đề openapi: 3.0.3');
  assert(yamlContent.includes('/achievements:'), 'YAML chứa route /achievements:');
} catch (err) {
  assert(false, `Lỗi đọc openapi.yaml: ${err.message}`);
}

// 3. Kiểm tra các tệp Fixtures JSON
const fixtureFiles = [
  'auth.fixtures.json',
  'profile.fixtures.json',
  'achievements.fixtures.json',
  'evidences.fixtures.json',
  'awards.fixtures.json',
  'errors.fixtures.json'
];

for (const file of fixtureFiles) {
  try {
    const fPath = path.resolve('docs/api/fixtures', file);
    assert(fs.existsSync(fPath), `Fixture tồn tại: docs/api/fixtures/${file}`);
    const data = JSON.parse(fs.readFileSync(fPath, 'utf8'));
    assert(Object.keys(data).length > 0, `Fixture ${file} chứa dữ liệu hợp lệ`);
  } catch (err) {
    assert(false, `Lỗi phân tích cú pháp JSON trong ${file}: ${err.message}`);
  }
}

// 4. Kiểm tra các quy tắc nghiệp vụ trong Fixtures
try {
  const achData = JSON.parse(fs.readFileSync('docs/api/fixtures/achievements.fixtures.json', 'utf8'));
  const items = achData.achievementsList.payload.data.items;
  
  // Kiểm tra XOR chủ thể
  let allXorValid = true;
  for (const item of items) {
    const hasLecturer = item.lecturerId !== null && item.lecturerId !== undefined;
    const hasUnit = item.organizationUnitId !== null && item.organizationUnitId !== undefined;
    if ((hasLecturer && hasUnit) || (!hasLecturer && !hasUnit)) {
      allXorValid = false;
    }
  }
  assert(allXorValid, 'Tất cả các bản ghi thành tích mẫu đều tuân thủ nghiêm ngặt ràng buộc chủ thể XOR');

  // Kiểm tra ContextUnitId
  const allHaveContextUnit = items.every(item => item.contextUnitId > 0);
  assert(allHaveContextUnit, 'Tất cả các thành tích mẫu đều có ContextUnitId bất biến');

  // Kiểm tra version bigint
  const allHaveVersion = items.every(item => typeof item.version === 'number' && item.version > 0);
  assert(allHaveVersion, 'Tất cả các thành tích mẫu đều có version bigint kiểm soát đồng thời');
} catch (err) {
  assert(false, `Lỗi kiểm tra quy tắc nghiệp vụ trên achievements fixtures: ${err.message}`);
}

// 5. Kiểm tra Fixture lỗi đặc biệt
try {
  const errData = JSON.parse(fs.readFileSync('docs/api/fixtures/errors.fixtures.json', 'utf8'));
  assert(errData.error403SelfApprovalProhibited.statusCode === 403, 'Lỗi cấm tự duyệt có mã HTTP 403');
  assert(errData.error403SelfApprovalProhibited.payload.error.code === 'SELF_APPROVAL_PROHIBITED', 'Mã lỗi nghiệp vụ SELF_APPROVAL_PROHIBITED chính xác');
  assert(errData.error409ConcurrencyConflict.statusCode === 409, 'Lỗi xung đột đồng thời có mã HTTP 409');
  assert(errData.error409ConcurrencyConflict.payload.error.code === 'CONCURRENCY_CONFLICT', 'Mã lỗi nghiệp vụ CONCURRENCY_CONFLICT chính xác');
} catch (err) {
  assert(false, `Lỗi kiểm tra errors fixtures: ${err.message}`);
}

// 6. Kiểm tra Schema DDL PostgreSQL cho Supabase
try {
  const ddlPath = path.resolve('docs/database/SCHEMA_DDL.sql');
  assert(fs.existsSync(ddlPath), 'Tệp docs/database/SCHEMA_DDL.sql tồn tại');
  const ddlContent = fs.readFileSync(ddlPath, 'utf8');
  assert(ddlContent.includes('CREATE SCHEMA IF NOT EXISTS app;'), 'DDL khởi tạo schema app nghiệp vụ riêng biệt');
  assert(ddlContent.includes('REVOKE ALL ON SCHEMA app FROM anon, authenticated;'), 'DDL thu hồi quyền từ anon và authenticated Data API');
  assert(ddlContent.includes('ck_achievements_subject_xor'), 'DDL có ràng buộc CHECK XOR trên achievements');
  assert(ddlContent.includes('ck_award_records_subject_xor'), 'DDL có ràng buộc CHECK XOR trên award_records');
  assert(ddlContent.includes('uq_award_records_lecturer_recorded'), 'DDL có Partial Unique Index uq_award_records_lecturer_recorded');
  assert(ddlContent.includes('uq_award_records_unit_recorded'), 'DDL có Partial Unique Index uq_award_records_unit_recorded');
  assert(ddlContent.includes('version BIGINT NOT NULL DEFAULT 1'), 'DDL có cột version bigint kiểm soát đồng thời');
  assert(ddlContent.includes('context_unit_id BIGINT NOT NULL'), 'DDL có cột context_unit_id bảo toàn bối cảnh đơn vị');
} catch (err) {
  assert(false, `Lỗi kiểm tra SCHEMA_DDL.sql: ${err.message}`);
}

// 7. Kiểm tra migration và hợp đồng W1-P2
try {
  const migrationPath = path.resolve('supabase/migrations/20261001000009_w1_p2_profiles_catalogs.sql');
  assert(fs.existsSync(migrationPath), 'Migration W1-P2 tổ chức/hồ sơ/danh mục tồn tại');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  assert(migration.includes('CREATE TABLE app.unit_representatives'), 'W1-P2 có bảng lịch sử đại diện đơn vị');
  assert(migration.includes('CREATE TABLE app.academic_years'), 'W1-P2 có danh mục năm học');
  assert(migration.includes('CREATE TABLE app.achievement_types'), 'W1-P2 có danh mục loại thành tích');
  assert(migration.includes('CREATE TABLE app.award_types'), 'W1-P2 có danh mục loại thưởng');
  assert(migration.includes('ex_lecturer_primary_assignments_no_overlap'), 'W1-P2 chặn lịch sử công tác chính chồng lấn');
  assert(migration.includes('ex_unit_representatives_no_overlap'), 'W1-P2 chặn đại diện đơn vị chồng lấn');

  const seed = fs.readFileSync('supabase/seed.sql', 'utf8');
  assert(seed.includes('RESEARCH_JOURNAL_Q1') && seed.includes('CSTĐ_CS'), 'Seed W1-P2 dùng mã danh mục đã chốt');

  const profileFixtures = JSON.parse(fs.readFileSync('docs/api/fixtures/profile.fixtures.json', 'utf8'));
  const workHistory = profileFixtures.personalProfile.payload.data.workHistory;
  assert(workHistory.every(item => item.assignmentId && item.unitCode && item.validFrom), 'Fixture hồ sơ cá nhân khớp hợp đồng lịch sử công tác');
  assert(profileFixtures.unitProfile.payload.data.representative.unitRepresentativeId, 'Fixture hồ sơ tập thể có mã phân công đại diện');

  const spec = JSON.parse(fs.readFileSync('docs/api/openapi.json', 'utf8'));
  assert(spec.components.schemas.UnitRepresentative, 'OpenAPI có hợp đồng UnitRepresentative');
  assert(spec.components.schemas.PersonalPortfolioResponse.properties.data.properties.workHistory.items.properties.unitId, 'OpenAPI mô tả trường lịch sử công tác');
  assert(spec.components.schemas.UnitProfileResponse.properties.data.properties.representative, 'OpenAPI hồ sơ tập thể có đại diện');
} catch (err) {
  assert(false, `Lỗi kiểm tra W1-P2: ${err.message}`);
}

// 8. Kiểm tra bảo toàn lịch sử W1-P3
try {
  const migration = fs.readFileSync('supabase/migrations/20261001000010_w1_p3_organization_integrity.sql', 'utf8');
  assert(migration.includes('prevent_organization_cycle'), 'W1-P3 có trigger DB chặn chu trình tổ chức');
  assert(migration.includes('lecturer_assignments_unit_id_fkey') && migration.includes('ON DELETE RESTRICT'), 'W1-P3 giữ lịch sử đơn vị bằng khóa ngoại RESTRICT');
  const repository = fs.readFileSync('backend/src/modules/organizations/organizationRepository.js', 'utf8');
  const transfer = repository.slice(repository.indexOf('export async function transferLecturer'));
  assert(!/UPDATE\s+app\.achievements/i.test(transfer), 'Luồng điều chuyển không cập nhật bảng achievements');
  assert(!/SET\s+context_unit_id/i.test(transfer), 'Luồng điều chuyển không viết lại ContextUnitId');
  assert(fs.existsSync('supabase/tests/w1_p3_organization_history_test.sql'), 'Có kiểm thử DB lịch sử đơn vị W1-P3');
} catch (err) {
  assert(false, `Lỗi kiểm tra W1-P3: ${err.message}`);
}

// 9. Kiểm tra các tài liệu yêu cầu & bàn giao
const docFiles = [
  'docs/requirements/BUSINESS_RULES.md',
  'docs/requirements/PERMISSIONS_MATRIX.md',
  'docs/database/ERD.md',
  'docs/database/DATA_DICTIONARY.md',
  'docs/api/BIEN_BAN_CHOT_API_W1_Q1.md',
  'docs/database/W1_P2_PROFILES_CATALOGS.md',
  'docs/api/PROFILE_ORGANIZATION_W1_P3.md'
];

for (const doc of docFiles) {
  const docPath = path.resolve(doc);
  assert(fs.existsSync(docPath), `Tài liệu tồn tại: ${doc}`);
}

console.log('\n================================================================');
console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} KIỂM TRA ĐẠT (Passed)`);
if (failedTests > 0) {
  console.error(`CÓ ${failedTests} KIỂM TRA THẤT BẠI!`);
  process.exit(1);
} else {
  console.log('Các kiểm tra tĩnh đã khai báo đều đạt; kết quả này không thay thế kiểm thử migration trên DB test riêng.');
  console.log('================================================================');
}
