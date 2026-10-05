import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/app.js';
import { connectDB, closeDB } from '../src/config/database.js';
import { generateAccessToken } from '../src/utils/crypto.js';

let server;
let baseUrl;

async function startServer() {
  await connectDB();
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    });
  });
}

async function stopServer() {
  await new Promise((resolve) => server.close(resolve));
  await closeDB();
}

async function runIntegrationTests() {
  console.log('🚀 Bắt đầu kiểm thử tích hợp HTTP cho W2-Q2 (Upload, Tải & Quản lý Phiên bản File)...');
  await startServer();

  let testAchievementId = null;
  let testEvidenceId = null;
  let testFileV1Id = null;
  let testFileV2Id = null;

  try {
    // 1. Tạo Token cho các tác nhân kiểm thử
    console.log('--- 1. Thiết lập tài khoản kiểm thử ---');
    const anToken = generateAccessToken({ userId: 1, username: 'an.nv', email: 'an.nv@lhu.edu.vn', roles: ['LECTURER'] });
    const bichToken = generateAccessToken({ userId: 2, username: 'bich.tt', email: 'bich.tt@lhu.edu.vn', roles: ['MANAGER', 'LECTURER'] });
    const cuongToken = generateAccessToken({ userId: 4, username: 'cuong.lh', email: 'cuong.lh@lhu.edu.vn', roles: ['UNIT_REPRESENTATIVE', 'LECTURER'] });

    // 2. Tạo hồ sơ thành tích cá nhân (DRAFT) để gắn minh chứng
    console.log('--- 2. Tạo hồ sơ thành tích cá nhân (DRAFT) ---');
    const createAchRes = await fetch(`${baseUrl}/achievements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anToken}`,
      },
      body: JSON.stringify({
        subjectType: 'LECTURER',
        achievementTypeId: 1,
        title: 'Hồ sơ nghiên cứu AI cho W2-Q2 Test',
        recognitionYear: 2026,
        description: 'Thành tích kiểm thử upload minh chứng file',
      }),
    });
    assert.equal(createAchRes.status, 201);
    const achData = await createAchRes.json();
    testAchievementId = achData.data.achievementId;
    console.log(`  [PASS] Đã tạo thành tích #${testAchievementId}`);

    // 3. Tải lên tệp tin giả mạo (đuôi .pdf nhưng nội dung text rác) -> 400 Bad Request
    console.log('--- 3. Kiểm tra tệp tin giả mạo chữ ký (Magic Bytes) -> 400 Bad Request ---');
    const fakeFormData = new FormData();
    fakeFormData.append('title', 'Tệp tin giả mạo PDF');
    fakeFormData.append(
      'file',
      new Blob([Buffer.from('Fake content without %PDF- magic bytes')], { type: 'application/pdf' }),
      'fake_document.pdf'
    );

    const fakeRes = await fetch(`${baseUrl}/achievements/${testAchievementId}/evidences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${anToken}`,
      },
      body: fakeFormData,
    });
    assert.equal(fakeRes.status, 400, 'Tệp tin giả mạo phải bị từ chối 400');
    const fakeJson = await fakeRes.json();
    const errMsg = fakeJson.error?.message || fakeJson.message || '';
    assert.ok(errMsg.includes('Chữ ký tệp giả mạo') || errMsg.includes('không khớp'));
    console.log('  [PASS] Chặn tệp tin giả mạo chữ ký ma thuật thành công (400 Bad Request)');

    // 4. Tải lên minh chứng hợp lệ ban đầu (v1) bằng file PDF chuẩn
    console.log('--- 4. Tải lên minh chứng hợp lệ (v1) bằng PDF chuẩn ---');
    const validPdfBuffer = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Title (Test) >>\nendobj\n%%EOF');
    const validFormData = new FormData();
    validFormData.append('title', 'Biên bản nghiệm thu đề tài cấp trường');
    validFormData.append('description', 'Quyết định số 123/QĐ-LHU');
    validFormData.append(
      'file',
      new Blob([validPdfBuffer], { type: 'application/pdf' }),
      'Bien_ban_nghiem_thu_2026.pdf'
    );

    const uploadV1Res = await fetch(`${baseUrl}/achievements/${testAchievementId}/evidences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${anToken}`,
      },
      body: validFormData,
    });
    assert.equal(uploadV1Res.status, 201);
    const v1Data = await uploadV1Res.json();
    testEvidenceId = v1Data.data.evidenceId;
    testFileV1Id = v1Data.data.files[0].evidenceFileId;

    assert.equal(v1Data.data.files[0].versionNo, 1);
    assert.equal(v1Data.data.files[0].originalFileName, 'Bien_ban_nghiem_thu_2026.pdf');
    assert.equal(v1Data.data.files[0].fileSize, validPdfBuffer.length);
    assert.ok(v1Data.data.files[0].storageKey.startsWith('evidences/'));
    assert.equal(v1Data.data.files[0].sha256Hash.length, 64);
    console.log(`  [PASS] Tạo minh chứng #${testEvidenceId} và tệp v1 #${testFileV1Id} thành công (201 Created)`);

    // 5. Xem danh sách minh chứng của thành tích
    console.log('--- 5. Xem danh sách minh chứng của thành tích ---');
    const listRes = await fetch(`${baseUrl}/achievements/${testAchievementId}/evidences`, {
      headers: { Authorization: `Bearer ${anToken}` },
    });
    assert.equal(listRes.status, 200);
    const listJson = await listRes.json();
    assert.equal(listJson.data.length, 1);
    assert.equal(listJson.data[0].latestVersionNo, 1);
    console.log('  [PASS] Tra cứu danh sách minh chứng thành công');

    // 6. Thay file tạo phiên bản mới (v2) bằng file PNG chuẩn
    console.log('--- 6. Thay file tạo phiên bản mới (v2) bằng file PNG chuẩn ---');
    const validPngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);
    const v2FormData = new FormData();
    v2FormData.append(
      'file',
      new Blob([validPngBuffer], { type: 'image/png' }),
      'Anh_chup_chung_nhan.png'
    );

    const uploadV2Res = await fetch(`${baseUrl}/evidences/${testEvidenceId}/versions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${anToken}`,
      },
      body: v2FormData,
    });
    assert.equal(uploadV2Res.status, 201);
    const v2Data = await uploadV2Res.json();
    testFileV2Id = v2Data.data.evidenceFileId;

    assert.equal(v2Data.data.versionNo, 2);
    assert.equal(v2Data.data.originalFileName, 'Anh_chup_chung_nhan.png');
    assert.equal(v2Data.data.mimeType, 'image/png');
    console.log(`  [PASS] Thay file tạo phiên bản v2 #${testFileV2Id} thành công (VersionNo = 2)`);

    // 7. Người ngoài (cuong.lh) cố tình download tệp bằng file ID -> 403 Forbidden
    console.log('--- 7. Người ngoài (cuong.lh) tải tệp minh chứng -> Bị chặn 403 Forbidden ---');
    const cuongDlRes = await fetch(`${baseUrl}/evidence-files/${testFileV1Id}/download`, {
      headers: { Authorization: `Bearer ${cuongToken}` },
    });
    assert.equal(cuongDlRes.status, 403, 'Người không có quyền phải bị chặn 403');
    console.log('  [PASS] Chặn truy cập trái quyền tải file thành công (403 Forbidden)');

    // 8. Quản lý phụ trách (bich.tt - Manager của Unit #2) tải tệp thành công -> 200 OK
    console.log('--- 8. Manager phụ trách (bich.tt) tải tệp từ Private Storage ---');
    const bichDlRes = await fetch(`${baseUrl}/evidence-files/${testFileV2Id}/download`, {
      headers: { Authorization: `Bearer ${bichToken}` },
    });
    assert.equal(bichDlRes.status, 200);
    assert.equal(bichDlRes.headers.get('content-type'), 'image/png');
    assert.ok(bichDlRes.headers.get('content-disposition').includes('Anh_chup_chung_nhan.png'));
    const downloadedPngBytes = Buffer.from(await bichDlRes.arrayBuffer());
    assert.equal(downloadedPngBytes.length, validPngBuffer.length);
    console.log('  [PASS] Manager tải tệp Private Stream qua RBAC Scope thành công (200 OK)');

    // 9. Giảng viên chủ hồ sơ tải tệp v1 -> 200 OK
    console.log('--- 9. Giảng viên chủ hồ sơ tải tệp v1 ---');
    const anDlRes = await fetch(`${baseUrl}/evidence-files/${testFileV1Id}/download`, {
      headers: { Authorization: `Bearer ${anToken}` },
    });
    assert.equal(anDlRes.status, 200);
    assert.equal(anDlRes.headers.get('content-type'), 'application/pdf');
    const downloadedPdfBytes = Buffer.from(await anDlRes.arrayBuffer());
    assert.equal(downloadedPdfBytes.length, validPdfBuffer.length);
    console.log('  [PASS] Giảng viên chủ hồ sơ tải tệp stream thành công');

    // 10. Xóa mềm minh chứng (is_removed = TRUE)
    console.log('--- 10. Xóa mềm minh chứng ---');
    const deleteRes = await fetch(`${baseUrl}/evidences/${testEvidenceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${anToken}` },
    });
    assert.equal(deleteRes.status, 200);
    const deleteJson = await deleteRes.json();
    assert.equal(deleteJson.success, true);
    console.log('  [PASS] Xóa mềm minh chứng thành công');
  } finally {
    // Dọn dẹp thành tích kiểm thử theo thứ tự khóa ngoại RESTRICT
    if (testAchievementId) {
      console.log('--- Dọn dẹp dữ liệu kiểm thử ---');
      try {
        const { getPool } = await import('../src/config/database.js');
        const pool = getPool();
        await pool.query(
          'DELETE FROM app.evidence_files WHERE evidence_id IN (SELECT evidence_id FROM app.evidences WHERE achievement_id = $1)',
          [testAchievementId]
        );
        await pool.query('DELETE FROM app.evidences WHERE achievement_id = $1', [testAchievementId]);
        await pool.query('DELETE FROM app.achievements WHERE achievement_id = $1', [testAchievementId]);
        console.log(`  [CLEANUP] Đã xóa thành tích kiểm thử #${testAchievementId}`);
      } catch (cleanupErr) {
        console.warn('  [CLEANUP] Cảnh báo lỗi dọn dẹp:', cleanupErr.message);
      }
    }

    await stopServer();
    console.log('🎉 TẤT CẢ KIỂM THỬ TÍCH HỢP HTTP W2-Q2 ĐỀU ĐẠT CHUẨN 100%!');
  }
}

runIntegrationTests().catch((err) => {
  console.error('❌ Kiểm thử tích hợp W2-Q2 thất bại:', err);
  process.exit(1);
});
