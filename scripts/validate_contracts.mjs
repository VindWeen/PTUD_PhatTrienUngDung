import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('KIỂM TRA HỢP ĐỒNG KỸ THUẬT VÀ TÀI LIỆU BÀN GIAO W1-Q1');
console.log('Tác giả: Tạ Trần Vinh Quang (Phụ trách Backend / Database / API)');
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

  // Kiểm tra RowVersion
  const allHaveRowVersion = items.every(item => typeof item.rowVersion === 'string' && item.rowVersion.length > 0);
  assert(allHaveRowVersion, 'Tất cả các thành tích mẫu đều có chuỗi token RowVersion kiểm soát đồng thời');
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

// 6. Kiểm tra Schema DDL T-SQL
try {
  const ddlPath = path.resolve('docs/database/SCHEMA_DDL.sql');
  assert(fs.existsSync(ddlPath), 'Tệp docs/database/SCHEMA_DDL.sql tồn tại');
  const ddlContent = fs.readFileSync(ddlPath, 'utf8');
  assert(ddlContent.includes('CK_Achievements_Subject_XOR'), 'DDL có ràng buộc CK_Achievements_Subject_XOR');
  assert(ddlContent.includes('CK_AwardRecords_Subject_XOR'), 'DDL có ràng buộc CK_AwardRecords_Subject_XOR');
  assert(ddlContent.includes('UX_AwardRecords_Lecturer_Recorded'), 'DDL có Filtered Unique Index UX_AwardRecords_Lecturer_Recorded');
  assert(ddlContent.includes('UX_AwardRecords_Unit_Recorded'), 'DDL có Filtered Unique Index UX_AwardRecords_Unit_Recorded');
  assert(ddlContent.includes('RowVersion ROWVERSION NOT NULL'), 'DDL có cột RowVersion trên các bảng nghiệp vụ');
  assert(ddlContent.includes('ContextUnitId BIGINT NOT NULL'), 'DDL có cột ContextUnitId bảo toàn bối cảnh đơn vị');
} catch (err) {
  assert(false, `Lỗi kiểm tra SCHEMA_DDL.sql: ${err.message}`);
}

// 7. Kiểm tra các tài liệu yêu cầu & bàn giao
const docFiles = [
  'docs/requirements/BUSINESS_RULES.md',
  'docs/requirements/PERMISSIONS_MATRIX.md',
  'docs/database/ERD.md',
  'docs/database/DATA_DICTIONARY.md',
  'docs/api/BIEN_BAN_CHOT_API_W1_Q1.md'
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
  console.log('TẤT CẢ CÁC ĐIỀU KIỆN NGHIỆM THU VÀ HỢP ĐỒNG API ĐỀU ĐẠT CHUẨN 100%!');
  console.log('================================================================');
}
