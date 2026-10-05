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
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await closeDB();
}

async function runIntegrationTests() {
  console.log('🚀 Bắt đầu kiểm thử tích hợp HTTP cho W2-Q3 (Snapshot, Lịch sử, Transaction, Concurrency 409 & Khóa VERIFIED)...');
  await startServer();

  try {
    // 1. Thiết lập tài khoản và tokens
    console.log('--- 1. Thiết lập tài khoản kiểm thử ---');
    const anToken = generateAccessToken({ userId: 1, username: 'an.nv', email: 'an.nv@lhu.edu.vn', roles: ['LECTURER'] });
    const bichToken = generateAccessToken({ userId: 2, username: 'bich.tt', email: 'bich.tt@lhu.edu.vn', roles: ['MANAGER', 'LECTURER'] });
    const cuongToken = generateAccessToken({ userId: 4, username: 'cuong.lh', email: 'cuong.lh@lhu.edu.vn', roles: ['UNIT_REPRESENTATIVE', 'LECTURER'] });

    // 2. Demo Luồng Cá nhân: Tạo -> Thử nộp không file (400) -> Đính file -> Nộp (Snapshot/History) -> Quản lý duyệt (VERIFIED)
    console.log('--- 2. Luồng Cá nhân Giảng viên: Tạo -> Nộp có Snapshot -> Quản lý Thẩm định ---');
    const createAchRes = await fetch(`${baseUrl}/achievements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anToken}`,
      },
      body: JSON.stringify({
        subjectType: 'LECTURER',
        achievementTypeId: 1,
        title: 'Công bố bài báo Q1 AI trong Y tế - W2-Q3 Test',
        recognitionYear: 2026,
        description: 'Bài báo nghiên cứu quốc tế thuộc danh mục ISI/Scopus Q1',
        contributionRole: 'Tác giả chính',
      }),
    });
    assert.equal(createAchRes.status, 201);
    const achData = await createAchRes.json();
    const personalAchId = achData.data.achievementId;
    console.log(`  [PASS] Đã tạo bản nháp thành tích cá nhân #${personalAchId}, status: DRAFT, version: ${achData.data.version}`);

    // Thử nộp khi chưa có tệp minh chứng -> Bắt buộc 400 Bad Request
    const submitNoFileRes = await fetch(`${baseUrl}/achievements/${personalAchId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anToken}`,
      },
      body: JSON.stringify({ version: achData.data.version }),
    });
    assert.equal(submitNoFileRes.status, 400);
    const submitNoFileData = await submitNoFileRes.json();
    assert.match(submitNoFileData.error.message, /ít nhất một minh chứng/);
    console.log('  [PASS] Chặn nộp hồ sơ khi thiếu file minh chứng (400 Bad Request)');

    // Đính kèm 1 file PDF hợp lệ
    const validPdfBuffer = Buffer.from('%PDF-1.4\n%Valid paper evidence content for W2-Q3 testing.');
    const formData = new FormData();
    formData.append('title', 'Bản in bài báo xuất bản (Accepted Manuscript)');
    formData.append('description', 'Minh chứng tệp PDF có chữ ký số tòa soạn');
    formData.append(
      'file',
      new Blob([validPdfBuffer], { type: 'application/pdf' }),
      'Bai_bao_Q1_Y_te.pdf'
    );

    const uploadRes = await fetch(`${baseUrl}/achievements/${personalAchId}/evidences`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${anToken}` },
      body: formData,
    });
    assert.equal(uploadRes.status, 201);
    const uploadedData = await uploadRes.json();
    const evidenceId = uploadedData.data.evidenceId;
    console.log(`  [PASS] Đã tải lên minh chứng #${evidenceId} cho hồ sơ #${personalAchId}`);

    // Nộp thẩm định với version = 1
    const submitRes = await fetch(`${baseUrl}/achievements/${personalAchId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anToken}`,
      },
      body: JSON.stringify({ version: 1, submitNote: 'Kính gửi Trưởng khoa phê duyệt bài báo Q1 đợt 1/2026' }),
    });
    assert.equal(submitRes.status, 200);
    const submittedAch = await submitRes.json();
    assert.equal(submittedAch.data.status, 'SUBMITTED');
    assert.equal(submittedAch.data.version, 2);
    console.log(`  [PASS] Nộp thành công: status chuyển sang SUBMITTED, version tăng lên ${submittedAch.data.version}`);

    // Kiểm tra Snapshot và Lịch sử của hồ sơ
    const subListRes = await fetch(`${baseUrl}/achievements/${personalAchId}/submissions`, {
      headers: { Authorization: `Bearer ${anToken}` },
    });
    assert.equal(subListRes.status, 200);
    const subListData = await subListRes.json();
    assert.equal(subListData.data.submissions.length, 1);
    const firstSub = subListData.data.submissions[0];
    assert.equal(firstSub.revisionNo, 1);
    assert.equal(firstSub.snapshotData.title, 'Công bố bài báo Q1 AI trong Y tế - W2-Q3 Test');
    assert.ok(firstSub.snapshotData.evidences.length >= 1);
    console.log(`  [PASS] Đã ghi nhận Snapshot lần nộp #1, đóng băng phiên bản tệp: ${firstSub.snapshotData.evidences[0].file.originalFileName}`);

    const historyRes = await fetch(`${baseUrl}/achievements/${personalAchId}/history`, {
      headers: { Authorization: `Bearer ${anToken}` },
    });
    assert.equal(historyRes.status, 200);
    const historyData = await historyRes.json();
    assert.ok(historyData.data.histories.some((h) => h.fromStatus === 'DRAFT' && h.toStatus === 'SUBMITTED'));
    console.log('  [PASS] Lịch sử trạng thái (DRAFT -> SUBMITTED) đã được lưu trữ trong pg client transaction');

    // Quản lý Bích (Khoa CNTT) thẩm định và phê duyệt (VERIFY)
    const verifyRes = await fetch(`${baseUrl}/achievements/${personalAchId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bichToken}`,
      },
      body: JSON.stringify({ version: 2, note: 'Hồ sơ chuẩn chỉ, đã đối chiếu Scopus đạt Q1' }),
    });
    assert.equal(verifyRes.status, 200);
    const verifiedAch = await verifyRes.json();
    assert.equal(verifiedAch.data.status, 'VERIFIED');
    assert.equal(verifiedAch.data.version, 3);
    assert.equal(verifiedAch.data.verifiedBy, 2);
    console.log(`  [PASS] Quản lý phê duyệt thành công: status = VERIFIED, version = ${verifiedAch.data.version}, verifiedBy = 2`);

    // 3. Kiểm tra tính Bất biến của VERIFIED (Khóa sửa nội dung & Khóa tệp minh chứng)
    console.log('--- 3. Kiểm tra tính Bất biến khi hồ sơ đã VERIFIED (Immutability) ---');
    // Thử sửa thông tin tiêu đề -> 409
    const editRes = await fetch(`${baseUrl}/achievements/${personalAchId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anToken}`,
      },
      body: JSON.stringify({
        title: 'Cố tình sửa tiêu đề sau khi đã VERIFIED',
        version: 3,
        achievementTypeId: 1,
        recognitionYear: 2026,
      }),
    });
    assert.equal(editRes.status, 409);
    console.log('  [PASS] Chặn cập nhật nội dung thành tích khi đã VERIFIED (409 Conflict)');

    // Thử thêm tệp minh chứng mới -> 409
    const newFileFormData = new FormData();
    newFileFormData.append('title', 'Minh chứng bổ sung trái phép');
    newFileFormData.append('file', new Blob([validPdfBuffer], { type: 'application/pdf' }), 'Illegal.pdf');
    const uploadLockedRes = await fetch(`${baseUrl}/achievements/${personalAchId}/evidences`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${anToken}` },
      body: newFileFormData,
    });
    assert.equal(uploadLockedRes.status, 409);
    console.log('  [PASS] Chặn tải lên minh chứng mới khi hồ sơ đã VERIFIED (409 Conflict)');

    // Thử xóa minh chứng -> 409
    const deleteEvidenceRes = await fetch(`${baseUrl}/evidences/${evidenceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${anToken}` },
    });
    assert.equal(deleteEvidenceRes.status, 409);
    console.log('  [PASS] Chặn xóa minh chứng khi hồ sơ đã VERIFIED (409 Conflict)');

    // 4. Kiểm tra Quy chế Liêm chính Cấm Tự Duyệt (Anti-Self-Approval -> 403)
    console.log('--- 4. Kiểm tra Quy chế Liêm chính Cấm Tự Duyệt (Anti-Self-Approval -> 403) ---');
    // Trưởng khoa Bích tự tạo thành tích cá nhân của chính mình
    const createBichAchRes = await fetch(`${baseUrl}/achievements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bichToken}`,
      },
      body: JSON.stringify({
        subjectType: 'LECTURER',
        achievementTypeId: 1,
        title: 'Đề tài cấp Tỉnh của Trưởng khoa Bích - W2-Q3 Test',
        recognitionYear: 2026,
        description: 'Đề tài NCKH do Trưởng khoa Bích làm chủ nhiệm',
      }),
    });
    assert.equal(createBichAchRes.status, 201);
    const bichAch = await createBichAchRes.json();
    const bichAchId = bichAch.data.achievementId;

    // Đính kèm file và nộp
    const uploadBichRes = await fetch(`${baseUrl}/achievements/${bichAchId}/evidences`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bichToken}` },
      body: formData,
    });
    assert.equal(uploadBichRes.status, 201);

    const submitBichRes = await fetch(`${baseUrl}/achievements/${bichAchId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bichToken}`,
      },
      body: JSON.stringify({ version: 1 }),
    });
    assert.equal(submitBichRes.status, 200);

    // Trưởng khoa Bích cố tình tự duyệt hồ sơ của chính mình -> 403 SELF_APPROVAL_PROHIBITED
    const selfApproveRes = await fetch(`${baseUrl}/achievements/${bichAchId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bichToken}`,
      },
      body: JSON.stringify({ version: 2, note: 'Tự duyệt hồ sơ' }),
    });
    assert.equal(selfApproveRes.status, 403);
    const selfApproveData = await selfApproveRes.json();
    assert.equal(selfApproveData.error.code, 'SELF_APPROVAL_PROHIBITED');
    console.log(`  [PASS] Cấm tự duyệt thành công: HTTP 403, code: ${selfApproveData.error.code}`);

    // 5. Kiểm tra Hai Request Cạnh Tranh (Concurrency 409 Conflict)
    console.log('--- 5. Kiểm tra Hai Request Cạnh Tranh (OCC Concurrency Conflict -> 409) ---');
    // Tạo hồ sơ cá nhân mới để thử nghiệm concurrency
    const createOccAchRes = await fetch(`${baseUrl}/achievements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anToken}`,
      },
      body: JSON.stringify({
        subjectType: 'LECTURER',
        achievementTypeId: 1,
        title: 'Hồ sơ kiểm thử xung đột đồng thời - W2-Q3',
        recognitionYear: 2026,
      }),
    });
    const occAch = (await createOccAchRes.json()).data;
    await fetch(`${baseUrl}/achievements/${occAch.achievementId}/evidences`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${anToken}` },
      body: formData,
    });
    const occSubmitted = (
      await (
        await fetch(`${baseUrl}/achievements/${occAch.achievementId}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anToken}`,
          },
          body: JSON.stringify({ version: 1 }),
        })
      ).json()
    ).data;

    // Hai request gửi cùng lúc với cùng version = 2
    console.log(`  Hồ sơ #${occAch.achievementId} hiện ở version: ${occSubmitted.version}`);
    const [reqA, reqB] = await Promise.all([
      fetch(`${baseUrl}/achievements/${occAch.achievementId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bichToken}`,
        },
        body: JSON.stringify({ version: 2, note: 'Reviewer A duyệt' }),
      }),
      fetch(`${baseUrl}/achievements/${occAch.achievementId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bichToken}`,
        },
        body: JSON.stringify({ version: 2, note: 'Reviewer B duyệt' }),
      }),
    ]);

    const statuses = [reqA.status, reqB.status].sort();
    assert.deepEqual(statuses, [200, 409], 'Trong hai request cạnh tranh, bắt buộc 1 request thành công (200) và 1 request nhận 409 Conflict');
    console.log('  [PASS] Hai request cạnh tranh: Một request thành công (200), request còn lại trả về 409 CONCURRENCY_CONFLICT');

    // 6. Luồng Tập thể (Đại diện đơn vị nộp -> Quản lý xác nhận)
    console.log('--- 6. Luồng Tập thể (Đại diện Đơn vị nộp -> Quản lý thẩm định) ---');
    const createUnitAchRes = await fetch(`${baseUrl}/achievements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cuongToken}`,
      },
      body: JSON.stringify({
        subjectType: 'UNIT',
        organizationUnitId: 2, // Khoa CNTT
        achievementTypeId: 2,
        title: 'Giải Nhất Hội thi Sáng tạo Kỹ thuật Tập thể Khoa CNTT 2026',
        recognitionYear: 2026,
        description: 'Thành tích tập thể xuất sắc toàn trường',
      }),
    });
    assert.equal(createUnitAchRes.status, 201);
    const unitAch = (await createUnitAchRes.json()).data;
    console.log(`  [PASS] Đại diện đơn vị đã tạo thành tích tập thể #${unitAch.achievementId}`);

    // Đính kèm minh chứng cho tập thể
    await fetch(`${baseUrl}/achievements/${unitAch.achievementId}/evidences`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cuongToken}` },
      body: formData,
    });

    // Đại diện đơn vị nộp duyệt
    const submitUnitRes = await fetch(`${baseUrl}/achievements/${unitAch.achievementId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cuongToken}`,
      },
      body: JSON.stringify({ version: 1, submitNote: 'Đại diện đơn vị nộp hồ sơ tập thể Khoa CNTT' }),
    });
    assert.equal(submitUnitRes.status, 200);
    const unitSubmitted = (await submitUnitRes.json()).data;
    assert.equal(unitSubmitted.status, 'SUBMITTED');
    console.log(`  [PASS] Nộp hồ sơ tập thể thành công: status = SUBMITTED, version = ${unitSubmitted.version}`);

    // Quản lý Bích xác nhận thành tích tập thể (Cường là người tạo/nộp, Bích là quản lý -> hợp lệ)
    const verifyUnitRes = await fetch(`${baseUrl}/achievements/${unitAch.achievementId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bichToken}`,
      },
      body: JSON.stringify({ version: unitSubmitted.version, note: 'Xác nhận thành tích tập thể đạt chuẩn thi đua' }),
    });
    assert.equal(verifyUnitRes.status, 200);
    const unitVerified = (await verifyUnitRes.json()).data;
    assert.equal(unitVerified.status, 'VERIFIED');
    console.log(`  [PASS] Quản lý xác nhận hồ sơ tập thể thành công: status = VERIFIED, version = ${unitVerified.version}`);

    console.log('\n🎉 TẤT CẢ KIỂM THỬ TÍCH HỢP W2-Q3 ĐỀU ĐẠT CHUẨN XUẤT SẮC (PASSED)!');
  } finally {
    await stopServer();
  }
}

runIntegrationTests().catch((err) => {
  console.error('❌ Kiểm thử tích hợp W2-Q3 thất bại:', err);
  process.exit(1);
});
