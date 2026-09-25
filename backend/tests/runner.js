process.env.NODE_ENV = 'test';
import assert from 'assert';
import http from 'http';
import app from '../src/app.js';
import config from '../src/config/env.js';
import { closeDB } from '../src/config/database.js';
import {
  AppError,
  ValidationError,
  SelfApprovalError,
  ConcurrencyConflictError,
  NotFoundError,
  OutOfScopeError,
} from '../src/utils/errors.js';
import { bindParams } from '../src/utils/dbHelper.js';
import { getMigrationFiles } from '../../database/scripts/migrate.js';

console.log('================================================================');
console.log('CHẠY KIỂM THỬ TỰ ĐỘNG BACKEND VÀ MIGRATION RUNNER [W1-Q2]');
console.log('Tác giả: Tạ Trần Vinh Quang');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  [PASS] ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}`);
    console.error(`         ${err.message}`);
    failCount++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}`);
    console.error(`         ${err.message}`);
    failCount++;
  }
}

// 1. Kiểm thử Config & Validation
console.log('1. KIỂM THỬ CẤU HÌNH VÀ BIẾN MÔI TRƯỜNG (CONFIG & ZOD):');
it('Config nạp đầy đủ các giá trị mặc định hợp lệ', () => {
  assert.strictEqual(typeof config.PORT, 'number');
  assert.strictEqual(config.PORT, 5000);
  assert.strictEqual(config.API_PREFIX, '/api/v1');
  assert.strictEqual(config.DB_NAME, 'PTUD_AchievementDB');
  assert.strictEqual(typeof config.DB_PORT, 'number');
  assert.strictEqual(config.DB_PORT, 1433);
  assert.strictEqual(config.NODE_ENV, 'development');
});

// 2. Kiểm thử Custom Error Classes
console.log('\n2. KIỂM THỬ LỚP LỖI NGHIỆP VỤ (CUSTOM ERRORS):');
it('ValidationError khởi tạo đúng mã 400 và fieldErrors', () => {
  const err = new ValidationError('Dữ liệu sai', { title: 'Tiêu đề không được để trống' });
  assert.strictEqual(err.statusCode, 400);
  assert.strictEqual(err.code, 'VALIDATION_ERROR');
  assert.deepStrictEqual(err.fieldErrors, { title: 'Tiêu đề không được để trống' });
});

it('SelfApprovalError khởi tạo đúng mã 403 và mã nghiệp vụ SELF_APPROVAL_PROHIBITED', () => {
  const err = new SelfApprovalError();
  assert.strictEqual(err.statusCode, 403);
  assert.strictEqual(err.code, 'SELF_APPROVAL_PROHIBITED');
});

it('ConcurrencyConflictError khởi tạo đúng mã 409 và CONCURRENCY_CONFLICT', () => {
  const err = new ConcurrencyConflictError();
  assert.strictEqual(err.statusCode, 409);
  assert.strictEqual(err.code, 'CONCURRENCY_CONFLICT');
});

it('OutOfScopeError khởi tạo đúng mã 403 và OUT_OF_SCOPE', () => {
  const err = new OutOfScopeError();
  assert.strictEqual(err.statusCode, 403);
  assert.strictEqual(err.code, 'OUT_OF_SCOPE');
});

// 3. Kiểm thử Database Helper & Chống SQL Injection
console.log('\n3. KIỂM THỬ DATABASE HELPER & THAM SỐ HÓA:');
it('bindParams tự động suy diễn và gán tham số an toàn', () => {
  const fakeRequest = {
    inputs: {},
    input(name, type, value) {
      this.inputs[name] = { type, value };
    },
  };

  bindParams(fakeRequest, {
    lecturerId: 101,
    title: 'Nghiên cứu AI',
    isActive: true,
    createdDate: new Date('2026-09-25'),
  });

  assert.ok(fakeRequest.inputs.lecturerId, 'Có tham số lecturerId');
  assert.strictEqual(fakeRequest.inputs.lecturerId.value, 101);
  assert.strictEqual(fakeRequest.inputs.title.value, 'Nghiên cứu AI');
  assert.strictEqual(fakeRequest.inputs.isActive.value, true);
});

// 4. Kiểm thử Migration Runner Files
console.log('\n4. KIỂM THỬ DANH SÁCH MIGRATIONS:');
it('Các file migration được đánh số thứ tự tuần tự từ 001 đến 008', () => {
  const files = getMigrationFiles();
  assert.ok(files.length >= 8, `Có ít nhất 8 file migration (thực tế: ${files.length})`);
  assert.strictEqual(files[0], '001_create_schema_migrations.sql');
  assert.strictEqual(files[1], '002_create_identity_tables.sql');
  assert.strictEqual(files[2], '003_create_organization_tables.sql');
  assert.strictEqual(files[3], '004_create_lecturers_and_catalogs.sql');
  assert.strictEqual(files[4], '005_create_achievement_tables.sql');
  assert.strictEqual(files[5], '006_create_evidence_and_verification_tables.sql');
  assert.strictEqual(files[6], '007_create_award_tables.sql');
  assert.strictEqual(files[7], '008_create_system_tables.sql');
});

function makeGetRequest(port, reqPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: reqPath,
        method: 'GET',
        agent: false,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, data: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// 5. Kiểm thử Endpoint Liveness & Readiness qua HTTP Server
console.log('\n5. KIỂM THỬ API HEALTH & READINESS PROBE:');
async function runHttpTests() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  // Test Liveness
  await itAsync('GET /api/v1/health trả về 200 OK và trạng thái UP', async () => {
    const res = await makeGetRequest(port, '/api/v1/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.status, 'UP');
    assert.ok(res.data.data.timestamp);
    assert.ok(res.data.data.environment);
  });

  // Test 404 Route
  await itAsync('GET đường dẫn không tồn tại trả về 404 chuẩn hợp đồng W1-Q1', async () => {
    const res = await makeGetRequest(port, '/api/v1/non-existent-route');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.error.code, 'NOT_FOUND');
    assert.ok(res.data.error.correlationId);
    assert.ok(res.data.error.timestamp);
  });

  // Test Readiness (phản hồi cấu trúc chuẩn kể cả khi chưa có database thật kết nối)
  await itAsync('GET /api/v1/health/readiness trả về cấu trúc database probe chuẩn', async () => {
    const res = await makeGetRequest(port, '/api/v1/health/readiness');
    assert.ok(res.status === 200 || res.status === 503, `HTTP status hợp lệ (${res.status})`);
    assert.ok(res.data.data.database, 'Có trường database');
    assert.ok(res.data.data.database.status === 'UP' || res.data.data.database.status === 'DOWN');
    assert.ok(res.data.data.system, 'Có trường system');
  });

  await new Promise((resolve) => server.close(resolve));
  await closeDB();

  console.log('\n================================================================');
  console.log(`KẾT QUẢ KIỂM THỬ: ${passCount}/${passCount + failCount} KIỂM TRA ĐẠT`);
  if (failCount > 0) {
    console.error(`CÓ ${failCount} KIỂM TRA THẤT BẠI!`);
    process.exitCode = 1;
  } else {
    console.log('TẤT CẢ MODULES BACKEND VÀ MIGRATION RUNNER ĐỀU ĐẠT CHUẨN 100%!');
    console.log('================================================================');
    process.exitCode = 0;
  }
}

runHttpTests().catch((err) => {
  console.error('Lỗi kiểm thử HTTP:', err);
  process.exitCode = 1;
});
