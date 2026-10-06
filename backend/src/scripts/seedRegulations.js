import crypto from 'crypto';
import { connectDB } from '../config/database.js';

function computeSha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export async function seedRegulations() {
  const pool = await connectDB();
  const client = await pool.connect();
  try {
    console.log('🌱 Bắt đầu nạp dữ liệu Quy định & Tiêu chí khen thưởng W3-Q2...');

    // Lấy user admin (VD: quangttv hoặc user_id 1)
    const adminUserRes = await client.query(
      `SELECT user_id FROM app.users ORDER BY user_id ASC LIMIT 1`
    );
    const adminUserId = adminUserRes.rows[0]?.user_id || 1;

    // 1. Văn bản 1: VN-LAW-002 (Luật 06/2026/QH16)
    const lawRes = await client.query(
      `INSERT INTO app.regulation_documents (document_code, title, issuing_authority, document_type, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (document_code) DO UPDATE SET title = EXCLUDED.title
       RETURNING document_id`,
      [
        'VN-LAW-002',
        'Luật số 06/2026/QH16 - Luật Thi đua, Khen thưởng (sửa đổi)',
        'Quốc hội nước CHXHCN Việt Nam',
        'LAW',
        'Văn bản luật quy định về nguyên tắc, thẩm quyền và danh hiệu thi đua cấp Nhà nước và Bộ ngành'
      ]
    );
    const lawDocId = lawRes.rows[0].document_id;

    const lawVerRes = await client.query(
      `INSERT INTO app.regulation_document_versions (
         document_id, version_number, sha256_hash, source_url, signed_date,
         effective_from, is_official, is_confirmed, lhu_application_status, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (document_id, version_number) DO UPDATE SET sha256_hash = EXCLUDED.sha256_hash
       RETURNING version_id`,
      [
        lawDocId,
        '06/2026/QH16, 23/04/2026',
        '3e25d80b3549136a2b80e8b9487ddf9f06108925e57424c976196a1998ee4105',
        'https://datafiles.chinhphu.vn/cpp/files/vbpq/2026/5/06-qh.signed.pdf',
        '2026-04-23',
        '2026-10-01',
        true,
        false, // Chưa xác nhận LHU
        'INTERNAL_CRITERIA_UNCONFIRMED',
        adminUserId
      ]
    );
    const lawVerId = lawVerRes.rows[0].version_id;

    // Chunks cho Luật 06
    const lawChunks = [
      { article: 'Điều 3', clause: 'Khoản 1', page: 14, content: 'Nguyên tắc khen thưởng: Chính xác, công khai, minh bạch, kịp thời; một hình thức khen thưởng có thể tặng nhiều lần cho một đối tượng; không tặng thưởng nhiều hình thức cho một thành tích đạt được.' },
      { article: 'Điều 4', clause: 'Khoản 1', page: 14, content: 'Căn cứ xét tặng danh hiệu thi đua: Phong trào thi đua; Đăng ký tham gia thi đua; Thành tích đạt được trong phong trào thi đua; Tiêu chuẩn danh hiệu thi đua.' },
      { article: 'Điều 4', clause: 'Khoản 3', page: 15, content: 'Quy định về thời điểm tiếp nhận hồ sơ: Thời điểm cơ quan có thẩm quyền tiếp nhận hồ sơ hợp lệ là căn cứ xác định áp dụng quy định pháp luật tương ứng.' },
      { article: 'Điều 4', clause: 'Khoản 4', page: 15, content: 'Quy định chuyển tiếp: Trường hợp quy định mới ban hành có điều kiện áp dụng thuận lợi hơn cho cá nhân, tập thể thì được áp dụng theo quy định mới.' }
    ];
    for (const c of lawChunks) {
      const hash = computeSha256(`${c.article}:${c.clause}:${c.content}`);
      await client.query(
        `INSERT INTO app.regulation_chunks (version_id, article_no, clause_no, page_no, content, chunk_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [lawVerId, c.article, c.clause, c.page, c.content, hash]
      );
    }

    // 2. Văn bản 2: VN-EDU-001 (Thông tư 07/2026/TT-BGDĐT)
    const eduRes = await client.query(
      `INSERT INTO app.regulation_documents (document_code, title, issuing_authority, document_type, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (document_code) DO UPDATE SET title = EXCLUDED.title
       RETURNING document_id`,
      [
        'VN-EDU-001',
        'Thông tư 07/2026/TT-BGDĐT - Hướng dẫn công tác thi đua, khen thưởng ngành Giáo dục',
        'Bộ Giáo dục và Đào tạo',
        'CIRCULAR',
        'Thông tư hướng dẫn chi tiết các tiêu chuẩn danh hiệu thi đua đối với viên chức, giảng viên ngành giáo dục'
      ]
    );
    const eduDocId = eduRes.rows[0].document_id;

    const eduVerRes = await client.query(
      `INSERT INTO app.regulation_document_versions (
         document_id, version_number, sha256_hash, source_url, signed_date,
         effective_from, is_official, is_confirmed, lhu_application_status, created_by, confirmation_notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (document_id, version_number) DO UPDATE SET sha256_hash = EXCLUDED.sha256_hash
       RETURNING version_id`,
      [
        eduDocId,
        '07/2026/TT-BGDĐT, 15/02/2026',
        '91c663da7cbd340244a6cae33513727efbaecd6c9873e15654b8f9f0ce0aea5d',
        'https://xdcs.cdnchinhphu.vn/446259493575335936/2026/3/3/07-2026-tt-bgddt-signed-9952f-17725329618222113655448.pdf',
        '2026-02-15',
        '2026-04-02',
        true,
        false, // Chưa xác nhận bộ tiêu chí nội bộ LHU
        'INTERNAL_CRITERIA_UNCONFIRMED',
        adminUserId,
        'PDF scan có chỗ trống số/ngày ở header trang 1; nhận diện phiên bản qua trang công bố và metadata VBPL. Chưa xác nhận bộ tiêu chí nội bộ LHU.'
      ]
    );
    const eduVerId = eduVerRes.rows[0].version_id;

    // Chunks cho Thông tư 07
    const eduChunks = [
      { article: 'Điều 2', clause: 'Khoản 1', page: 1, content: 'Đối tượng áp dụng: Cán bộ quản lý, giảng viên, giáo viên, nhân viên và người học trong các cơ sở giáo dục đại học, cao đẳng sư phạm.' },
      { article: 'Điều 3', clause: 'Khoản 1-3', page: 2, content: 'Tiêu chuẩn danh hiệu Lao động tiên tiến: Hoàn thành tốt nhiệm vụ được giao; Đạt năng suất, chất lượng cao; Chấp hành tốt chủ trương chính sách.' },
      { article: 'Điều 30', clause: 'Khoản 3', page: 3, content: 'Thẩm quyền của Hội đồng Thi đua - Khen thưởng cơ sở: Tham mưu cho Hiệu trưởng xét tặng danh hiệu và đề nghị cấp trên khen thưởng.' },
      { article: 'Điều 31', clause: 'Khoản 1-2', page: 22, content: 'Hồ sơ đề nghị khen thưởng: Tờ trình, Báo cáo thành tích, Biên bản họp bình xét của Hội đồng và các minh chứng kèm theo.' },
      { article: 'Điều 32', clause: 'Khoản 1', page: 22, content: 'Điều khoản chuyển tiếp: Các sáng kiến, giáo trình, công trình khoa học được nghiệm thu trước thời điểm Thông tư có hiệu lực vẫn được tính điểm theo quy chế hiện hành.' }
    ];
    for (const c of eduChunks) {
      const hash = computeSha256(`${c.article}:${c.clause}:${c.content}`);
      await client.query(
        `INSERT INTO app.regulation_chunks (version_id, article_no, clause_no, page_no, content, chunk_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [eduVerId, c.article, c.clause, c.page, c.content, hash]
      );
    }

    // 3. Văn bản 3: W1-P4-SIMULATION (Mô phỏng KPI Demo)
    const simRes = await client.query(
      `INSERT INTO app.regulation_documents (document_code, title, issuing_authority, document_type, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (document_code) DO UPDATE SET title = EXCLUDED.title
       RETURNING document_id`,
      [
        'W1-P4-SIMULATION',
        'Bộ tiêu chí mô phỏng KPI và Khung xét thưởng Demo W1-P4',
        'Tổ phát triển dự án PTUD (Mô phỏng nội bộ)',
        'GUIDELINE',
        'Tài liệu mô phỏng dùng riêng cho kiểm thử và UI demo; chưa phải quy chế chính thức của Trường Đại học Lạc Hồng'
      ]
    );
    const simDocId = simRes.rows[0].document_id;

    const simVerRes = await client.query(
      `INSERT INTO app.regulation_document_versions (
         document_id, version_number, sha256_hash, source_url,
         effective_from, is_official, is_confirmed, lhu_application_status, created_by, confirmation_notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (document_id, version_number) DO UPDATE SET sha256_hash = EXCLUDED.sha256_hash
       RETURNING version_id`,
      [
        simDocId,
        'bb6eb73-W1-P4',
        computeSha256('W1-P4-SIMULATION:bb6eb73:2026-10-01'),
        'docs/ai/BUSINESS_CONFIRMATION_W1_P4.md',
        '2026-10-01',
        false,
        false, // Mô phỏng - không duyệt thành LHU policy
        'SIMULATION_ONLY',
        adminUserId,
        'Nguồn mô phỏng phục vụ demo; chưa có quyết định áp dụng chính thức từ LHU'
      ]
    );
    const simVerId = simVerRes.rows[0].version_id;

    // Chunks cho bản mô phỏng
    const simChunks = [
      { article: 'Mục tiêu 1', clause: 'KPI Giáo trình', page: 1, content: 'Chuẩn bị 02 bản ghi giáo trình có minh chứng trước hạn demo' },
      { article: 'Mục tiêu 2', clause: 'KPI Hướng dẫn', page: 1, content: 'Ghi nhận hoạt động hướng dẫn 03 học viên/nghiên cứu sinh' },
      { article: 'Mục tiêu 3', clause: 'KPI Nghiên cứu', page: 1, content: 'Hoàn thiện 01 hồ sơ thành tích nghiên cứu để gửi thẩm định' },
      { article: 'Mục tiêu 4', clause: 'KPI Hội đồng', page: 1, content: 'Rà soát 100% trường bắt buộc của hồ sơ hội đồng demo' }
    ];
    for (const c of simChunks) {
      const hash = computeSha256(`${c.article}:${c.clause}:${c.content}`);
      await client.query(
        `INSERT INTO app.regulation_chunks (version_id, article_no, clause_no, page_no, content, chunk_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [simVerId, c.article, c.clause, c.page, c.content, hash]
      );
    }

    // 4. Nạp 4 Tiêu chí Khen thưởng (AwardCriteriaVersions)
    const criteria = [
      {
        code: 'SIM-KPI-01',
        name: 'Chuẩn bị 02 bản ghi giáo trình có minh chứng trước hạn demo',
        targetType: 'INDIVIDUAL',
        minThreshold: 2,
        unitMetric: 'giáo trình',
        legalReferences: 'VN-EDU-001: Điều 2, Điều 3, Điều 32; không quy định ngưỡng 02 giáo trình',
        notes: 'Mô phỏng demo W1-P4 (LHU_UNCONFIRMED). Yêu cầu đối chiếu bản gốc trước khi xét thưởng.',
        isConfirmed: false
      },
      {
        code: 'SIM-KPI-02',
        name: 'Ghi nhận hoạt động hướng dẫn 03 học viên/nghiên cứu sinh',
        targetType: 'INDIVIDUAL',
        minThreshold: 3,
        unitMetric: 'người học',
        legalReferences: 'VN-EDU-001: Điều 2; không quy định ngưỡng 03 người học',
        notes: 'Mô phỏng demo W1-P4 (LHU_UNCONFIRMED). Chưa có API chuyên biệt về hướng dẫn.',
        isConfirmed: false
      },
      {
        code: 'SIM-KPI-03',
        name: 'Hoàn thiện 01 hồ sơ thành tích nghiên cứu để gửi thẩm định',
        targetType: 'INDIVIDUAL',
        minThreshold: 1,
        unitMetric: 'hồ sơ',
        legalReferences: 'VN-LAW-002: Điều 3 khoản 1, Điều 4 khoản 1 và khoản 4',
        notes: 'Mô phỏng demo W1-P4 (LHU_UNCONFIRMED). Cần xác nhận nội dung và người thẩm định hợp lệ.',
        isConfirmed: false
      },
      {
        code: 'SIM-KPI-04',
        name: 'Rà soát 100% trường bắt buộc của hồ sơ hội đồng demo',
        targetType: 'COLLECTIVE',
        minThreshold: 100,
        unitMetric: '%',
        legalReferences: 'VN-EDU-001: Điều 30 khoản 3, Điều 31 khoản 1, Điều 32 khoản 1',
        notes: 'Mô phỏng demo W1-P4 (LHU_UNCONFIRMED). Mẫu hội đồng hiện hành chưa được LHU cung cấp.',
        isConfirmed: false
      }
    ];

    for (const cr of criteria) {
      await client.query(
        `INSERT INTO app.award_criteria_versions (
           version_id, criterion_code, name, target_type, min_threshold,
           unit_metric, legal_references, is_confirmed, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (version_id, criterion_code) DO UPDATE
         SET name = EXCLUDED.name,
             legal_references = EXCLUDED.legal_references,
             notes = EXCLUDED.notes`,
        [
          simVerId,
          cr.code,
          cr.name,
          cr.targetType,
          cr.minThreshold,
          cr.unitMetric,
          cr.legalReferences,
          cr.isConfirmed,
          cr.notes
        ]
      );
    }

    console.log('✅ Đã nạp thành công 3 văn bản quy định, 13 chunks và 4 tiêu chí khen thưởng vào CSDL!');
  } finally {
    client.release();
  }
}

// Chạy trực tiếp nếu gọi từ CLI
if (process.argv[1]?.includes('seedRegulations.js')) {
  seedRegulations()
    .then(() => {
      console.log('🎉 Hoàn tất script seedRegulations!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Lỗi nạp dữ liệu:', err);
      process.exit(1);
    });
}
