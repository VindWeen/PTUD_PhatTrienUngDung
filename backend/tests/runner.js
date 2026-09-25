process.env.NODE_ENV = 'test';
import assert from 'assert';
import http from 'http';
import app from '../src/app.js';
import config from '../src/config/env.js';
import { closeDB } from '../src/config/database.js';
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  SelfApprovalError,
  ConcurrencyConflictError,
  NotFoundError,
  OutOfScopeError,
} from '../src/utils/errors.js';
import { bindParams } from '../src/utils/dbHelper.js';
import { getMigrationFiles } from '../../database/scripts/migrate.js';
import {
  hashPassword,
  comparePassword,
  generateRefreshTokenString,
  hashToken,
  generateAccessToken,
  verifyAccessToken,
} from '../src/utils/crypto.js';

console.log('================================================================');
console.log('CHẠY KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN BACKEND, AUTH & SCOPES [W1-Q3]');
console.log('Tác giả: Tạ Trần Vinh Quang (Phụ trách W1-Q3)');
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
  assert.ok(config.JWT_ACCESS_SECRET, 'Có JWT_ACCESS_SECRET');
  assert.ok(config.JWT_REFRESH_SECRET, 'Có JWT_REFRESH_SECRET');
});

// 2. Kiểm thử Custom Error Classes
console.log('\n2. KIỂM THỬ LỚP LỖI NGHIỆP VỤ (CUSTOM ERRORS):');
it('ValidationError khởi tạo đúng mã 400 và fieldErrors', () => {
  const err = new ValidationError('Dữ liệu sai', { title: 'Tiêu đề không được để trống' });
  assert.strictEqual(err.statusCode, 400);
  assert.strictEqual(err.code, 'VALIDATION_ERROR');
  assert.deepStrictEqual(err.fieldErrors, { title: 'Tiêu đề không được để trống' });
});

it('UnauthorizedError khởi tạo đúng mã 401 và UNAUTHORIZED', () => {
  const err = new UnauthorizedError();
  assert.strictEqual(err.statusCode, 401);
  assert.strictEqual(err.code, 'UNAUTHORIZED');
});

it('SelfApprovalError khởi tạo đúng mã 403 và SELF_APPROVAL_PROHIBITED', () => {
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

// 5. Kiểm thử Mật mã & Token (Crypto & Token Hashing)
console.log('\n5. KIỂM THỬ MẬT MÃ & TOKEN HASHING:');
itAsync('Băm mật khẩu bằng bcrypt và kiểm tra so khớp thành công', async () => {
  const password = 'mySecretPassword2026!';
  const hash = await hashPassword(password);
  assert.ok(hash.startsWith('$2'), 'Hash đúng định dạng bcrypt');
  const isMatch = await comparePassword(password, hash);
  assert.strictEqual(isMatch, true);
  const isWrong = await comparePassword('wrongPassword', hash);
  assert.strictEqual(isWrong, false);
});

it('Refresh token ngẫu nhiên và băm SHA-256 có độ dài chuẩn', () => {
  const rawToken = generateRefreshTokenString();
  assert.strictEqual(rawToken.length, 128, 'Raw token 64 bytes hex = 128 ký tự');
  const tokenHash = hashToken(rawToken);
  assert.strictEqual(tokenHash.length, 64, 'SHA-256 hash hex = 64 ký tự');
});

it('Ký và xác thực JWT Access Token', () => {
  const payload = { sub: '1', username: 'an.nv', email: 'an.nv@lhu.edu.vn', roles: ['LECTURER'] };
  const token = generateAccessToken(payload, '1h');
  assert.ok(token.split('.').length === 3, 'JWT gồm 3 phần header.payload.signature');
  const decoded = verifyAccessToken(token);
  assert.strictEqual(decoded.username, 'an.nv');
  assert.deepStrictEqual(decoded.roles, ['LECTURER']);
});

// Helper thực thi HTTP Request
function makeRequest(port, reqPath, options = {}) {
  const { method = 'GET', headers = {}, body = null } = options;
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = { ...headers };
    if (postData && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: reqPath,
        method,
        headers: reqHeaders,
        agent: false,
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => {
          resBody += chunk;
        });
        res.on('end', () => {
          let parsedData;
          try {
            parsedData = JSON.parse(resBody);
          } catch {
            parsedData = resBody;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            cookies: res.headers['set-cookie'] || [],
            data: parsedData,
          });
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function getCookieValue(cookieHeaders, name) {
  const list = Array.isArray(cookieHeaders) ? cookieHeaders : [cookieHeaders];
  for (const c of list) {
    if (!c) continue;
    const match = c.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

// 6. Kiểm thử HTTP Endpoints & Auth Flow
console.log('\n6. KIỂM THỬ TOÀN DIỆN AUTH FLOW & RBAC SCOPES QUA HTTP:');
async function runHttpTests() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  // Liveness & Readiness
  await itAsync('GET /api/v1/health trả về 200 OK và trạng thái UP', async () => {
    const res = await makeRequest(port, '/api/v1/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.status, 'UP');
  });

  await itAsync('GET /api/v1/health/readiness trả về trạng thái UP với SQL Server thật', async () => {
    const res = await makeRequest(port, '/api/v1/health/readiness');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.database.status, 'UP');
    assert.strictEqual(res.data.data.database.isConnected, true);
  });

  // Login
  let anAccessToken = null;
  let anRefreshTokenCookie = null;
  let bichAccessToken = null;
  let ducAccessToken = null;

  await itAsync('POST /api/v1/auth/login đăng nhập thành công với an.nv, trả về Access Token và Set-Cookie HttpOnly', async () => {
    const res = await makeRequest(port, '/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'an.nv', password: 'demo1234' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.data.accessToken);
    assert.strictEqual(res.data.data.tokenType, 'Bearer');
    assert.strictEqual(res.data.data.user.username, 'an.nv');
    assert.strictEqual(res.data.data.user.displayName, 'PGS.TS. Nguyễn Văn An');

    // Kiểm tra Set-Cookie HttpOnly
    anAccessToken = res.data.data.accessToken;
    const cookieHeader = res.headers['set-cookie']?.find((c) => c.includes('ptud_refresh_token'));
    assert.ok(cookieHeader, 'Phải có header Set-Cookie ptud_refresh_token');
    assert.ok(cookieHeader.toLowerCase().includes('httponly'), 'Cookie phải có cờ HttpOnly');
    assert.ok(cookieHeader.toLowerCase().includes('samesite=lax'), 'Cookie phải có SameSite=Lax');
    anRefreshTokenCookie = cookieHeader.split(';')[0];
  });

  await itAsync('POST /api/v1/auth/login đăng nhập với bich.tt trả về roles MANAGER và scopes đơn vị kèm con (CTE)', async () => {
    const res = await makeRequest(port, '/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'bich.tt', password: 'demo1234' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    bichAccessToken = res.data.data.accessToken;
    const roles = res.data.data.user.roles.map((r) => r.code);
    assert.ok(roles.includes('MANAGER'), 'Phải có vai trò MANAGER');
    assert.ok(roles.includes('LECTURER'), 'Phải có vai trò LECTURER');
    assert.ok(res.data.data.user.scopes.length > 0, 'Phải có scopes đơn vị quản lý');
    assert.strictEqual(res.data.data.user.scopes[0].includeDescendants, true);
  });

  await itAsync('POST /api/v1/auth/login đăng nhập với duc.pm trả về role ADMIN', async () => {
    const res = await makeRequest(port, '/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'duc.pm', password: 'demo1234' },
    });
    assert.strictEqual(res.status, 200);
    ducAccessToken = res.data.data.accessToken;
    const roles = res.data.data.user.roles.map((r) => r.code);
    assert.ok(roles.includes('ADMIN'), 'Phải có vai trò ADMIN');
  });

  await itAsync('POST /api/v1/auth/login sai mật khẩu trả về 401 UNAUTHORIZED', async () => {
    const res = await makeRequest(port, '/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'an.nv', password: 'WrongPassword123!' },
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.error.code, 'UNAUTHORIZED');
  });

  await itAsync('POST /api/v1/auth/login thiếu dữ liệu trả về 400 VALIDATION_ERROR', async () => {
    const res = await makeRequest(port, '/api/v1/auth/login', {
      method: 'POST',
      body: { username: '' },
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.error.code, 'VALIDATION_ERROR');
  });

  // GET /auth/me
  await itAsync('GET /api/v1/auth/me với Bearer Access Token hợp lệ trả về hồ sơ tài khoản', async () => {
    const res = await makeRequest(port, '/api/v1/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${anAccessToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.username, 'an.nv');
    assert.ok(res.data.data.lecturerProfile);
    assert.strictEqual(res.data.data.lecturerProfile.fullName, 'Nguyễn Văn An');
  });

  await itAsync('GET /api/v1/auth/me không có Bearer Token trả về 401 UNAUTHORIZED', async () => {
    const res = await makeRequest(port, '/api/v1/auth/me', { method: 'GET' });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.error.code, 'UNAUTHORIZED');
  });

  await itAsync('GET /api/v1/auth/me với Token giả mạo trả về 401 UNAUTHORIZED', async () => {
    const res = await makeRequest(port, '/api/v1/auth/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer thisIsAFakeInvalidToken123456' },
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.error.code, 'UNAUTHORIZED');
  });

  // Refresh Token Rotation
  let newRotatedCookie = null;
  await itAsync('POST /api/v1/auth/refresh làm mới Access Token và xoay vòng Refresh Token thành công', async () => {
    const res = await makeRequest(port, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Cookie: anRefreshTokenCookie },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.data.accessToken);

    const cookieHeader = res.headers['set-cookie']?.find((c) => c.includes('ptud_refresh_token'));
    assert.ok(cookieHeader, 'Phải cấp lại Cookie mới sau rotation');
    newRotatedCookie = cookieHeader.split(';')[0];
    assert.notStrictEqual(newRotatedCookie, anRefreshTokenCookie, 'Cookie mới phải khác cookie cũ (Rotation)');
  });

  await itAsync('POST /api/v1/auth/refresh với Refresh Token cũ đã bị thu hồi trả về 401 (Chống Replay Attack)', async () => {
    const res = await makeRequest(port, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Cookie: anRefreshTokenCookie }, // Sử dụng token cũ đã rotated
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.error.code, 'UNAUTHORIZED');
  });

  // Logout
  await itAsync('POST /api/v1/auth/logout thu hồi phiên và xóa Cookie thành công', async () => {
    // Đăng nhập tạm lấy cookie mới
    const loginRes = await makeRequest(port, '/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'cuong.lh', password: 'demo1234' },
    });
    const cuongCookie = loginRes.headers['set-cookie']?.find((c) => c.includes('ptud_refresh_token'))?.split(';')[0];

    const logoutRes = await makeRequest(port, '/api/v1/auth/logout', {
      method: 'POST',
      headers: { Cookie: cuongCookie },
    });
    assert.strictEqual(logoutRes.status, 200);

    // Thử dùng lại cookie đã logout -> phải 401
    const refreshAfterLogout = await makeRequest(port, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Cookie: cuongCookie },
    });
    assert.strictEqual(refreshAfterLogout.status, 401);
  });

  // Change Password
  await itAsync('POST /api/v1/auth/change-password đổi mật khẩu thành công và thu hồi các phiên cũ', async () => {
    // Lấy token login của duc.pm
    const loginDuc = await makeRequest(port, '/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'duc.pm', password: 'demo1234' },
    });
    const ducToken = loginDuc.data.data.accessToken;
    const ducOldCookie = loginDuc.headers['set-cookie']?.find((c) => c.includes('ptud_refresh_token'))?.split(';')[0];

    // Đổi mật khẩu sang PasswordMoi2026!
    const changeRes = await makeRequest(port, '/api/v1/auth/change-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ducToken}` },
      body: { oldPassword: 'demo1234', newPassword: 'PasswordMoi2026!' },
    });
    assert.strictEqual(changeRes.status, 200);

    // Phiên cũ bị thu hồi: refresh bằng ducOldCookie phải 401
    const testOldSession = await makeRequest(port, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Cookie: ducOldCookie },
    });
    assert.strictEqual(testOldSession.status, 401);

    // Đăng nhập lại bằng mật khẩu cũ phải thất bại 401
    const loginOldPwd = await makeRequest(port, '/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'duc.pm', password: 'demo1234' },
    });
    assert.strictEqual(loginOldPwd.status, 401);

    // Đăng nhập bằng mật khẩu mới phải thành công 200
    const loginNewPwd = await makeRequest(port, '/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'duc.pm', password: 'PasswordMoi2026!' },
    });
    assert.strictEqual(loginNewPwd.status, 200);

    // Khôi phục lại mật khẩu demo1234
    const restoreRes = await makeRequest(port, '/api/v1/auth/change-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${loginNewPwd.data.data.accessToken}` },
      body: { oldPassword: 'PasswordMoi2026!', newPassword: 'demo1234' },
    });
    assert.strictEqual(restoreRes.status, 200);
  });

  // Scope & Hierarchy CTE Middlewares
  console.log('\n7. KIỂM THỬ PHÂN QUYỀN VÀ CÂY PHẠM VI QUẢN LÝ (CTE & ADMIN RESTRICTION):');

  await itAsync('TS. Bích (Quản lý Khoa CNTT - Unit #1) được duyệt Bộ môn con FIT_SE (Unit #2) nhờ CTE IncludeDescendants', async () => {
    const res = await makeRequest(port, '/api/v1/auth/verify-scope/2', {
      method: 'GET',
      headers: { Authorization: `Bearer ${bichAccessToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.unitId, 2);
  });

  await itAsync('TS. Bích bị từ chối 403 OUT_OF_SCOPE khi cố thẩm định ngoài phạm vi (Khoa Dược - Unit #4)', async () => {
    const res = await makeRequest(port, '/api/v1/auth/verify-scope/4', {
      method: 'GET',
      headers: { Authorization: `Bearer ${bichAccessToken}` },
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.error.code, 'OUT_OF_SCOPE');
  });

  await itAsync('PGS. An (Giảng viên, không có quyền MANAGER) bị từ chối 403 FORBIDDEN khi thẩm định đơn vị', async () => {
    // Đăng nhập lại an.nv lấy access token mới
    const loginAn = await makeRequest(port, '/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'an.nv', password: 'demo1234' },
    });
    const res = await makeRequest(port, '/api/v1/auth/verify-scope/2', {
      method: 'GET',
      headers: { Authorization: `Bearer ${loginAn.data.data.accessToken}` },
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.error.code, 'FORBIDDEN');
  });

  await itAsync('QUY TẮC CỐT LÕI: Admin (duc.pm) KHÔNG tự động có quyền thẩm định nếu thiếu MANAGER scope (ADMIN != MANAGER)', async () => {
    const loginDuc = await makeRequest(port, '/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'duc.pm', password: 'demo1234' },
    });
    const res = await makeRequest(port, '/api/v1/auth/verify-scope/2', {
      method: 'GET',
      headers: { Authorization: `Bearer ${loginDuc.data.data.accessToken}` },
    });
    // Phải bị 403 FORBIDDEN vì ADMIN không tự động là MANAGER và không có scope
    assert.strictEqual(res.status, 403);
  });

  // Anti-Self Approval Middleware
  console.log('\n8. KIỂM THỬ QUY TẮC LIÊM CHÍNH - CHỐNG TỰ PHÊ DUYỆT (ANTI-SELF APPROVAL):');

  await itAsync('Thẩm định viên tự duyệt hồ sơ của chính mình bị chặn 403 SELF_APPROVAL_PROHIBITED', async () => {
    const loginBich = await makeRequest(port, '/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'bich.tt', password: 'demo1234' },
    });
    // Bích (UserId: 2) thẩm định hồ sơ của chính mình (lecturerUserId: 2)
    const res = await makeRequest(port, '/api/v1/auth/test-anti-self-approval', {
      method: 'POST',
      headers: { Authorization: `Bearer ${loginBich.data.data.accessToken}` },
      body: { lecturerUserId: 2 },
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.error.code, 'SELF_APPROVAL_PROHIBITED');
  });

  await itAsync('Thẩm định viên duyệt hồ sơ của người khác được chấp thuận 200 OK', async () => {
    const loginBich = await makeRequest(port, '/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'bich.tt', password: 'demo1234' },
    });
    // Bích (UserId: 2) thẩm định hồ sơ của An (lecturerUserId: 1)
    const res = await makeRequest(port, '/api/v1/auth/test-anti-self-approval', {
      method: 'POST',
      headers: { Authorization: `Bearer ${loginBich.data.data.accessToken}` },
      body: { lecturerUserId: 1 },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
  });

  await new Promise((resolve) => server.close(resolve));
  await closeDB();

  console.log('\n================================================================');
  console.log(`KẾT QUẢ KIỂM THỬ: ${passCount}/${passCount + failCount} KIỂM TRA ĐẠT`);
  if (failCount > 0) {
    console.error(`CÓ ${failCount} KIỂM TRA THẤT BẠI!`);
    process.exitCode = 1;
  } else {
    console.log('TẤT CẢ TEST CASES AUTH & PHÂN QUYỀN W1-Q3 ĐỀU ĐẠT CHUẨN 100%!');
    console.log('================================================================');
    process.exitCode = 0;
  }
}

runHttpTests().catch((err) => {
  console.error('Lỗi kiểm thử HTTP:', err);
  process.exitCode = 1;
});
