/**
 * tests/e2e/helpers/fixtures.js
 * Domain fixtures for Smart Achievement Vault & Career Assistant E2E test suites.
 */

export const ROLES = {
  MEMBER: 'MEMBER',
  DEPARTMENT_HEAD: 'DEPARTMENT_HEAD',
  FACULTY_LEAD: 'FACULTY_LEAD',
  ADMIN: 'ADMIN',
};

export const USERS = {
  member: {
    userId: 1,
    username: 'an.nv',
    email: 'an.nv@lhu.edu.vn',
    displayName: 'PGS.TS. Nguyễn Văn An',
    roles: [ROLES.MEMBER],
    unitId: 2, // FIT_SE
    unitCode: 'FIT_SE',
    facultyCode: 'FIT',
  },
  departmentHead: {
    userId: 2,
    username: 'bich.tt',
    email: 'bich.tt@lhu.edu.vn',
    displayName: 'TS. Trần Thị Bích',
    roles: [ROLES.DEPARTMENT_HEAD, ROLES.MEMBER],
    unitId: 2, // Head of FIT_SE
    unitCode: 'FIT_SE',
    facultyCode: 'FIT',
  },
  facultyLead: {
    userId: 4,
    username: 'cuong.lh',
    email: 'cuong.lh@lhu.edu.vn',
    displayName: 'ThS. Lê Hùng Cường',
    roles: [ROLES.FACULTY_LEAD, ROLES.MEMBER],
    unitId: 1, // Dean of FIT
    unitCode: 'FIT',
    facultyCode: 'FIT',
  },
  admin: {
    userId: 3,
    username: 'duc.pm',
    email: 'duc.pm@lhu.edu.vn',
    displayName: 'ThS. Phan Minh Đức',
    roles: [ROLES.ADMIN],
    unitId: 100, // Trường LHU
    unitCode: 'LHU',
    facultyCode: null,
  },
};

export const ACHIEVEMENTS = {
  validPaperQ1: {
    title: 'Nghiên cứu ứng dụng Deep Learning trong phân loại ảnh y tế siêu âm',
    recognitionYear: 2025,
    type: 'JOURNAL_PAPER',
    category: 'SCIENTIFIC_RESEARCH',
    issueDate: '2025-06-15',
    issuer: 'Tạp chí IEEE Transactions on Medical Imaging (Q1)',
    decisionNumber: 'QD-IEEE-2025-089',
    evidenceFileUrl: 'https://storage.lhu.edu.vn/evidences/ieee_paper_2025.pdf',
    description: 'Bài báo ISI/Scopus nhóm Q1 đã xuất bản chính thức',
    status: 'ACTIVE',
  },
  validPatent: {
    title: 'Hệ thống tự động giám sát IoT cho phòng nuôi cấy mô thực vật',
    recognitionYear: 2025,
    type: 'PATENT',
    category: 'INNOVATION',
    issueDate: '2025-04-10',
    issuer: 'Cục Sở hữu Trí tuệ Việt Nam',
    decisionNumber: 'QD-SHTT-2025-1102',
    evidenceFileUrl: 'https://storage.lhu.edu.vn/evidences/patent_2025.pdf',
    description: 'Bằng độc quyền sáng chế giải pháp hữu ích cấp quốc gia',
    status: 'ACTIVE',
  },
  validTeachingAward: {
    title: 'Giải Nhất Giảng viên Dạy giỏi cấp Trường năm học 2024 - 2025',
    recognitionYear: 2025,
    type: 'TEACHING_AWARD',
    category: 'TEACHING',
    issueDate: '2025-11-20',
    issuer: 'Hiệu trưởng Trường Đại học Lạc Hồng',
    decisionNumber: '568/QD-DHLH',
    evidenceFileUrl: 'https://storage.lhu.edu.vn/evidences/gvdg_2025.pdf',
    description: 'Giấy chứng nhận giảng viên dạy giỏi cấp trường',
    status: 'ACTIVE',
  },
  invalidMissingTitle: {
    recognitionYear: 2025,
    issuer: 'Đại học Lạc Hồng',
  },
  invalidYearFuture: {
    title: 'Công trình tương lai',
    recognitionYear: 2099,
    issuer: 'LHU',
  },
};

export const OCR_FIXTURES = {
  validCertificateImage: {
    filename: 'bang_khen_thanh_tich_2025.png',
    mimeType: 'image/png',
    contentBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    extractedData: {
      title: 'Bằng khen Đạt thành tích xuất sắc trong công tác nghiên cứu khoa học năm 2025',
      recognitionYear: 2025,
      issueDate: '2025-11-15',
      issuer: 'Chủ tịch UBND Tỉnh Đồng Nai',
      decisionNumber: '1245/QD-UBND',
    },
  },
  validCertificatePdf: {
    filename: 'chung_chi_scopus_paper.pdf',
    mimeType: 'application/pdf',
    contentBase64: 'JVBERi0xLjQKJeLjz9MKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCg==',
    extractedData: {
      title: 'Chứng nhận công bố bài báo khoa học chuẩn Scopus Q2',
      recognitionYear: 2024,
      issueDate: '2024-09-01',
      issuer: 'Elsevier Scopus Indexing Board',
      decisionNumber: 'SCOPUS-2024-VN-908',
    },
  },
  unreadableBlurredImage: {
    filename: 'mo_khong_doc_duoc.jpg',
    mimeType: 'image/jpeg',
    contentBase64: '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    fallbackResponse: {
      success: true,
      data: null,
      fallback: true,
      message: 'Không thể nhận diện tự động văn bản từ hình ảnh. Bạn vui lòng tự nhập thông tin bằng tay.',
    },
  },
};

export const REGULATIONS = {
  chienthithidua: {
    id: 1,
    code: 'CSTD_CS_2025',
    name: 'Danh hiệu Chiến sĩ thi đua cấp cơ sở năm 2025',
    year: 2025,
    deadline: '2025-12-15T23:59:59Z',
    criteria: [
      {
        criterionId: 101,
        code: 'CRIT_TEACHING',
        name: 'Hoàn thành 100% định mức giảng dạy và đạt Lao động Tiên tiến',
        requiredCount: 1,
        unit: 'Lần',
      },
      {
        criterionId: 102,
        code: 'CRIT_RESEARCH_PAPER',
        name: 'Có ít nhất 01 bài báo khoa học công bố trên tạp chí chuyên ngành hoặc kỷ yếu hội thảo',
        requiredCount: 1,
        unit: 'Bài',
      },
      {
        criterionId: 103,
        code: 'CRIT_INNOVATION',
        name: 'Có ít nhất 01 sáng kiến cấp cơ sở hoặc giải pháp hữu ích được công nhận',
        requiredCount: 1,
        unit: 'Sáng kiến',
      },
    ],
  },
  giangvienxuatsac: {
    id: 2,
    code: 'GV_XUATSAC_2025',
    name: 'Giải thưởng Giảng viên Xuất sắc Toàn diện 2025',
    year: 2025,
    deadline: '2025-11-30T17:00:00Z',
    criteria: [
      {
        criterionId: 201,
        code: 'CRIT_Q1_PAPER',
        name: 'Công bố tối thiểu 02 bài báo quốc tế nhóm Q1/Q2',
        requiredCount: 2,
        unit: 'Bài',
      },
      {
        criterionId: 202,
        code: 'CRIT_EXCELLENCE_TEACHING',
        name: 'Đạt danh hiệu Giảng viên Dạy giỏi cấp Trường',
        requiredCount: 1,
        unit: 'Danh hiệu',
      },
      {
        criterionId: 203,
        code: 'CRIT_PATENT',
        name: 'Sở hữu 01 Bằng độc quyền sáng chế hoặc giải pháp hữu ích',
        requiredCount: 1,
        unit: 'Bằng',
      },
    ],
  },
};

export const KPI_FIXTURES = {
  sampleGap: {
    regulationId: 2,
    missingCriteria: [
      {
        code: 'CRIT_Q1_PAPER',
        name: 'Công bố tối thiểu 02 bài báo quốc tế nhóm Q1/Q2',
        missingCount: 1,
        unit: 'Bài',
      },
    ],
  },
  sampleGoalCreated: {
    kpiGoalId: 901,
    title: 'Bổ sung: Công bố tối thiểu 02 bài báo quốc tế nhóm Q1/Q2',
    targetValue: 1,
    unit: 'Bài',
    source: 'AI_GAP',
    sourceNote: 'Chuyển đổi tự động từ thiếu hụt tiêu chí Giải thưởng Giảng viên Xuất sắc Toàn diện 2025',
    status: 'IN_PROGRESS',
    year: 2025,
  },
};

export const CALENDAR_FIXTURES = {
  reminderRequest: {
    title: 'Hạn chót nộp hồ sơ xét tặng Chiến sĩ thi đua cấp cơ sở',
    deadlineDate: '2025-12-15T17:00:00Z',
    regulationId: 1,
    reminderDaysBefore: 3,
    notes: 'Kiểm tra và xuất gói minh chứng ZIP trước ngày nộp 3 ngày.',
  },
};

export const CV_FIXTURES = {
  profileDraft: {
    slug: 'nguyen-van-an',
    templateId: 'Modern',
    isPublic: true,
    headline: 'Phó Giáo sư, Tiến sĩ Khoa học Máy tính - ĐH Lạc Hồng',
    bio: 'Chuyên gia nghiên cứu Trí tuệ Nhân tạo, Thị giác máy tính và Học sâu y tế.',
    contact: {
      phone: '0901234567',
      email: 'an.nv@lhu.edu.vn',
      address: 'Số 10 Huỳnh Văn Nghệ, P. Bửu Long, TP. Biên Hòa, Đồng Nai',
    },
    selectedAchievementIds: [1, 2, 3],
  },
  privateProfileDraft: {
    slug: 'tran-thi-bich',
    templateId: 'Academic',
    isPublic: false,
    headline: 'Trưởng Bộ môn Kỹ thuật Phần mềm',
    bio: 'Nghiên cứu kiến trúc hệ thống và kiểm thử phần mềm.',
  },
};

export const ORG_TREE = {
  root: {
    unitId: 100,
    code: 'LHU',
    name: 'Trường Đại học Lạc Hồng',
    type: 'UNIVERSITY',
    children: [
      {
        unitId: 1,
        code: 'FIT',
        name: 'Khoa Công nghệ Thông tin',
        type: 'FACULTY',
        parentId: 100,
        children: [
          {
            unitId: 2,
            code: 'FIT_SE',
            name: 'Bộ môn Kỹ thuật Phần mềm',
            type: 'DEPARTMENT',
            parentId: 1,
            members: [USERS.member, USERS.departmentHead],
          },
          {
            unitId: 3,
            code: 'FIT_CS',
            name: 'Bộ môn Khoa học Máy tính',
            type: 'DEPARTMENT',
            parentId: 1,
            members: [],
          },
        ],
      },
      {
        unitId: 4,
        code: 'PHARM',
        name: 'Khoa Dược',
        type: 'FACULTY',
        parentId: 100,
        children: [],
      },
    ],
  },
};
