import assert from 'node:assert/strict';
import { Pool, getDbPoolConfig, setPool, closeDB } from '../src/config/database.js';
import { generateAccessToken } from '../src/utils/crypto.js';
import app from '../src/app.js';

let passed = 0;
const pool = new Pool(getDbPoolConfig());
let server;

try {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;

  // Tokens:
  // 1: an.nv (LECTURER)
  // 2: bich.tt (MANAGER, LECTURER)
  // 3: duc.pm (ADMIN)
  // 4: cuong.lh (UNIT_REPRESENTATIVE cho Unit #2 FIT_SE)
  const tokens = Object.fromEntries(
    [1, 2, 3, 4].map((id) => [id, generateAccessToken({ userId: id })])
  );

  async function call(method, path, body = null, user = 1, expected = 200) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${tokens[user]}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data.error || data)}`);
    passed++;
    return data;
  }

  console.log('--- 1. Kiểm tra GET /achievements phân trang và danh sách ---');
  const listRes = await call('GET', '/achievements?pageSize=5', null, 1, 200);
  assert.equal(listRes.success, true);
  assert.ok(Array.isArray(listRes.data.items));
  assert.ok(listRes.data.pagination);

  console.log('--- 2. Giảng viên (an.nv - 1) tạo thành tích cá nhân (DRAFT) ---');
  const createPersonalRes = await call(
    'POST',
    '/achievements',
    {
      subjectType: 'LECTURER',
      achievementTypeId: 1,
      title: 'Hệ thống AI nhận dạng tiếng nói tiếng Việt cho giảng dạy',
      description: 'Nghiên cứu áp dụng Transformer và CTC loss tối ưu phát âm',
      contributionRole: 'Chủ nhiệm đề tài',
      startDate: '2023-09-01',
      endDate: '2024-06-30',
      recognitionYear: 2024,
    },
    1,
    201
  );
  assert.equal(createPersonalRes.success, true);
  const personalAch = createPersonalRes.data;
  assert.equal(personalAch.subjectType, 'LECTURER');
  assert.equal(personalAch.status, 'DRAFT');
  assert.equal(personalAch.contextUnitId, 2); // FIT_SE là đơn vị công tác chính của GV00234
  assert.ok(personalAch.achievementId > 0);

  console.log('--- 3. Xem chi tiết thành tích cá nhân vừa tạo ---');
  const detailRes = await call('GET', `/achievements/${personalAch.achievementId}`, null, 1, 200);
  assert.equal(detailRes.data.achievementId, personalAch.achievementId);
  assert.equal(detailRes.data.title, 'Hệ thống AI nhận dạng tiếng nói tiếng Việt cho giảng dạy');

  console.log('--- 4. Người ngoài (cuong.lh - 4) xem thành tích cá nhân của an.nv bị 403 Forbidden ---');
  await call('GET', `/achievements/${personalAch.achievementId}`, null, 4, 403);

  console.log('--- 5. Manager (bich.tt - 2) xem thành tích vì ContextUnitId = 2 trong Scope của FIT ---');
  const managerViewRes = await call('GET', `/achievements/${personalAch.achievementId}`, null, 2, 200);
  assert.equal(managerViewRes.data.achievementId, personalAch.achievementId);

  console.log('--- 6. Khóa field nhạy cảm khi PATCH (gửi status hoặc createdBy -> 400 Bad Request) ---');
  await call(
    'PATCH',
    `/achievements/${personalAch.achievementId}`,
    {
      title: 'Cố gắng sửa đổi status',
      status: 'VERIFIED',
      version: personalAch.version,
    },
    1,
    400
  );

  console.log('--- 7. Cập nhật bản nháp thành tích hợp lệ ---');
  const updateRes = await call(
    'PATCH',
    `/achievements/${personalAch.achievementId}`,
    {
      title: 'Hệ thống AI nhận dạng tiếng nói tiếng Việt tối ưu hóa',
      recognitionYear: 2024,
      version: personalAch.version,
    },
    1,
    200
  );
  assert.equal(updateRes.data.title, 'Hệ thống AI nhận dạng tiếng nói tiếng Việt tối ưu hóa');
  assert.equal(updateRes.data.version, personalAch.version + 1);

  console.log('--- 8. Xung đột cập nhật đồng thời (version mismatch -> 409 Conflict) ---');
  await call(
    'PATCH',
    `/achievements/${personalAch.achievementId}`,
    {
      title: 'Thử ghi đè với version cũ',
      version: personalAch.version, // Đã bị tăng lên ở bước trước
    },
    1,
    409
  );

  console.log('--- 9. Đại diện đơn vị (cuong.lh - 4) tạo thành tích tập thể cho Unit #2 ---');
  const createUnitRes = await call(
    'POST',
    '/achievements',
    {
      subjectType: 'UNIT',
      organizationUnitId: 2,
      achievementTypeId: 2,
      title: 'Giải pháp bảo mật IoT cấp bộ môn FIT_SE',
      recognitionYear: 2024,
    },
    4,
    201
  );
  assert.equal(createUnitRes.data.subjectType, 'UNIT');
  assert.equal(createUnitRes.data.organizationUnitId, 2);
  const unitAch = createUnitRes.data;

  console.log('--- 10. Giảng viên không có vai trò đại diện tạo thành tích tập thể bị 403 ---');
  await call(
    'POST',
    '/achievements',
    {
      subjectType: 'UNIT',
      organizationUnitId: 2,
      achievementTypeId: 2,
      title: 'Thành tích tập thể không có quyền',
      recognitionYear: 2024,
    },
    1, // an.nv không phải là đại diện
    403
  );

  console.log('--- 11. Xóa bản nháp thành tích DRAFT thành công ---');
  const deleteRes = await call('DELETE', `/achievements/${personalAch.achievementId}`, null, 1, 200);
  assert.equal(deleteRes.success, true);

  // Xóa nốt unit achievement vừa tạo để dọn dẹp
  await call('DELETE', `/achievements/${unitAch.achievementId}`, null, 4, 200);

  console.log(`\n🎉 HOÀN THÀNH TẤT CẢ ${passed} KIỂM TRA TÍCH HỢP HTTP CHO W2-Q1 (Passed)!`);
} finally {
  if (server) await new Promise((r) => server.close(r));
  await pool.end();
  await closeDB();
}
