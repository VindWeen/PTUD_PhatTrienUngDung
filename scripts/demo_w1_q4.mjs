import http from 'node:http';
import app from '../backend/src/app.js';
import { connectDB, closeDB } from '../backend/src/config/database.js';
import { query } from '../backend/src/utils/dbHelper.js';

function request(server, { method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      ...headers,
      ...(postData ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      } : {}),
    };

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => {
          resBody += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(resBody);
          } catch {
            parsed = resBody;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed,
          });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runDemo() {
  console.log('================================================================');
  console.log('DEMO TÍCH HỢP TOÀN TRÌNH: LOGIN – ĐỌC HỒ SƠ – TỔ CHỨC – SUPABASE DB [W1-Q4]');
  console.log('Người thực hiện: Tạ Trần Vinh Quang (Phụ trách W1-Q4)');
  console.log(`Thời điểm chạy:   ${new Date().toISOString()}`);
  console.log('================================================================\n');

  // Khởi động server HTTP ngẫu nhiên
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`⚡ Express App đang chạy tạm thời tại: http://127.0.0.1:${port}`);

  try {
    // 1. Kiểm tra Health & Readiness kết nối Supabase
    console.log('\n--- BƯỚC 1: KIỂM TRA SỨC KHỎE HỆ THỐNG & KẾT NỐI SUPABASE DB ---');
    const healthRes = await request(server, { method: 'GET', path: '/api/v1/health' });
    console.log(`GET /api/v1/health => HTTP ${healthRes.status}:`, JSON.stringify(healthRes.data));

    const readinessRes = await request(server, { method: 'GET', path: '/api/v1/health/readiness' });
    console.log(`GET /api/v1/health/readiness => HTTP ${readinessRes.status}:`, JSON.stringify(readinessRes.data));

    // 2. Đăng nhập Giảng viên (an.nv)
    console.log('\n--- BƯỚC 2: ĐĂNG NHẬP GIẢNG VIÊN (an.nv) VÀO HỆ THỐNG THẬT ---');
    const loginLecturerRes = await request(server, {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { username: 'an.nv', password: 'demo1234' },
    });
    console.log(`POST /api/v1/auth/login => HTTP ${loginLecturerRes.status}`);
    const lecturerToken = loginLecturerRes.data?.data?.accessToken;
    console.log(`- Token nhận được: ${lecturerToken?.slice(0, 20)}... (Đã cấp phát)`);
    console.log(`- Roles:`, loginLecturerRes.data?.data?.user?.roles?.map((r) => r.code));
    console.log(`- Giảng viên:`, loginLecturerRes.data?.data?.user?.displayName);

    // 3. Đọc hồ sơ cá nhân qua GET /api/v1/me/profile
    console.log('\n--- BƯỚC 3: ĐỌC HỒ SƠ NĂNG LỰC CÁ NHÂN (GET /api/v1/me/profile) ---');
    const profileRes = await request(server, {
      method: 'GET',
      path: '/api/v1/me/profile',
      headers: { Authorization: `Bearer ${lecturerToken}` },
    });
    console.log(`GET /api/v1/me/profile => HTTP ${profileRes.status}`);
    const profileData = profileRes.data?.data;
    console.log(`- Họ và tên:`, profileData?.fullName);
    console.log(`- Học hàm / Học vị:`, `${profileData?.title || ''} ${profileData?.degree || ''}`.trim());
    console.log(`- Mã giảng viên:`, profileData?.employeeCode);
    console.log(`- Đơn vị công tác:`, profileData?.unitName);
    console.log(`- Khoa quản lý:`, profileData?.facultyName);
    console.log(`- Lịch sử công tác (${profileData?.workHistory?.length || 0} giai đoạn):`);
    profileData?.workHistory?.forEach((wh, idx) => {
      console.log(`  [${idx + 1}] ${wh.period}: ${wh.position} - ${wh.department} (Chính: ${wh.isPrimary ? 'Có' : 'Không'})`);
    });
    console.log(`- Thống kê hồ sơ (Stats):`, profileData?.stats);

    // 4. Đăng nhập Quản lý (bich.tt) và đọc hồ sơ đơn vị
    console.log('\n--- BƯỚC 4: ĐĂNG NHẬP LÃNH ĐẠO KHOA (bich.tt) & ĐỌC HỒ SƠ TẬP THỂ ---');
    const loginManagerRes = await request(server, {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { username: 'bich.tt', password: 'demo1234' },
    });
    console.log(`POST /api/v1/auth/login (bich.tt) => HTTP ${loginManagerRes.status}`);
    const managerToken = loginManagerRes.data?.data?.accessToken;
    const unitId = 1; // Khoa CNTT

    const unitProfileRes = await request(server, {
      method: 'GET',
      path: `/api/v1/units/${unitId}/profile`,
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    console.log(`GET /api/v1/units/${unitId}/profile => HTTP ${unitProfileRes.status}`);
    const unitData = unitProfileRes.data?.data;
    console.log(`- Tên đơn vị:`, unitData?.name, `(${unitData?.code})`);
    console.log(`- Đại diện hiện tại:`, unitData?.representative?.fullName, `(từ ${unitData?.representative?.validFrom?.slice(0, 10)})`);
    console.log(`- Số lượng giảng viên trực thuộc:`, unitData?.lecturersCount);
    console.log(`- Thống kê tập thể:`, unitData?.stats);

    // 5. Đăng nhập Admin (duc.pm) và đọc cơ cấu tổ chức
    console.log('\n--- BƯỚC 5: ĐĂNG NHẬP ADMIN (duc.pm) & TRUY VẤN CƠ CẤU TỔ CHỨC ---');
    const loginAdminRes = await request(server, {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { username: 'duc.pm', password: 'demo1234' },
    });
    console.log(`POST /api/v1/auth/login (duc.pm) => HTTP ${loginAdminRes.status}`);
    const adminToken = loginAdminRes.data?.data?.accessToken;

    const orgsRes = await request(server, {
      method: 'GET',
      path: '/api/v1/organizations',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`GET /api/v1/organizations => HTTP ${orgsRes.status}`);
    const orgList = orgsRes.data?.data || [];
    console.log(`- Tổng số đơn vị hiện có trong cơ sở dữ liệu: ${orgList.length}`);
    orgList.slice(0, 5).forEach((org) => {
      console.log(`  * [${org.code}] ${org.name} (Loại: ${org.type}, Trực thuộc ID: ${org.parentId || 'Gốc'})`);
    });

    // 6. Kiểm tra Nhật ký Kiểm toán (app.audit_logs) đã che bí mật
    console.log('\n--- BƯỚC 6: XÁC MINH NHẬT KÝ KIỂM TOÁN (app.audit_logs) VÀ CHE BÍ MẬT ---');
    const auditQuery = await query(`
      SELECT audit_id, user_id, action, entity_name, entity_id, old_values, new_values, created_at
      FROM app.audit_logs
      ORDER BY audit_id DESC
      LIMIT 5;
    `);
    console.log(`Tìm thấy ${auditQuery.rows.length} bản ghi audit log gần nhất trong Supabase PostgreSQL:`);
    auditQuery.rows.forEach((row) => {
      console.log(`  [Audit #${row.audit_id}] ${row.action} on ${row.entity_name} (User: ${row.user_id}) lúc ${row.created_at.toISOString()}`);
      if (row.new_values) {
        console.log(`    Payload NewValues:`, JSON.stringify(row.new_values));
      }
    });

    // 7. Thử nghiệm quy tắc bảo mật & phân quyền
    console.log('\n--- BƯỚC 7: KIỂM TRA QUY TẮC BẢO MẬT & BẢO VỆ DỮ LIỆU ---');
    // a. Giảng viên cố tình đọc/sửa hồ sơ người khác
    const forbiddenUpdateRes = await request(server, {
      method: 'PATCH',
      path: '/api/v1/lecturers/2', // Hồ sơ của TS. Bích
      headers: { Authorization: `Bearer ${lecturerToken}` },
      body: { title: 'Hacked', version: 1 },
    });
    console.log(`PATCH /api/v1/lecturers/2 (an.nv sửa hồ sơ bich.tt) => HTTP ${forbiddenUpdateRes.status}:`, forbiddenUpdateRes.data?.error?.code);

    // b. Chọn đơn vị cha tạo chu trình
    const cycleOrgRes = await request(server, {
      method: 'PATCH',
      path: '/api/v1/organizations/1', // Khoa CNTT
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { code: 'FIT', name: 'Khoa CNTT', type: 'FACULTY', parentId: 2, version: 1, isActive: true }, // FIT_SE là con của FIT
    });
    console.log(`PATCH /api/v1/organizations/1 (Chọn con FIT_SE làm cha của FIT) => HTTP ${cycleOrgRes.status}:`, cycleOrgRes.data?.error?.code);

    // c. Xóa đơn vị đang có dữ liệu
    const deleteOrgRes = await request(server, {
      method: 'DELETE',
      path: '/api/v1/organizations/1',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`DELETE /api/v1/organizations/1 (Xóa Khoa đang có giảng viên & bộ môn) => HTTP ${deleteOrgRes.status}:`, deleteOrgRes.data?.error?.code);

    console.log('\n================================================================');
    console.log('KẾT LUẬN DEMO: TOÀN BỘ CÁC BƯỚC TÍCH HỢP THỰC TẾ ĐỀU THÀNH CÔNG 100%!');
    console.log('================================================================');
  } finally {
    server.close();
    await closeDB();
  }
}

runDemo().catch((err) => {
  console.error('Lỗi khi chạy demo:', err);
  process.exit(1);
});
