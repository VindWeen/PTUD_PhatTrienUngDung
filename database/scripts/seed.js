import { bcrypt } from '../../backend/src/utils/crypto.js';
import { sql } from '../../backend/src/config/database.js';
import config from '../../backend/src/config/env.js';

function getDbConfig() {
  return {
    server: config.DB_SERVER,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    options: {
      encrypt: config.DB_ENCRYPT,
      trustServerCertificate: config.DB_TRUST_SERVER_CERTIFICATE,
      enableArithAbort: true,
    },
    connectionTimeout: config.DB_CONNECTION_TIMEOUT,
    requestTimeout: config.DB_REQUEST_TIMEOUT,
  };
}

export async function seedDatabase(customPool = null) {
  const pool = customPool || (await new sql.ConnectionPool(getDbConfig()).connect());
  const ownConnection = !customPool;

  try {
    console.log('🌱 Đang nạp dữ liệu mẫu (Seed Data) chuẩn hóa...');

    const tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

    try {
      const passwordHash = bcrypt.hashSync('demo1234', 10);

      // 1. Roles
      console.log('  - Nạp danh mục Roles...');
      await tx.request().query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Code = 'ADMIN')
          INSERT INTO dbo.Roles (Code, Name, Description, IsActive) VALUES ('ADMIN', N'Quản trị viên hệ thống', N'Quản lý toàn bộ cấu hình, tài khoản và danh mục', 1);
        IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Code = 'LECTURER')
          INSERT INTO dbo.Roles (Code, Name, Description, IsActive) VALUES ('LECTURER', N'Giảng viên', N'Kê khai và theo dõi hồ sơ thành tích cá nhân', 1);
        IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Code = 'UNIT_REPRESENTATIVE')
          INSERT INTO dbo.Roles (Code, Name, Description, IsActive) VALUES ('UNIT_REPRESENTATIVE', N'Đại diện đơn vị', N'Đại diện nộp hồ sơ thành tích tập thể', 1);
        IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Code = 'MANAGER')
          INSERT INTO dbo.Roles (Code, Name, Description, IsActive) VALUES ('MANAGER', N'Cán bộ quản lý / Thẩm định', N'Thẩm định và xác nhận thành tích trong phạm vi đơn vị', 1);
        IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Code = 'RECORDS_OFFICER')
          INSERT INTO dbo.Roles (Code, Name, Description, IsActive) VALUES ('RECORDS_OFFICER', N'Cán bộ quản lý hồ sơ khen thưởng', N'Nhập quyết định và ghi nhận kết quả khen thưởng', 1);
        IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Code = 'COUNCIL')
          INSERT INTO dbo.Roles (Code, Name, Description, IsActive) VALUES ('COUNCIL', N'Thành viên Hội đồng thi đua', N'Thẩm định hồ sơ thi đua khen thưởng cấp cao (KLTN)', 1);
      `);

      // 2. AcademicYears
      console.log('  - Nạp danh mục Năm học...');
      await tx.request().query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.AcademicYears WHERE Code = '2023-2024')
          INSERT INTO dbo.AcademicYears (Code, Name, StartDate, EndDate, IsCurrent, IsActive)
          VALUES ('2023-2024', N'Năm học 2023 - 2024', '2023-09-01', '2024-08-31', 0, 1);
        IF NOT EXISTS (SELECT 1 FROM dbo.AcademicYears WHERE Code = '2024-2025')
          INSERT INTO dbo.AcademicYears (Code, Name, StartDate, EndDate, IsCurrent, IsActive)
          VALUES ('2024-2025', N'Năm học 2024 - 2025', '2024-09-01', '2025-08-31', 1, 1);
      `);

      // 3. AchievementTypes
      console.log('  - Nạp danh mục Loại thành tích...');
      await tx.request().query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.AchievementTypes WHERE Code = 'RESEARCH_JOURNAL_Q1')
          INSERT INTO dbo.AchievementTypes (Code, Name, Description, ApplicableSubjectType, IsActive) 
          VALUES ('RESEARCH_JOURNAL_Q1', N'Bài báo quốc tế ISI/Scopus Q1', N'Công bố khoa học trên tạp chí thuộc phân hạng Q1', 'BOTH', 1);
        IF NOT EXISTS (SELECT 1 FROM dbo.AchievementTypes WHERE Code = 'RESEARCH_PATENT')
          INSERT INTO dbo.AchievementTypes (Code, Name, Description, ApplicableSubjectType, IsActive) 
          VALUES ('RESEARCH_PATENT', N'Bằng độc quyền sáng chế / Giải pháp hữu ích', N'Văn bằng bảo hộ sở hữu trí tuệ đã cấp bằng', 'BOTH', 1);
        IF NOT EXISTS (SELECT 1 FROM dbo.AchievementTypes WHERE Code = 'TEACHING_CURRICULUM')
          INSERT INTO dbo.AchievementTypes (Code, Name, Description, ApplicableSubjectType, IsActive) 
          VALUES ('TEACHING_CURRICULUM', N'Biên soạn giáo trình / Tài liệu giảng dạy', N'Giáo trình đại học đã nghiệm thu và phát hành', 'BOTH', 1);
      `);

      // 4. AwardTypes
      console.log('  - Nạp danh mục Loại khen thưởng...');
      await tx.request().query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.AwardTypes WHERE Code = 'CSTĐ_CS')
          INSERT INTO dbo.AwardTypes (Code, Name, Category, Level, ApplicableSubjectType, Description, IsActive)
          VALUES ('CSTĐ_CS', N'Chiến sĩ thi đua cơ sở', 'TITLE', 'UNIVERSITY', 'LECTURER', N'Danh hiệu thi đua cấp trường hàng năm', 1);
        IF NOT EXISTS (SELECT 1 FROM dbo.AwardTypes WHERE Code = 'BANG_KHEN_BGD')
          INSERT INTO dbo.AwardTypes (Code, Name, Category, Level, ApplicableSubjectType, Description, IsActive)
          VALUES ('BANG_KHEN_BGD', N'Bằng khen Bộ Giáo dục & Đào tạo', 'REWARD_FORM', 'MINISTRY', 'BOTH', N'Khen thưởng thành tích xuất sắc cấp Bộ', 1);
        IF NOT EXISTS (SELECT 1 FROM dbo.AwardTypes WHERE Code = 'TAP_THE_LĐXS')
          INSERT INTO dbo.AwardTypes (Code, Name, Category, Level, ApplicableSubjectType, Description, IsActive)
          VALUES ('TAP_THE_LĐXS', N'Tập thể Lao động Xuất sắc', 'TITLE', 'MINISTRY', 'UNIT', N'Danh hiệu thi đua tập thể hàng năm', 1);
      `);

      // 5. OrganizationUnits
      console.log('  - Nạp Cây đơn vị tổ chức...');
      await tx.request().query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.OrganizationUnits WHERE Code = 'FIT_LHU')
          INSERT INTO dbo.OrganizationUnits (Code, Name, Type, ParentId, Description, IsActive)
          VALUES ('FIT_LHU', N'Khoa Công nghệ Thông tin', 'FACULTY', NULL, N'Đào tạo và nghiên cứu khoa học công nghệ thông tin', 1);

        DECLARE @FacultyId BIGINT = (SELECT UnitId FROM dbo.OrganizationUnits WHERE Code = 'FIT_LHU');

        IF NOT EXISTS (SELECT 1 FROM dbo.OrganizationUnits WHERE Code = 'FIT_SE')
          INSERT INTO dbo.OrganizationUnits (Code, Name, Type, ParentId, Description, IsActive)
          VALUES ('FIT_SE', N'Bộ môn Kỹ thuật Phần mềm', 'DEPARTMENT', @FacultyId, N'Kỹ thuật phần mềm, hệ thống thông tin và di động', 1);

        IF NOT EXISTS (SELECT 1 FROM dbo.OrganizationUnits WHERE Code = 'FIT_AI')
          INSERT INTO dbo.OrganizationUnits (Code, Name, Type, ParentId, Description, IsActive)
          VALUES ('FIT_AI', N'Bộ môn Trí tuệ Nhân tạo & Khoa học Dữ liệu', 'DEPARTMENT', @FacultyId, N'Nghiên cứu học máy, thị giác máy tính và phân tích dữ liệu lớn', 1);
      `);

      // 6. Users & Lecturers
      console.log('  - Nạp Tài khoản người dùng mẫu (mật khẩu: demo1234)...');
      const userReq = new sql.Request(tx);
      userReq.input('PassHash', sql.VarChar(255), passwordHash);
      await userReq.query(`
        -- User 1: Giảng viên Nguyễn Văn An
        IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = 'an.nv')
          INSERT INTO dbo.Users (Username, Email, PasswordHash, DisplayName, Status)
          VALUES ('an.nv', 'an.nv@lhu.edu.vn', @PassHash, N'PGS.TS. Nguyễn Văn An', 'ACTIVE');

        -- User 2: Quản lý Trần Thị Bích (Trưởng khoa)
        IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = 'bich.tt')
          INSERT INTO dbo.Users (Username, Email, PasswordHash, DisplayName, Status)
          VALUES ('bich.tt', 'bich.tt@lhu.edu.vn', @PassHash, N'TS. Trần Thị Bích', 'ACTIVE');

        -- User 3: Đại diện đơn vị Lê Hoàng Cường
        IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = 'cuong.lh')
          INSERT INTO dbo.Users (Username, Email, PasswordHash, DisplayName, Status)
          VALUES ('cuong.lh', 'cuong.lh@lhu.edu.vn', @PassHash, N'ThS. Lê Hoàng Cường', 'ACTIVE');

        -- User 4: Quản trị viên / Cán bộ khen thưởng Phạm Minh Đức
        IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = 'duc.pm')
          INSERT INTO dbo.Users (Username, Email, PasswordHash, DisplayName, Status)
          VALUES ('duc.pm', 'duc.pm@lhu.edu.vn', @PassHash, N'ThS. Phạm Minh Đức', 'ACTIVE');

        DECLARE @UserAn BIGINT = (SELECT UserId FROM dbo.Users WHERE Username = 'an.nv');
        DECLARE @UserBich BIGINT = (SELECT UserId FROM dbo.Users WHERE Username = 'bich.tt');
        DECLARE @UserCuong BIGINT = (SELECT UserId FROM dbo.Users WHERE Username = 'cuong.lh');
        DECLARE @UserDuc BIGINT = (SELECT UserId FROM dbo.Users WHERE Username = 'duc.pm');

        DECLARE @RoleLecturer BIGINT = (SELECT RoleId FROM dbo.Roles WHERE Code = 'LECTURER');
        DECLARE @RoleManager BIGINT = (SELECT RoleId FROM dbo.Roles WHERE Code = 'MANAGER');
        DECLARE @RoleUnitRep BIGINT = (SELECT RoleId FROM dbo.Roles WHERE Code = 'UNIT_REPRESENTATIVE');
        DECLARE @RoleRecordsOfficer BIGINT = (SELECT RoleId FROM dbo.Roles WHERE Code = 'RECORDS_OFFICER');
        DECLARE @RoleAdmin BIGINT = (SELECT RoleId FROM dbo.Roles WHERE Code = 'ADMIN');

        -- Gán UserRoles
        IF NOT EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserId = @UserAn AND RoleId = @RoleLecturer)
          INSERT INTO dbo.UserRoles (UserId, RoleId, AssignedBy) VALUES (@UserAn, @RoleLecturer, @UserDuc);
        IF NOT EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserId = @UserBich AND RoleId = @RoleLecturer)
          INSERT INTO dbo.UserRoles (UserId, RoleId, AssignedBy) VALUES (@UserBich, @RoleLecturer, @UserDuc);
        IF NOT EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserId = @UserBich AND RoleId = @RoleManager)
          INSERT INTO dbo.UserRoles (UserId, RoleId, AssignedBy) VALUES (@UserBich, @RoleManager, @UserDuc);
        IF NOT EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserId = @UserCuong AND RoleId = @RoleUnitRep)
          INSERT INTO dbo.UserRoles (UserId, RoleId, AssignedBy) VALUES (@UserCuong, @RoleUnitRep, @UserDuc);
        IF NOT EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserId = @UserCuong AND RoleId = @RoleLecturer)
          INSERT INTO dbo.UserRoles (UserId, RoleId, AssignedBy) VALUES (@UserCuong, @RoleLecturer, @UserDuc);
        IF NOT EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserId = @UserDuc AND RoleId = @RoleAdmin)
          INSERT INTO dbo.UserRoles (UserId, RoleId, AssignedBy) VALUES (@UserDuc, @RoleAdmin, @UserDuc);
        IF NOT EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserId = @UserDuc AND RoleId = @RoleRecordsOfficer)
          INSERT INTO dbo.UserRoles (UserId, RoleId, AssignedBy) VALUES (@UserDuc, @RoleRecordsOfficer, @UserDuc);

        -- Hồ sơ Lecturers
        IF NOT EXISTS (SELECT 1 FROM dbo.Lecturers WHERE EmployeeCode = 'GV00234')
          INSERT INTO dbo.Lecturers (UserId, EmployeeCode, FullName, Email, Phone, Title, Degree, IsActive)
          VALUES (@UserAn, 'GV00234', N'Nguyễn Văn An', 'an.nv@lhu.edu.vn', '0912345678', N'Phó Giáo sư', N'Tiến sĩ', 1);

        IF NOT EXISTS (SELECT 1 FROM dbo.Lecturers WHERE EmployeeCode = 'GV00115')
          INSERT INTO dbo.Lecturers (UserId, EmployeeCode, FullName, Email, Phone, Title, Degree, IsActive)
          VALUES (@UserBich, 'GV00115', N'Trần Thị Bích', 'bich.tt@lhu.edu.vn', '0987654321', N'Giảng viên chính', N'Tiến sĩ', 1);

        IF NOT EXISTS (SELECT 1 FROM dbo.Lecturers WHERE EmployeeCode = 'GV00342')
          INSERT INTO dbo.Lecturers (UserId, EmployeeCode, FullName, Email, Phone, Title, Degree, IsActive)
          VALUES (@UserCuong, 'GV00342', N'Lê Hoàng Cường', 'cuong.lh@lhu.edu.vn', '0901234567', N'Giảng viên', N'Thạc sĩ', 1);

        DECLARE @LecturerAn BIGINT = (SELECT LecturerId FROM dbo.Lecturers WHERE EmployeeCode = 'GV00234');
        DECLARE @LecturerBich BIGINT = (SELECT LecturerId FROM dbo.Lecturers WHERE EmployeeCode = 'GV00115');
        DECLARE @LecturerCuong BIGINT = (SELECT LecturerId FROM dbo.Lecturers WHERE EmployeeCode = 'GV00342');

        DECLARE @UnitFit BIGINT = (SELECT UnitId FROM dbo.OrganizationUnits WHERE Code = 'FIT_LHU');
        DECLARE @UnitSe BIGINT = (SELECT UnitId FROM dbo.OrganizationUnits WHERE Code = 'FIT_SE');

        -- Phân công công tác chính (LecturerAssignments)
        IF NOT EXISTS (SELECT 1 FROM dbo.LecturerAssignments WHERE LecturerId = @LecturerAn)
          INSERT INTO dbo.LecturerAssignments (LecturerId, UnitId, IsPrimary, ValidFrom, AssignedBy)
          VALUES (@LecturerAn, @UnitSe, 1, '2020-09-01', @UserDuc);

        IF NOT EXISTS (SELECT 1 FROM dbo.LecturerAssignments WHERE LecturerId = @LecturerBich)
          INSERT INTO dbo.LecturerAssignments (LecturerId, UnitId, IsPrimary, ValidFrom, AssignedBy)
          VALUES (@LecturerBich, @UnitFit, 1, '2018-09-01', @UserDuc);

        IF NOT EXISTS (SELECT 1 FROM dbo.LecturerAssignments WHERE LecturerId = @LecturerCuong)
          INSERT INTO dbo.LecturerAssignments (LecturerId, UnitId, IsPrimary, ValidFrom, AssignedBy)
          VALUES (@LecturerCuong, @UnitSe, 1, '2021-09-01', @UserDuc);

        -- Phân công Phạm vi Quản lý (UserUnitScopes): TS. Bích quản lý Khoa CNTT kèm các Bộ môn con (IncludeDescendants = 1)
        IF NOT EXISTS (SELECT 1 FROM dbo.UserUnitScopes WHERE UserId = @UserBich AND UnitId = @UnitFit)
          INSERT INTO dbo.UserUnitScopes (UserId, RoleId, UnitId, IncludeDescendants, ValidFrom, AssignedBy)
          VALUES (@UserBich, @RoleManager, @UnitFit, 1, '2026-01-01', @UserDuc);

        -- Phân công Đại diện đơn vị (UnitRepresentatives): ThS. Cường đại diện Bộ môn KTPM
        IF NOT EXISTS (SELECT 1 FROM dbo.UnitRepresentatives WHERE UserId = @UserCuong AND UnitId = @UnitSe)
          INSERT INTO dbo.UnitRepresentatives (UserId, UnitId, ValidFrom, AssignedBy)
          VALUES (@UserCuong, @UnitSe, '2025-01-01', @UserDuc);
      `);

      await tx.commit();
      console.log('✅ Hoàn tất nạp dữ liệu mẫu (Seed Data) thành công!');
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } finally {
    if (ownConnection && pool) {
      await pool.close();
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Lỗi khi nạp dữ liệu mẫu:', err.message);
      process.exit(1);
    });
}

export default seedDatabase;
