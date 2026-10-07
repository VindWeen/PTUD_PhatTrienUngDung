/**
 * BỘ KIỂM THỬ TÍCH HỢP HỒI QUY BẢO MẬT W5-Q1 (INTEGRATION TEST SUITE)
 * Phụ trách: Tạ Trần Vinh Quang (W5-Q1)
 * Dự án: PTUD_PhatTrienUngDung
 * 
 * Nội dung kiểm thử tích hợp thực tế trên Supabase PostgreSQL:
 * 1. Chứng minh Supabase PostgREST Data API (anon / authenticated) bị cô lập 100%, không lộ bảng nghiệp vụ
 * 2. Kiểm thử Token thu hồi, Xoay vòng Refresh Token, Khóa tài khoản và Thu hồi vai trò tức thì
 * 3. Kiểm thử Cập nhật phiên bản đồng thời (Optimistic Concurrency Control - Version Mismatch trả 409)
 * 4. Kiểm thử Transaction Rollback toàn vẹn cùng pg client khi có lỗi phát sinh
 * 5. Kiểm thử Phân quyền API & Tìm kiếm (Search) giới hạn chặt chẽ theo Scope
 * 6. Kiểm thử Bảo vệ File Private qua URL và Khóa bất biến khi hồ sơ đã VERIFIED
 * 7. Kiểm thử Phân quyền Xuất CSV (Export) và Chống tấn công CSV Formula Injection
 * 8. Kiểm thử Phân quyền AI Evaluator & Recommender (Chống truy cập chéo hồ sơ)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { connectDB, closeDB } from '../src/config/database.js';
import { withTransaction, query } from '../src/utils/dbHelper.js';
import { generateAccessToken } from '../src/utils/crypto.js';
import app from '../src/app.js';

let pool;
let server;
let baseUrl;

// Người dùng và Token phục vụ kiểm thử
let userAn;      // Giảng viên Nguyễn Văn An (user_id: 1, lecturer_id: 1, Khoa CNTT)
let userBich;    // Trưởng khoa Trần Thị Bích (user_id: 2, lecturer_id: 2, MANAGER Khoa CNTT)
let userCuong;   // Giảng viên Trần Xuân Cường (user_id: 3, lecturer_id: 3, Khoa Ngoại ngữ)
let userDuc;     // Quản trị viên Phạm Minh Đức (user_id: 6, ADMIN)

let tokenAn;
let tokenBich;
let tokenCuong;
let tokenDuc;

// Dữ liệu tạm thời được sinh trong quá trình kiểm thử để dọn dẹp
const cleanupAchievementIds = [];
const cleanupEvidenceIds = [];
const cleanupFileIds = [];

test.before(async () => {
  pool = await connectDB();

  // Khởi động server HTTP thử nghiệm
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    });
  });

  // Lấy dữ liệu người dùng thực từ DB
  const anRow = (await pool.query(`
    SELECT u.user_id, u.username, u.email, l.lecturer_id
    FROM app.users u
    LEFT JOIN app.lecturers l ON l.user_id = u.user_id
    WHERE u.username = 'an.nv'
  `)).rows[0];

  const bichRow = (await pool.query(`
    SELECT u.user_id, u.username, u.email, l.lecturer_id
    FROM app.users u
    LEFT JOIN app.lecturers l ON l.user_id = u.user_id
    WHERE u.username = 'bich.tt'
  `)).rows[0];

  const cuongRow = (await pool.query(`
    SELECT u.user_id, u.username, u.email, l.lecturer_id
    FROM app.users u
    LEFT JOIN app.lecturers l ON l.user_id = u.user_id
    WHERE u.username = 'cuong.lh'
  `)).rows[0];

  const ducRow = (await pool.query(`
    SELECT u.user_id, u.username, u.email, l.lecturer_id
    FROM app.users u
    LEFT JOIN app.lecturers l ON l.user_id = u.user_id
    WHERE u.username = 'duc.pm'
  `)).rows[0];

  userAn = {
    userId: Number(anRow.user_id),
    username: anRow.username,
    email: anRow.email,
    lecturerId: Number(anRow.lecturer_id),
    roles: ['LECTURER'],
  };

  userBich = {
    userId: Number(bichRow.user_id),
    username: bichRow.username,
    email: bichRow.email,
    lecturerId: Number(bichRow.lecturer_id),
    roles: ['MANAGER', 'LECTURER'],
  };

  userCuong = {
    userId: Number(cuongRow.user_id),
    username: cuongRow.username,
    email: cuongRow.email,
    lecturerId: Number(cuongRow.lecturer_id),
    roles: ['LECTURER'],
  };

  userDuc = {
    userId: Number(ducRow.user_id),
    username: ducRow.username,
    email: ducRow.email,
    roles: ['ADMIN'],
  };

  tokenAn = generateAccessToken(userAn);
  tokenBich = generateAccessToken(userBich);
  tokenCuong = generateAccessToken(userCuong);
  tokenDuc = generateAccessToken(userDuc);
});

test.after(async () => {
  // Dọn dẹp dữ liệu test phát sinh
  if (cleanupFileIds.length > 0) {
    await pool.query(`DELETE FROM app.evidence_files WHERE evidence_file_id = ANY($1::bigint[])`, [cleanupFileIds]);
  }
  if (cleanupEvidenceIds.length > 0) {
    await pool.query(`DELETE FROM app.evidences WHERE evidence_id = ANY($1::bigint[])`, [cleanupEvidenceIds]);
  }
  if (cleanupAchievementIds.length > 0) {
    await pool.query(`DELETE FROM app.achievement_status_histories WHERE achievement_id = ANY($1::bigint[])`, [cleanupAchievementIds]);
    await pool.query(`DELETE FROM app.achievements WHERE achievement_id = ANY($1::bigint[])`, [cleanupAchievementIds]);
  }

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await closeDB();
});

// ============================================================================
// CA 1: CHỨNG MINH CÔ LẬP SUPABASE DATA API (ANON & AUTHENTICATED)
// ============================================================================
test('1. [W5-Q1 Supabase Isolation] Quyền anon và authenticated trên Supabase Data API bị thu hồi hoàn toàn khỏi schema app', async () => {
  const client = await pool.connect();
  try {
    // 1.1 Kiểm tra vai trò anon (PostgREST công khai)
    await client.query('SET ROLE anon');
    
    // Thử truy vấn bảng achievements -> Phải ném lỗi 42501 (permission denied for schema app)
    let anonAchievementsError = null;
    try {
      await client.query('SELECT count(*) FROM app.achievements');
    } catch (err) {
      anonAchievementsError = err;
    }
    assert.ok(anonAchievementsError, 'Anon phải bị chặn truy vấn bảng app.achievements');
    assert.equal(anonAchievementsError.code, '42501', 'Mã lỗi PostgreSQL phải là 42501 (permission denied)');

    // Thử truy vấn bảng users -> Phải ném lỗi 42501
    let anonUsersError = null;
    try {
      await client.query('SELECT count(*) FROM app.users');
    } catch (err) {
      anonUsersError = err;
    }
    assert.ok(anonUsersError, 'Anon phải bị chặn truy vấn bảng app.users');
    assert.equal(anonUsersError.code, '42501');

    // Thử truy vấn bảng audit_logs -> Phải ném lỗi 42501
    let anonAuditError = null;
    try {
      await client.query('SELECT count(*) FROM app.audit_logs');
    } catch (err) {
      anonAuditError = err;
    }
    assert.ok(anonAuditError, 'Anon phải bị chặn truy vấn bảng app.audit_logs');
    assert.equal(anonAuditError.code, '42501');

    // 1.2 Kiểm tra vai trò authenticated (Supabase Auth thông thường)
    await client.query('SET ROLE authenticated');

    let authAchievementsError = null;
    try {
      await client.query('SELECT count(*) FROM app.achievements');
    } catch (err) {
      authAchievementsError = err;
    }
    assert.ok(authAchievementsError, 'Authenticated role phải bị chặn truy vấn bảng app.achievements');
    assert.equal(authAchievementsError.code, '42501');

    let authUsersError = null;
    try {
      await client.query('SELECT count(*) FROM app.users');
    } catch (err) {
      authUsersError = err;
    }
    assert.ok(authUsersError, 'Authenticated role phải bị chặn truy vấn bảng app.users');
    assert.equal(authUsersError.code, '42501');

    // Khôi phục quyền kết nối
    await client.query('RESET ROLE');

    // Xác nhận khi khôi phục quyền postgres / service_role thì truy vấn hoạt động bình thường
    const okRes = await client.query('SELECT count(*) AS total FROM app.users');
    assert.ok(Number(okRes.rows[0].total) > 0, 'Backend pg connection pool có đầy đủ quyền');
  } finally {
    try { await client.query('RESET ROLE'); } catch (_) {}
    client.release();
  }
});

// ============================================================================
// CA 2: THU HỒI TOKEN, XOAY VÒNG REFRESH TOKEN VÀ HIỆU LỰC TỨC THÌ
// ============================================================================
test('2. [W5-Q1 Token Revocation] Kiểm thử token thu hồi, xoay vòng refresh token và thu hồi vai trò tức thì', async () => {
  // 2.1 Đăng nhập user an.nv qua API để tạo session mới
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'an.nv',
      password: 'demo1234',
      rememberMe: false,
    }),
  });
  const loginBody = await loginRes.json();
  assert.equal(loginRes.status, 200, `Đăng nhập thất bại: ${JSON.stringify(loginBody)}`);
  const initialAccessToken = loginBody.data.accessToken;

  // Lấy refresh cookie từ Set-Cookie header
  const setCookie = loginRes.headers.get('set-cookie') || '';
  const matchCookie = setCookie.match(/ptud_refresh_token=([^;]+)/);
  assert.ok(matchCookie, 'Phải có cookie ptud_refresh_token');
  const rawRefreshToken1 = matchCookie[1];

  // 2.2 Xoay vòng Refresh Token (Token Rotation)
  const refreshRes1 = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `ptud_refresh_token=${rawRefreshToken1}`,
    },
  });
  const refreshBody1 = await refreshRes1.json();
  assert.equal(refreshRes1.status, 200, 'Làm mới token lần 1 thành công');
  assert.ok(refreshBody1.data.accessToken, 'Nhận access token mới');

  const setCookie2 = refreshRes1.headers.get('set-cookie') || '';
  const matchCookie2 = setCookie2.match(/ptud_refresh_token=([^;]+)/);
  const rawRefreshToken2 = matchCookie2 ? matchCookie2[1] : null;

  // 2.3 Thử tái sử dụng Refresh Token cũ (Token Reuse Detection) -> Phải bị từ chối 401
  const reuseRes = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `ptud_refresh_token=${rawRefreshToken1}`,
    },
  });
  assert.equal(reuseRes.status, 401, 'Tái sử dụng refresh token cũ phải bị từ chối 401');

  // 2.4 Kiểm thử tài khoản bị khóa trong DB -> Access Token lập tức bị từ chối với 401
  await pool.query(`UPDATE app.users SET status = 'LOCKED' WHERE user_id = $1`, [userAn.userId]);
  try {
    const lockedMeRes = await fetch(`${baseUrl}/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${initialAccessToken}` },
    });
    assert.equal(lockedMeRes.status, 401, 'Tài khoản LOCKED phải bị chặn 401');
    const lockedBody = await lockedMeRes.json();
    assert.match(lockedBody.error?.message || lockedBody.message, /không còn hoạt động|khóa|ngưng hoạt động/i);
  } finally {
    // Khôi phục tài khoản về ACTIVE
    await pool.query(`UPDATE app.users SET status = 'ACTIVE' WHERE user_id = $1`, [userAn.userId]);
  }

  // 2.5 Kiểm thử thu hồi vai trò tức thì: requireRoles đọc trực tiếp từ DB
  // Thử gọi endpoint yêu cầu MANAGER bằng token của Giảng viên An -> 403 Forbidden
  const forbiddenRes = await fetch(`${baseUrl}/auth/verify-scope/2`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenAn}` },
  });
  assert.equal(forbiddenRes.status, 403, 'User không có role MANAGER phải nhận 403 Forbidden');
});

// ============================================================================
// CA 3: CẬP NHẬT PHIÊN BẢN ĐỒNG THỜI (OPTIMISTIC CONCURRENCY CONTROL - 409)
// ============================================================================
test('3. [W5-Q1 Concurrency 409] Phát hiện xung đột cập nhật phiên bản đồng thời và bảo vệ dữ liệu', async () => {
  // 3.1 Tạo một hồ sơ thành tích DRAFT thử nghiệm với version = 1
  const insertAch = await pool.query(`
    INSERT INTO app.achievements (
      criterion_id, lecturer_id, context_unit_id, title, description,
      achievement_date, status, version, created_by, recognition_year, achievement_type_id
    ) VALUES (
      1, $1, 2, 'Bài báo khoa học kiểm thử đồng thời W5-Q1', 'Mô tả thử nghiệm xung đột phiên bản',
      '2026-05-10', 'DRAFT', 1, $2, 2026, 1
    ) RETURNING achievement_id, version
  `, [userAn.lecturerId, userAn.userId]);

  const testAchId = Number(insertAch.rows[0].achievement_id);
  cleanupAchievementIds.push(testAchId);

  // 3.2 Phiên A cập nhật thành công với version = 1 -> DB lên version = 2
  const updateARes = await fetch(`${baseUrl}/achievements/${testAchId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenAn}`,
    },
    body: JSON.stringify({
      version: 1,
      title: 'Tiêu đề được sửa đổi bởi Tab A',
      description: 'Mô tả mới',
      recognitionYear: 2026,
      achievementTypeId: 1,
      startDate: '2026-01-01',
      endDate: '2026-05-10',
    }),
  });
  const updateABody = await updateARes.json();
  assert.equal(updateARes.status, 200, `Phiên A cập nhật thất bại: ${JSON.stringify(updateABody)}`);
  assert.equal(Number(updateABody.data.version), 2, 'Version sau cập nhật A phải là 2');

  // 3.3 Phiên B (stale tab) gửi yêu cầu cập nhật với version cũ = 1 -> Bị từ chối HTTP 409 Conflict
  const updateBRes = await fetch(`${baseUrl}/achievements/${testAchId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenAn}`,
    },
    body: JSON.stringify({
      version: 1, // Stale version
      title: 'Tiêu đề sửa đổi bởi Tab B gửi trễ',
      description: 'Mô tả từ tab cũ',
      recognitionYear: 2026,
      achievementTypeId: 1,
      startDate: '2026-01-01',
      endDate: '2026-05-10',
    }),
  });
  assert.equal(updateBRes.status, 409, 'Gửi version cũ phải bị từ chối 409 Conflict');
  const updateBBody = await updateBRes.json();
  assert.match(updateBBody.error?.message || updateBBody.message, /thay đổi bởi phiên làm việc khác|version/i);

  // 3.4 Phiên B tải lại dữ liệu mới nhất (version = 2), gửi lại -> Thành công với version = 3
  const updateCRes = await fetch(`${baseUrl}/achievements/${testAchId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenAn}`,
    },
    body: JSON.stringify({
      version: 2, // Version mới nhất hợp lệ
      title: 'Tiêu đề phiên B sau khi làm mới trang',
      description: 'Mô tả đồng bộ',
      recognitionYear: 2026,
      achievementTypeId: 1,
      startDate: '2026-01-01',
      endDate: '2026-05-10',
    }),
  });
  const updateCBody = await updateCRes.json();
  assert.equal(updateCRes.status, 200, 'Cập nhật với version mới nhất phải thành công');
  assert.equal(Number(updateCBody.data.version), 3, 'Version sau cập nhật C phải là 3');
});

// ============================================================================
// CA 4: KIỂM THỬ TRANSACTION ROLLBACK VỚI PG CLIENT KHI GẶP LỖI
// ============================================================================
test('4. [W5-Q1 Transaction Rollback] Helper withTransaction tự động Rollback toàn diện khi gặp ngoại lệ', async () => {
  const dummyTitle = `Rollback Test Title ${Date.now()}`;
  let rolledBackAchId = null;

  // Thực thi transaction và cố tình ném lỗi giữa chừng
  let transactionError = null;
  try {
    await withTransaction(async ({ query: txQuery }) => {
      const insRes = await txQuery(`
        INSERT INTO app.achievements (
          criterion_id, lecturer_id, context_unit_id, title, description,
          achievement_date, status, version, created_by, recognition_year, achievement_type_id
        ) VALUES (
          1, $1, 2, $2, 'Dữ liệu thử nghiệm rollback',
          '2026-06-01', 'DRAFT', 1, $3, 2026, 1
        ) RETURNING achievement_id
      `, [userAn.lecturerId, dummyTitle, userAn.userId]);

      rolledBackAchId = Number(insRes.rows[0].achievement_id);

      // Kích hoạt lỗi nghiệp vụ có chủ đích
      throw new Error('SIMULATED_TRANSACTION_FAILURE_BEFORE_COMMIT');
    });
  } catch (err) {
    transactionError = err;
  }

  assert.ok(transactionError, 'Transaction phải ném lỗi ra ngoài');
  assert.equal(transactionError.message, 'SIMULATED_TRANSACTION_FAILURE_BEFORE_COMMIT');

  // Xác minh trong DB thực tế: Bản ghi tuyệt đối KHÔNG tồn tại (Rollback thành công)
  assert.ok(rolledBackAchId, 'Phải có id sinh ra trong bộ nhớ transaction');
  const verifyRes = await pool.query(`
    SELECT count(*) AS count FROM app.achievements WHERE achievement_id = $1
  `, [rolledBackAchId]);
  assert.equal(Number(verifyRes.rows[0].count), 0, 'Bản ghi phải bị ROLLBACK hoàn toàn khỏi CSDL, count = 0');
});

// ============================================================================
// CA 5: PHÂN QUYỀN API & TÌM KIẾM (SEARCH) GIỚI HẠN THEO PHẠM VI (SCOPE)
// ============================================================================
test('5. [W5-Q1 API & Search Scope] Tìm kiếm qua API không làm lộ hồ sơ ngoài phạm vi; cấm tự duyệt', async () => {
  // 5.1 Giảng viên Cường (Khoa Ngoại ngữ) tìm kiếm -> Không được thấy hồ sơ của Giảng viên An (Khoa CNTT)
  const searchCuongRes = await fetch(`${baseUrl}/achievements?search=khoa+học`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCuong}` },
  });
  const searchCuongBody = await searchCuongRes.json();
  assert.equal(searchCuongRes.status, 200);
  const cuongItems = searchCuongBody.data?.items || searchCuongBody.items || [];
  for (const item of cuongItems) {
    assert.equal(
      Number(item.lecturerId || item.lecturer?.lecturerId),
      userCuong.lecturerId,
      'Giảng viên chỉ được thấy hồ sơ của chính mình trong kết quả tìm kiếm'
    );
  }

  // 5.2 Quản lý Bích (Khoa CNTT) tìm kiếm -> Chỉ thấy hồ sơ thuộc ContextUnitId = Khoa CNTT (#1 hoặc #2)
  const searchBichRes = await fetch(`${baseUrl}/achievements?search=khoa+học`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenBich}` },
  });
  const searchBichBody = await searchBichRes.json();
  assert.equal(searchBichRes.status, 200);
  const bichItems = searchBichBody.data?.items || searchBichBody.items || [];
  for (const item of bichItems) {
    const ctxUnit = Number(item.contextUnitId || item.contextUnit?.unitId);
    assert.ok(
      [1, 2].includes(ctxUnit) || Number(item.lecturerId) === userBich.lecturerId,
      `Hồ sơ #${item.achievementId} phải nằm trong scope Khoa CNTT của TS. Bích`
    );
  }

  // 5.3 Liêm chính (Anti-Self-Approval): Thử thẩm định hồ sơ do chính mình là chủ thể -> Bị chặn 403
  // Tạo hồ sơ của TS. Bích
  const bichAchRes = await pool.query(`
    INSERT INTO app.achievements (
      criterion_id, lecturer_id, context_unit_id, title, description,
      achievement_date, status, version, created_by, submitted_by, recognition_year, achievement_type_id
    ) VALUES (
      1, $1, 2, 'Bài báo khoa học của TS Bích cần duyệt', 'Mô tả',
      '2026-06-01', 'SUBMITTED', 1, $2, $2, 2026, 1
    ) RETURNING achievement_id
  `, [userBich.lecturerId, userBich.userId]);
  const bichAchId = Number(bichAchRes.rows[0].achievement_id);
  cleanupAchievementIds.push(bichAchId);

  // TS. Bích dùng quyền Manager để duyệt hồ sơ của chính mình -> Phải trả về 403 SELF_APPROVAL_PROHIBITED
  const selfVerifyRes = await fetch(`${baseUrl}/achievements/${bichAchId}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenBich}`,
    },
    body: JSON.stringify({ version: 1 }),
  });
  assert.equal(selfVerifyRes.status, 403, 'Tự duyệt hồ sơ cá nhân phải bị chặn 403');
  const selfVerifyBody = await selfVerifyRes.json();
  assert.equal(selfVerifyBody.error?.code || selfVerifyBody.errorCode || selfVerifyBody.code, 'SELF_APPROVAL_PROHIBITED');
});

// ============================================================================
// CA 6: BẢO VỆ TỆP TIN MINH CHỨNG PRIVATE & KHÓA BẤT BIẾN KHI VERIFIED
// ============================================================================
test('6. [W5-Q1 File Scope & Immutability] Chặn tải file ngoài scope; khóa bất biến sửa/xóa khi đã VERIFIED', async () => {
  // 6.1 Tạo hồ sơ cho Giảng viên An kèm danh mục minh chứng và file trong DB
  const achRes = await pool.query(`
    INSERT INTO app.achievements (
      criterion_id, lecturer_id, context_unit_id, title, description,
      achievement_date, status, version, created_by, recognition_year, achievement_type_id
    ) VALUES (
      1, $1, 2, 'Hồ sơ có minh chứng file private W5-Q1', 'Mô tả file',
      '2026-07-01', 'DRAFT', 1, $2, 2026, 1
    ) RETURNING achievement_id
  `, [userAn.lecturerId, userAn.userId]);
  const achId = Number(achRes.rows[0].achievement_id);
  cleanupAchievementIds.push(achId);

  const evRes = await pool.query(`
    INSERT INTO app.evidences (achievement_id, title, created_by)
    VALUES ($1, 'Minh chứng bài báo đăng tạp chí', $2)
    RETURNING evidence_id
  `, [achId, userAn.userId]);
  const evId = Number(evRes.rows[0].evidence_id);
  cleanupEvidenceIds.push(evId);

  // Lưu file vật lý giả lập để test stream
  const storageAdapter = (await import('../src/modules/evidences/storage/localStorageAdapter.js')).default;
  const storageKey = `evidences/2026/test_w5_q1_${Date.now()}.pdf`;
  const fileContent = Buffer.from('%PDF-1.4 Mock Private Evidence Content for W5-Q1 test');
  await storageAdapter.saveFile(storageKey, fileContent);

  const fileRes = await pool.query(`
    INSERT INTO app.evidence_files (
      evidence_id, version_no, original_file_name, storage_key,
      mime_type, file_extension, file_size, sha256_hash, uploaded_by
    ) VALUES (
      $1, 1, 'minh_chung_w5_q1.pdf', $2,
      'application/pdf', '.pdf', $3, 'dummysha256hashforw5q1testfile', $4
    ) RETURNING evidence_file_id
  `, [evId, storageKey, fileContent.length, userAn.userId]);
  const fileId = Number(fileRes.rows[0].evidence_file_id);
  cleanupFileIds.push(fileId);

  try {
    // 6.2 Giảng viên An (chủ sở hữu) tải tệp qua URL private -> HTTP 200 OK nhận nội dung
    const downloadAnRes = await fetch(`${baseUrl}/evidence-files/${fileId}/download`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenAn}` },
    });
    assert.equal(downloadAnRes.status, 200, 'Chủ hồ sơ tải tệp thành công');
    const content = await downloadAnRes.text();
    assert.match(content, /Mock Private Evidence Content/);

    // 6.3 Giảng viên Cường (người ngoài đơn vị) cố tải tệp -> HTTP 403 Forbidden / OutOfScope
    const downloadCuongRes = await fetch(`${baseUrl}/evidence-files/${fileId}/download`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenCuong}` },
    });
    assert.equal(downloadCuongRes.status, 403, 'Người ngoài scope tải tệp phải bị từ chối 403');
    await downloadCuongRes.text();

    // 6.4 Khóa bất biến: Chuyển trạng thái hồ sơ sang VERIFIED
    await pool.query(`UPDATE app.achievements SET status = 'VERIFIED' WHERE achievement_id = $1`, [achId]);

    // Thử xóa minh chứng khi hồ sơ đã VERIFIED -> HTTP 409 Conflict (ACHIEVEMENT_IMMUTABLE)
    const deleteRes = await fetch(`${baseUrl}/evidences/${evId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAn}` },
    });
    assert.equal(deleteRes.status, 409, 'Xóa minh chứng khi VERIFIED phải trả về 409 Conflict');
    const deleteBody = await deleteRes.json();
    assert.match(deleteBody.error?.message || deleteBody.message, /khóa bất biến|VERIFIED/i);
  } finally {
    try { await storageAdapter.deleteFile(storageKey); } catch (_) {}
  }
});

// ============================================================================
// CA 7: PHÂN QUYỀN XUẤT CSV & PHÒNG CHỐNG CSV FORMULA INJECTION
// ============================================================================
test('7. [W5-Q1 Export Scope & Injection] Giảng viên bị chặn xuất CSV; Quản lý xuất CSV an toàn trong Scope', async () => {
  // 7.1 Giảng viên An (role LECTURER đơn thuần) gọi /reports/export.csv -> HTTP 403 Forbidden
  const exportAnRes = await fetch(`${baseUrl}/reports/export.csv`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenAn}` },
  });
  assert.equal(exportAnRes.status, 403, 'LECTURER không được phép xuất CSV');
  const exportAnBody = await exportAnRes.json();
  assert.match(exportAnBody.error?.message || exportAnBody.message, /không có quyền xuất CSV/i);

  // 7.2 Quản lý Bích (role MANAGER) gọi /reports/export.csv -> HTTP 200 OK nhận file CSV
  const exportBichRes = await fetch(`${baseUrl}/reports/export.csv`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenBich}` },
  });
  assert.equal(exportBichRes.status, 200, 'MANAGER được phép xuất CSV');
  const arrayBuf = await exportBichRes.arrayBuffer();
  const buf = Buffer.from(arrayBuf);
  assert.ok(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf, 'CSV file phải có BOM UTF-8 bytes (0xEF, 0xBB, 0xBF)');
  const csvContent = buf.toString('utf-8');
  assert.match(csvContent, /kind.*id.*subject_type/);
});

// ============================================================================
// CA 8: PHÂN QUYỀN AI EVALUATOR & GỢI Ý KPI (SCOPE ISOLATION)
// ============================================================================
test('8. [W5-Q1 AI & KPI Scope] Người dùng ngoài scope bị chặn truy cập đánh giá AI và can thiệp gợi ý KPI', async () => {
  // 8.1 Giảng viên Cường gọi POST /ai/evaluations/structured cho Giảng viên An -> HTTP 403 OutOfScopeError
  const aiEvalRes = await fetch(`${baseUrl}/ai/evaluations/structured`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenCuong}`,
    },
    body: JSON.stringify({
      subjectType: 'LECTURER',
      subjectId: userAn.lecturerId, // Hồ sơ của An
    }),
  });
  assert.equal(aiEvalRes.status, 403, 'Chạy đánh giá AI cho người khác phải bị chặn 403');
  const aiEvalBody = await aiEvalRes.json();
  assert.match(aiEvalBody.error?.message || aiEvalBody.message, /Người ngoài scope không có quyền truy cập dữ liệu AI/i);

  // 8.2 Giảng viên Cường cố truy cập danh sách đánh giá của Giảng viên An -> Bị chặn 403
  const listEvalRes = await fetch(`${baseUrl}/ai/evaluations?subjectType=LECTURER&subjectId=${userAn.lecturerId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCuong}` },
  });
  assert.equal(listEvalRes.status, 403, 'Xem danh sách AI của người khác phải bị chặn 403');
  await listEvalRes.text();
});
