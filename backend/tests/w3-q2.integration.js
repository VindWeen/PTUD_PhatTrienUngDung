import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDB, closeDB } from '../src/config/database.js';
import * as regulationRepo from '../src/modules/regulations/regulationRepository.js';
import * as regulationService from '../src/modules/regulations/regulationService.js';

let pool;
let adminUser;

test.before(async () => {
  pool = await connectDB();
  const res = await pool.query(`
    SELECT u.user_id, u.email,
           ARRAY_AGG(r.code) as roles
    FROM app.users u
    JOIN app.user_roles ur ON ur.user_id = u.user_id
    JOIN app.roles r ON r.role_id = ur.role_id
    WHERE r.code IN ('SYSTEM_ADMIN', 'ADMIN') AND ur.revoked_at IS NULL
    GROUP BY u.user_id, u.email
    LIMIT 1
  `);
  if (res.rows.length > 0) {
    adminUser = {
      userId: res.rows[0].user_id,
      email: res.rows[0].email,
      roles: res.rows[0].roles,
    };
  } else {
    adminUser = { userId: 1, email: 'admin@lhu.edu.vn', roles: ['SYSTEM_ADMIN'] };
  }
});

test.after(async () => {
  await closeDB();
});

test('1. [W3-Q2 DB Integration] Nguồn văn bản pháp lý & mô phỏng đã được nạp đầy đủ vào CSDL', async () => {
  const docs = await regulationRepo.listDocuments(null, {});
  assert.ok(docs.length >= 3, 'Phải có ít nhất 3 văn bản trong kho quy định');

  const lawDoc = docs.find((d) => d.document_code === 'VN-LAW-002');
  const eduDoc = docs.find((d) => d.document_code === 'VN-EDU-001');
  const simDoc = docs.find((d) => d.document_code === 'W1-P4-SIMULATION');

  assert.ok(lawDoc, 'Có văn bản VN-LAW-002 (Luật 06)');
  assert.ok(eduDoc, 'Có văn bản VN-EDU-001 (Thông tư 07)');
  assert.ok(simDoc, 'Có văn bản W1-P4-SIMULATION (Mô phỏng demo)');

  assert.equal(lawDoc.document_type, 'LAW');
  assert.equal(eduDoc.document_type, 'CIRCULAR');
  assert.equal(simDoc.document_type, 'GUIDELINE');
});

test('2. [W3-Q2 DB Integration] Kiểm tra Chunks trích đoạn Điều/Khoản/Trang theo phiên bản', async () => {
  const eduDoc = await regulationRepo.findDocumentByCode(null, 'VN-EDU-001');
  const versions = await regulationRepo.listVersionsByDocumentId(null, eduDoc.document_id);
  assert.ok(versions.length > 0, 'Phải có ít nhất 1 phiên bản cho Thông tư 07');

  const ver = versions[0];
  const chunks = await regulationRepo.listChunksByVersionId(null, ver.version_id);
  assert.ok(chunks.length >= 4, 'Thông tư 07 phải có ít nhất 4 phân đoạn trích dẫn (Điều 2, 3, 30, 31, 32)');

  const article30 = chunks.find((c) => c.article_no === 'Điều 30');
  assert.ok(article30, 'Tìm thấy phân đoạn Điều 30');
  assert.equal(article30.clause_no, 'Khoản 3');
  assert.equal(article30.page_no, 3);
  assert.ok(article30.chunk_hash.length === 64, 'Chunk hash phải đủ 64 hex characters');
});

test('3. [W3-Q2 DB Integration] Phiên bản bất biến & Quan hệ thay thế (supersedes_version_id)', async () => {
  // Tạo tài liệu thử nghiệm
  const tempCode = `DOC-TEST-${Date.now()}`;
  const createdDoc = await regulationRepo.createDocument(null, {
    documentCode: tempCode,
    title: 'Quy định nội bộ thử nghiệm',
    documentType: 'UNIVERSITY_REGULATION',
    issuingAuthority: 'Trường Đại học Lạc Hồng',
  });

  // Tạo phiên bản 1.0
  const v1 = await regulationService.createVersion(
    createdDoc.document_id,
    {
      versionNumber: 'v1.0',
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      isOfficial: true,
      lhuApplicationStatus: 'INTERNAL_CRITERIA_UNCONFIRMED',
      contentForHash: 'Quy định v1.0 nội dung gốc',
    },
    adminUser
  );
  assert.ok(v1.version_id);

  // Tạo phiên bản 2.0 thay thế phiên bản 1.0
  const v2 = await regulationService.createVersion(
    createdDoc.document_id,
    {
      versionNumber: 'v2.0',
      effectiveFrom: '2026-06-01',
      supersedesVersionId: v1.version_id,
      isOfficial: true,
      lhuApplicationStatus: 'INTERNAL_CRITERIA_UNCONFIRMED',
      contentForHash: 'Quy định v2.0 sửa đổi bổ sung',
    },
    adminUser
  );
  assert.ok(v2.version_id);
  assert.equal(Number(v2.supersedes_version_id), Number(v1.version_id));

  // Kiểm tra phiên bản 1.0 KHÔNG bị xóa mà được cập nhật ngày chuyển tiếp (effective_to <= 2026-06-01)
  const v1Reload = await regulationRepo.findVersionById(null, v1.version_id);
  assert.ok(v1Reload, 'v1 vẫn tồn tại (bất biến)');
  assert.equal(v1Reload.effective_to_str, '2026-06-01', 'v1 được chốt ngày hết hiệu lực tại ngày v2 bắt đầu có hiệu lực');

  // Thử tạo trùng phiên bản v2.0 -> Phải báo Conflict
  await assert.rejects(
    async () =>
      regulationService.createVersion(
        createdDoc.document_id,
        {
          versionNumber: 'v2.0',
          effectiveFrom: '2026-07-01',
        },
        adminUser
      ),
    (err) => err.message.includes('đã tồn tại cho văn bản này')
  );
});

test('4. [W3-Q2 Gatekeeper Integration] Cổng xác nhận tiêu chí: Chưa duyệt thì không trả về cho AI/Đánh giá', async () => {
  // Lấy danh sách tiêu chí với confirmedOnly = true (Mặc định cho module AI / Hội đồng đánh giá)
  const activeForAI = await regulationService.getCriteria({ confirmedOnly: true }, { roles: ['LECTURER'] });
  // Ban đầu các tiêu chí SIM-KPI-01..04 đều có is_confirmed = false nên activeForAI không được chứa chúng
  const unconfirmedInAI = activeForAI.filter((c) => c.criterion_code.startsWith('SIM-KPI'));
  assert.equal(
    unconfirmedInAI.length,
    0,
    'Tiêu chí chưa xác nhận (is_confirmed = false) TUYỆT ĐỐI không được trả về cho bộ đánh giá AI'
  );

  // Lấy toàn bộ tiêu chí (với quyền quản trị xem nháp)
  const allCriteria = await regulationService.getCriteria({ confirmedOnly: false }, adminUser);
  const simCriteria = allCriteria.filter((c) => c.criterion_code.startsWith('SIM-KPI'));
  assert.ok(simCriteria.length >= 4, 'Quản trị viên có thể xem các tiêu chí mô phỏng');
  assert.equal(simCriteria[0].is_confirmed, false, 'Tiêu chí mô phỏng ban đầu chưa được xác nhận');
});

test('5. [W3-Q2 Gatekeeper Integration] Phê duyệt tiêu chí & Kích hoạt cho việc đánh giá', async () => {
  // Tìm tiêu chí SIM-KPI-01
  const allCriteria = await regulationService.getCriteria({ confirmedOnly: false }, adminUser);
  const target = allCriteria.find((c) => c.criterion_code === 'SIM-KPI-01');
  assert.ok(target, 'Tìm thấy SIM-KPI-01');

  // Xác nhận phiên bản văn bản cha trước để đủ điều kiện hợp lệ
  await regulationService.confirmVersion(
    target.version_id,
    {
      isConfirmed: true,
      lhuApplicationStatus: 'INTERNAL_CRITERIA_UNCONFIRMED',
      confirmationNotes: 'Xác nhận để chạy thử nghiệm đánh giá AI',
    },
    adminUser
  );

  // Thực hiện phê duyệt tiêu chí SIM-KPI-01
  const confirmed = await regulationService.confirmCriterion(
    target.criteria_version_id,
    {
      isConfirmed: true,
      notes: 'Đã được Hội đồng thông qua cho kỳ đánh giá 2026',
    },
    adminUser
  );
  assert.equal(confirmed.is_confirmed, true);

  // Kiểm tra lại qua cổng getCriteria({ confirmedOnly: true })
  const activeNow = await regulationService.getCriteria({ confirmedOnly: true }, { roles: ['LECTURER'] });
  const foundInActive = activeNow.find((c) => c.criterion_code === 'SIM-KPI-01');
  assert.ok(foundInActive, 'Sau khi được phê duyệt, tiêu chí SIM-KPI-01 xuất hiện trong danh sách đánh giá hợp lệ');

  // Hoàn trả lại trạng thái false để duy trì tính toàn vẹn của mô phỏng
  await regulationService.confirmCriterion(
    target.criteria_version_id,
    {
      isConfirmed: false,
      notes: 'Khôi phục về trạng thái mô phỏng chưa duyệt',
    },
    adminUser
  );
  await regulationService.confirmVersion(
    target.version_id,
    {
      isConfirmed: false,
      lhuApplicationStatus: 'SIMULATION_ONLY',
      confirmationNotes: 'Khôi phục về trạng thái mô phỏng chưa duyệt',
    },
    adminUser
  );
});
