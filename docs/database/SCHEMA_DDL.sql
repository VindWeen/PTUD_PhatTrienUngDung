-- ====================================================================================
-- CƠ SỞ DỮ LIỆU: HỆ THỐNG QUẢN LÝ HỒ SƠ THÀNH TÍCH SỐ & HỖ TRỢ XÉT DUYỆT KHEN THƯỞNG LHU
-- Tác giả: Tạ Trần Vinh Quang (Phụ trách Backend / Database / Core API)
-- Giai đoạn: W1-Q1 - Chốt nghiệp vụ, Schema và API lõi
-- Ngày lập: 25/09/2026 - Bàn giao: 26/09/2026
-- Hệ quản trị: Microsoft SQL Server 2019+
-- ====================================================================================

-- Tùy chọn thiết lập phiên
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- ====================================================================================
-- 1. PHÂN HỆ ĐỊNH DANH VÀ XÁC THỰC (IDENTITY)
-- ====================================================================================

IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        UserId BIGINT IDENTITY(1,1) NOT NULL,
        Username VARCHAR(50) NOT NULL,
        Email VARCHAR(100) NOT NULL,
        PasswordHash VARCHAR(255) NOT NULL,
        DisplayName NVARCHAR(100) NOT NULL,
        Status VARCHAR(20) NOT NULL CONSTRAINT DF_Users_Status DEFAULT ('ACTIVE'),
        MustChangePassword BIT NOT NULL CONSTRAINT DF_Users_MustChangePassword DEFAULT (0),
        PasswordChangedAt DATETIME2(3) NULL,
        LastLoginAt DATETIME2(3) NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        RowVersion ROWVERSION NOT NULL,
        CONSTRAINT PK_Users PRIMARY KEY CLUSTERED (UserId),
        CONSTRAINT UQ_Users_Username UNIQUE NONCLUSTERED (Username),
        CONSTRAINT UQ_Users_Email UNIQUE NONCLUSTERED (Email),
        CONSTRAINT CK_Users_Status CHECK (Status IN ('ACTIVE', 'LOCKED', 'INACTIVE'))
    );
END;
GO

IF OBJECT_ID('dbo.Roles', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Roles (
        RoleId BIGINT IDENTITY(1,1) NOT NULL,
        Code VARCHAR(50) NOT NULL,
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(255) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Roles_IsActive DEFAULT (1),
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Roles_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Roles_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_Roles PRIMARY KEY CLUSTERED (RoleId),
        CONSTRAINT UQ_Roles_Code UNIQUE NONCLUSTERED (Code)
    );
END;
GO

IF OBJECT_ID('dbo.UserRoles', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserRoles (
        UserId BIGINT NOT NULL,
        RoleId BIGINT NOT NULL,
        ValidFrom DATETIME2(3) NOT NULL CONSTRAINT DF_UserRoles_ValidFrom DEFAULT (SYSUTCDATETIME()),
        ValidTo DATETIME2(3) NULL,
        AssignedBy BIGINT NOT NULL,
        AssignedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserRoles_AssignedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_UserRoles PRIMARY KEY CLUSTERED (UserId, RoleId),
        CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId) ON DELETE NO ACTION,
        CONSTRAINT FK_UserRoles_AssignedBy FOREIGN KEY (AssignedBy) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT CK_UserRoles_Dates CHECK (ValidTo IS NULL OR ValidTo >= ValidFrom)
    );
END;
GO

IF OBJECT_ID('dbo.RefreshTokens', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RefreshTokens (
        RefreshTokenId BIGINT IDENTITY(1,1) NOT NULL,
        UserId BIGINT NOT NULL,
        TokenHash VARCHAR(255) NOT NULL,
        ExpiresAt DATETIME2(3) NOT NULL,
        RevokedAt DATETIME2(3) NULL,
        ReplacedByTokenId BIGINT NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_RefreshTokens_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedIp VARCHAR(45) NULL,
        UserAgent NVARCHAR(255) NULL,
        CONSTRAINT PK_RefreshTokens PRIMARY KEY CLUSTERED (RefreshTokenId),
        CONSTRAINT UQ_RefreshTokens_Hash UNIQUE NONCLUSTERED (TokenHash),
        CONSTRAINT FK_RefreshTokens_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE,
        CONSTRAINT FK_RefreshTokens_ReplacedBy FOREIGN KEY (ReplacedByTokenId) REFERENCES dbo.RefreshTokens(RefreshTokenId) ON DELETE NO ACTION
    );
END;
GO

-- ====================================================================================
-- 2. PHÂN HỆ CƠ CẤU TỔ CHỨC VÀ PHẠM VI (ORGANIZATION & SCOPES)
-- ====================================================================================

IF OBJECT_ID('dbo.OrganizationUnits', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.OrganizationUnits (
        UnitId BIGINT IDENTITY(1,1) NOT NULL,
        Code VARCHAR(50) NOT NULL,
        Name NVARCHAR(150) NOT NULL,
        Type VARCHAR(30) NOT NULL,
        ParentId BIGINT NULL,
        Description NVARCHAR(255) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_OrgUnits_IsActive DEFAULT (1),
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_OrgUnits_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_OrgUnits_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        RowVersion ROWVERSION NOT NULL,
        CONSTRAINT PK_OrganizationUnits PRIMARY KEY CLUSTERED (UnitId),
        CONSTRAINT UQ_OrganizationUnits_Code UNIQUE NONCLUSTERED (Code),
        CONSTRAINT FK_OrganizationUnits_Parent FOREIGN KEY (ParentId) REFERENCES dbo.OrganizationUnits(UnitId) ON DELETE NO ACTION,
        CONSTRAINT CK_OrganizationUnits_Type CHECK (Type IN ('FACULTY', 'DEPARTMENT', 'DIVISION'))
    );
END;
GO

IF OBJECT_ID('dbo.UserUnitScopes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserUnitScopes (
        UserUnitScopeId BIGINT IDENTITY(1,1) NOT NULL,
        UserId BIGINT NOT NULL,
        RoleId BIGINT NOT NULL,
        UnitId BIGINT NOT NULL,
        IncludeDescendants BIT NOT NULL CONSTRAINT DF_UserUnitScopes_IncludeDescendants DEFAULT (0),
        ValidFrom DATETIME2(3) NOT NULL CONSTRAINT DF_UserUnitScopes_ValidFrom DEFAULT (SYSUTCDATETIME()),
        ValidTo DATETIME2(3) NULL,
        AssignedBy BIGINT NOT NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserUnitScopes_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_UserUnitScopes PRIMARY KEY CLUSTERED (UserUnitScopeId),
        CONSTRAINT FK_UserUnitScopes_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT FK_UserUnitScopes_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId) ON DELETE NO ACTION,
        CONSTRAINT FK_UserUnitScopes_Units FOREIGN KEY (UnitId) REFERENCES dbo.OrganizationUnits(UnitId) ON DELETE NO ACTION,
        CONSTRAINT FK_UserUnitScopes_AssignedBy FOREIGN KEY (AssignedBy) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT CK_UserUnitScopes_Dates CHECK (ValidTo IS NULL OR ValidTo >= ValidFrom)
    );
END;
GO

IF OBJECT_ID('dbo.UnitRepresentatives', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UnitRepresentatives (
        UnitRepresentativeId BIGINT IDENTITY(1,1) NOT NULL,
        UserId BIGINT NOT NULL,
        UnitId BIGINT NOT NULL,
        ValidFrom DATETIME2(3) NOT NULL CONSTRAINT DF_UnitRepresentatives_ValidFrom DEFAULT (SYSUTCDATETIME()),
        ValidTo DATETIME2(3) NULL,
        AssignedBy BIGINT NOT NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UnitRepresentatives_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_UnitRepresentatives PRIMARY KEY CLUSTERED (UnitRepresentativeId),
        CONSTRAINT FK_UnitRepresentatives_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT FK_UnitRepresentatives_Units FOREIGN KEY (UnitId) REFERENCES dbo.OrganizationUnits(UnitId) ON DELETE NO ACTION,
        CONSTRAINT FK_UnitRepresentatives_AssignedBy FOREIGN KEY (AssignedBy) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT CK_UnitRepresentatives_Dates CHECK (ValidTo IS NULL OR ValidTo >= ValidFrom)
    );
END;
GO

-- ====================================================================================
-- 3. PHÂN HỆ GIẢNG VIÊN VÀ QUÁ TRÌNH CÔNG TÁC (LECTURERS)
-- ====================================================================================

IF OBJECT_ID('dbo.Lecturers', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Lecturers (
        LecturerId BIGINT IDENTITY(1,1) NOT NULL,
        UserId BIGINT NULL,
        EmployeeCode VARCHAR(30) NOT NULL,
        FullName NVARCHAR(100) NOT NULL,
        Email VARCHAR(100) NOT NULL,
        Phone VARCHAR(20) NULL,
        Title NVARCHAR(50) NULL,
        Degree NVARCHAR(50) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Lecturers_IsActive DEFAULT (1),
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Lecturers_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Lecturers_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        RowVersion ROWVERSION NOT NULL,
        CONSTRAINT PK_Lecturers PRIMARY KEY CLUSTERED (LecturerId),
        CONSTRAINT UQ_Lecturers_UserId UNIQUE NONCLUSTERED (UserId) WHERE UserId IS NOT NULL,
        CONSTRAINT UQ_Lecturers_EmployeeCode UNIQUE NONCLUSTERED (EmployeeCode),
        CONSTRAINT UQ_Lecturers_Email UNIQUE NONCLUSTERED (Email),
        CONSTRAINT FK_Lecturers_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE SET NULL
    );
END;
GO

IF OBJECT_ID('dbo.LecturerAssignments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.LecturerAssignments (
        LecturerAssignmentId BIGINT IDENTITY(1,1) NOT NULL,
        LecturerId BIGINT NOT NULL,
        UnitId BIGINT NOT NULL,
        IsPrimary BIT NOT NULL CONSTRAINT DF_LecturerAssignments_IsPrimary DEFAULT (1),
        ValidFrom DATE NOT NULL,
        ValidTo DATE NULL,
        AssignedBy BIGINT NOT NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_LecturerAssignments_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_LecturerAssignments PRIMARY KEY CLUSTERED (LecturerAssignmentId),
        CONSTRAINT FK_LecturerAssignments_Lecturers FOREIGN KEY (LecturerId) REFERENCES dbo.Lecturers(LecturerId) ON DELETE NO ACTION,
        CONSTRAINT FK_LecturerAssignments_Units FOREIGN KEY (UnitId) REFERENCES dbo.OrganizationUnits(UnitId) ON DELETE NO ACTION,
        CONSTRAINT FK_LecturerAssignments_AssignedBy FOREIGN KEY (AssignedBy) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT CK_LecturerAssignments_Dates CHECK (ValidTo IS NULL OR ValidTo >= ValidFrom)
    );
END;
GO

-- ====================================================================================
-- 4. PHÂN HỆ DANH MỤC DÙNG CHUNG (CATALOGS & TIME)
-- ====================================================================================

IF OBJECT_ID('dbo.AcademicYears', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AcademicYears (
        AcademicYearId BIGINT IDENTITY(1,1) NOT NULL,
        Code VARCHAR(20) NOT NULL,
        Name NVARCHAR(50) NOT NULL,
        StartDate DATE NOT NULL,
        EndDate DATE NOT NULL,
        IsCurrent BIT NOT NULL CONSTRAINT DF_AcademicYears_IsCurrent DEFAULT (0),
        IsActive BIT NOT NULL CONSTRAINT DF_AcademicYears_IsActive DEFAULT (1),
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AcademicYears_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AcademicYears_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_AcademicYears PRIMARY KEY CLUSTERED (AcademicYearId),
        CONSTRAINT UQ_AcademicYears_Code UNIQUE NONCLUSTERED (Code),
        CONSTRAINT CK_AcademicYears_Dates CHECK (EndDate > StartDate)
    );
END;
GO

IF OBJECT_ID('dbo.AchievementTypes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AchievementTypes (
        AchievementTypeId BIGINT IDENTITY(1,1) NOT NULL,
        Code VARCHAR(50) NOT NULL,
        Name NVARCHAR(150) NOT NULL,
        Description NVARCHAR(255) NULL,
        ApplicableSubjectType VARCHAR(20) NOT NULL CONSTRAINT DF_AchievementTypes_SubjectType DEFAULT ('BOTH'),
        IsActive BIT NOT NULL CONSTRAINT DF_AchievementTypes_IsActive DEFAULT (1),
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AchievementTypes_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AchievementTypes_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_AchievementTypes PRIMARY KEY CLUSTERED (AchievementTypeId),
        CONSTRAINT UQ_AchievementTypes_Code UNIQUE NONCLUSTERED (Code),
        CONSTRAINT CK_AchievementTypes_SubjectType CHECK (ApplicableSubjectType IN ('LECTURER', 'UNIT', 'BOTH'))
    );
END;
GO

IF OBJECT_ID('dbo.AwardTypes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AwardTypes (
        AwardTypeId BIGINT IDENTITY(1,1) NOT NULL,
        Code VARCHAR(50) NOT NULL,
        Name NVARCHAR(150) NOT NULL,
        Category VARCHAR(30) NOT NULL,
        Level VARCHAR(30) NOT NULL,
        ApplicableSubjectType VARCHAR(20) NOT NULL CONSTRAINT DF_AwardTypes_SubjectType DEFAULT ('BOTH'),
        Description NVARCHAR(255) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_AwardTypes_IsActive DEFAULT (1),
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AwardTypes_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AwardTypes_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_AwardTypes PRIMARY KEY CLUSTERED (AwardTypeId),
        CONSTRAINT UQ_AwardTypes_Code UNIQUE NONCLUSTERED (Code),
        CONSTRAINT CK_AwardTypes_Category CHECK (Category IN ('TITLE', 'REWARD_FORM')),
        CONSTRAINT CK_AwardTypes_Level CHECK (Level IN ('FACULTY', 'UNIVERSITY', 'MINISTRY', 'STATE')),
        CONSTRAINT CK_AwardTypes_SubjectType CHECK (ApplicableSubjectType IN ('LECTURER', 'UNIT', 'BOTH'))
    );
END;
GO

-- ====================================================================================
-- 5. PHÂN HỆ THÀNH TÍCH (ACHIEVEMENTS)
-- ====================================================================================

IF OBJECT_ID('dbo.Achievements', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Achievements (
        AchievementId BIGINT IDENTITY(1,1) NOT NULL,
        LecturerId BIGINT NULL,
        OrganizationUnitId BIGINT NULL,
        ContextUnitId BIGINT NOT NULL,
        AchievementTypeId BIGINT NOT NULL,
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        ContributionRole NVARCHAR(100) NULL,
        StartDate DATE NULL,
        EndDate DATE NULL,
        RecognitionYear INT NOT NULL,
        AcademicYearId BIGINT NULL,
        Status VARCHAR(30) NOT NULL CONSTRAINT DF_Achievements_Status DEFAULT ('DRAFT'),
        CreatedBy BIGINT NOT NULL,
        SubmittedBy BIGINT NULL,
        ReplacesAchievementId BIGINT NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Achievements_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Achievements_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        RowVersion ROWVERSION NOT NULL,
        CONSTRAINT PK_Achievements PRIMARY KEY CLUSTERED (AchievementId),
        CONSTRAINT FK_Achievements_Lecturers FOREIGN KEY (LecturerId) REFERENCES dbo.Lecturers(LecturerId) ON DELETE NO ACTION,
        CONSTRAINT FK_Achievements_OrgUnits FOREIGN KEY (OrganizationUnitId) REFERENCES dbo.OrganizationUnits(UnitId) ON DELETE NO ACTION,
        CONSTRAINT FK_Achievements_ContextUnit FOREIGN KEY (ContextUnitId) REFERENCES dbo.OrganizationUnits(UnitId) ON DELETE NO ACTION,
        CONSTRAINT FK_Achievements_Type FOREIGN KEY (AchievementTypeId) REFERENCES dbo.AchievementTypes(AchievementTypeId) ON DELETE NO ACTION,
        CONSTRAINT FK_Achievements_AcademicYear FOREIGN KEY (AcademicYearId) REFERENCES dbo.AcademicYears(AcademicYearId) ON DELETE NO ACTION,
        CONSTRAINT FK_Achievements_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT FK_Achievements_SubmittedBy FOREIGN KEY (SubmittedBy) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT FK_Achievements_Replaces FOREIGN KEY (ReplacesAchievementId) REFERENCES dbo.Achievements(AchievementId) ON DELETE NO ACTION,
        -- RÀNG BUỘC CHỦ THỂ XOR BẮT BUỘC: ĐÚNG 1 TRONG 2 CÓ GIÁ TRỊ
        CONSTRAINT CK_Achievements_Subject_XOR CHECK (
            (LecturerId IS NOT NULL AND OrganizationUnitId IS NULL) OR
            (LecturerId IS NULL AND OrganizationUnitId IS NOT NULL)
        ),
        CONSTRAINT CK_Achievements_Dates CHECK (EndDate IS NULL OR StartDate IS NULL OR EndDate >= StartDate),
        CONSTRAINT CK_Achievements_Year CHECK (RecognitionYear >= 1990 AND RecognitionYear <= 2100),
        CONSTRAINT CK_Achievements_Status CHECK (Status IN ('DRAFT', 'SUBMITTED', 'NEED_CORRECTION', 'VERIFIED', 'REJECTED', 'CANCELLED', 'REVOKED'))
    );
END;
GO

-- Chỉ mục hỗ trợ truy vấn hiệu năng cao
CREATE NONCLUSTERED INDEX IX_Achievements_Context_Year_Status 
ON dbo.Achievements(ContextUnitId, RecognitionYear, Status)
INCLUDE (Title, AchievementTypeId, LecturerId, OrganizationUnitId);
GO

CREATE NONCLUSTERED INDEX IX_Achievements_Lecturer 
ON dbo.Achievements(LecturerId, Status)
WHERE LecturerId IS NOT NULL;
GO

CREATE NONCLUSTERED INDEX IX_Achievements_Unit 
ON dbo.Achievements(OrganizationUnitId, Status)
WHERE OrganizationUnitId IS NOT NULL;
GO

IF OBJECT_ID('dbo.AchievementSubmissions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AchievementSubmissions (
        SubmissionId BIGINT IDENTITY(1,1) NOT NULL,
        AchievementId BIGINT NOT NULL,
        RevisionNo INT NOT NULL,
        SnapshotData NVARCHAR(MAX) NOT NULL,
        SubmittedBy BIGINT NOT NULL,
        SubmittedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AchievementSubmissions_SubmittedAt DEFAULT (SYSUTCDATETIME()),
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AchievementSubmissions_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_AchievementSubmissions PRIMARY KEY CLUSTERED (SubmissionId),
        CONSTRAINT UQ_AchievementSubmissions_Rev UNIQUE NONCLUSTERED (AchievementId, RevisionNo),
        CONSTRAINT FK_AchievementSubmissions_Achievement FOREIGN KEY (AchievementId) REFERENCES dbo.Achievements(AchievementId) ON DELETE NO ACTION,
        CONSTRAINT FK_AchievementSubmissions_SubmittedBy FOREIGN KEY (SubmittedBy) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT CK_AchievementSubmissions_SnapshotJSON CHECK (ISJSON(SnapshotData) = 1)
    );
END;
GO

-- ====================================================================================
-- 6. PHÂN HỆ MINH CHỨNG VÀ TỆP TIN (EVIDENCES)
-- ====================================================================================

IF OBJECT_ID('dbo.Evidences', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Evidences (
        EvidenceId BIGINT IDENTITY(1,1) NOT NULL,
        AchievementId BIGINT NOT NULL,
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(500) NULL,
        IsRemoved BIT NOT NULL CONSTRAINT DF_Evidences_IsRemoved DEFAULT (0),
        CreatedBy BIGINT NOT NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Evidences_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Evidences_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_Evidences PRIMARY KEY CLUSTERED (EvidenceId),
        CONSTRAINT FK_Evidences_Achievements FOREIGN KEY (AchievementId) REFERENCES dbo.Achievements(AchievementId) ON DELETE NO ACTION,
        CONSTRAINT FK_Evidences_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION
    );
END;
GO

IF OBJECT_ID('dbo.EvidenceFiles', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.EvidenceFiles (
        EvidenceFileId BIGINT IDENTITY(1,1) NOT NULL,
        EvidenceId BIGINT NOT NULL,
        VersionNo INT NOT NULL,
        OriginalFileName NVARCHAR(255) NOT NULL,
        StorageKey VARCHAR(255) NOT NULL,
        MimeType VARCHAR(100) NOT NULL,
        FileExtension VARCHAR(20) NOT NULL,
        FileSize BIGINT NOT NULL,
        Sha256Hash CHAR(64) NOT NULL,
        UploadedBy BIGINT NOT NULL,
        UploadedAt DATETIME2(3) NOT NULL CONSTRAINT DF_EvidenceFiles_UploadedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_EvidenceFiles PRIMARY KEY CLUSTERED (EvidenceFileId),
        CONSTRAINT UQ_EvidenceFiles_Version UNIQUE NONCLUSTERED (EvidenceId, VersionNo),
        CONSTRAINT UQ_EvidenceFiles_StorageKey UNIQUE NONCLUSTERED (StorageKey),
        CONSTRAINT FK_EvidenceFiles_Evidences FOREIGN KEY (EvidenceId) REFERENCES dbo.Evidences(EvidenceId) ON DELETE NO ACTION,
        CONSTRAINT FK_EvidenceFiles_UploadedBy FOREIGN KEY (UploadedBy) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT CK_EvidenceFiles_FileSize CHECK (FileSize > 0 AND FileSize <= 10485760),
        CONSTRAINT CK_EvidenceFiles_Extension CHECK (FileExtension IN ('.pdf', '.jpg', '.jpeg', '.png', '.docx'))
    );
END;
GO

IF OBJECT_ID('dbo.SubmissionEvidenceFiles', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SubmissionEvidenceFiles (
        SubmissionId BIGINT NOT NULL,
        EvidenceFileId BIGINT NOT NULL,
        AttachedAt DATETIME2(3) NOT NULL CONSTRAINT DF_SubmissionEvidenceFiles_AttachedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_SubmissionEvidenceFiles PRIMARY KEY CLUSTERED (SubmissionId, EvidenceFileId),
        CONSTRAINT FK_SubmissionEvidenceFiles_Submission FOREIGN KEY (SubmissionId) REFERENCES dbo.AchievementSubmissions(SubmissionId) ON DELETE NO ACTION,
        CONSTRAINT FK_SubmissionEvidenceFiles_File FOREIGN KEY (EvidenceFileId) REFERENCES dbo.EvidenceFiles(EvidenceFileId) ON DELETE NO ACTION
    );
END;
GO

-- ====================================================================================
-- 7. PHÂN HỆ THẨM ĐỊNH VÀ LỊCH SỬ TRẠNG THÁI (VERIFICATION)
-- ====================================================================================

IF OBJECT_ID('dbo.AchievementStatusHistories', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AchievementStatusHistories (
        HistoryId BIGINT IDENTITY(1,1) NOT NULL,
        AchievementId BIGINT NOT NULL,
        SubmissionId BIGINT NULL,
        FromStatus VARCHAR(30) NOT NULL,
        ToStatus VARCHAR(30) NOT NULL,
        ActorId BIGINT NOT NULL,
        Reason NVARCHAR(1000) NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AchievementStatusHistories_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_AchievementStatusHistories PRIMARY KEY CLUSTERED (HistoryId),
        CONSTRAINT FK_AchievementStatusHistories_Achievement FOREIGN KEY (AchievementId) REFERENCES dbo.Achievements(AchievementId) ON DELETE NO ACTION,
        CONSTRAINT FK_AchievementStatusHistories_Submission FOREIGN KEY (SubmissionId) REFERENCES dbo.AchievementSubmissions(SubmissionId) ON DELETE NO ACTION,
        CONSTRAINT FK_AchievementStatusHistories_Actor FOREIGN KEY (ActorId) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION
    );
END;
GO

-- ====================================================================================
-- 8. PHÂN HỆ KHEN THƯỞNG CÓ QUYẾT ĐỊNH (AWARDS)
-- ====================================================================================

IF OBJECT_ID('dbo.AwardDecisions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AwardDecisions (
        DecisionId BIGINT IDENTITY(1,1) NOT NULL,
        DecisionNumber VARCHAR(100) NOT NULL,
        DecisionDate DATE NOT NULL,
        Issuer NVARCHAR(150) NOT NULL,
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        CreatedBy BIGINT NOT NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AwardDecisions_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AwardDecisions_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        RowVersion ROWVERSION NOT NULL,
        CONSTRAINT PK_AwardDecisions PRIMARY KEY CLUSTERED (DecisionId),
        CONSTRAINT UQ_AwardDecisions_BusinessKey UNIQUE NONCLUSTERED (Issuer, DecisionNumber, DecisionDate),
        CONSTRAINT FK_AwardDecisions_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION
    );
END;
GO

IF OBJECT_ID('dbo.AwardDecisionFiles', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AwardDecisionFiles (
        DecisionFileId BIGINT IDENTITY(1,1) NOT NULL,
        DecisionId BIGINT NOT NULL,
        VersionNo INT NOT NULL,
        OriginalFileName NVARCHAR(255) NOT NULL,
        StorageKey VARCHAR(255) NOT NULL,
        MimeType VARCHAR(100) NOT NULL,
        FileExtension VARCHAR(20) NOT NULL,
        FileSize BIGINT NOT NULL,
        Sha256Hash CHAR(64) NOT NULL,
        UploadedBy BIGINT NOT NULL,
        UploadedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AwardDecisionFiles_UploadedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_AwardDecisionFiles PRIMARY KEY CLUSTERED (DecisionFileId),
        CONSTRAINT UQ_AwardDecisionFiles_Version UNIQUE NONCLUSTERED (DecisionId, VersionNo),
        CONSTRAINT UQ_AwardDecisionFiles_StorageKey UNIQUE NONCLUSTERED (StorageKey),
        CONSTRAINT FK_AwardDecisionFiles_Decision FOREIGN KEY (DecisionId) REFERENCES dbo.AwardDecisions(DecisionId) ON DELETE NO ACTION,
        CONSTRAINT FK_AwardDecisionFiles_UploadedBy FOREIGN KEY (UploadedBy) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT CK_AwardDecisionFiles_FileSize CHECK (FileSize > 0 AND FileSize <= 10485760)
    );
END;
GO

IF OBJECT_ID('dbo.AwardRecords', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AwardRecords (
        AwardRecordId BIGINT IDENTITY(1,1) NOT NULL,
        LecturerId BIGINT NULL,
        OrganizationUnitId BIGINT NULL,
        ContextUnitId BIGINT NOT NULL,
        AwardTypeId BIGINT NOT NULL,
        DecisionId BIGINT NOT NULL,
        RecognitionYear INT NOT NULL,
        PeriodStart DATE NULL,
        PeriodEnd DATE NULL,
        Status VARCHAR(30) NOT NULL CONSTRAINT DF_AwardRecords_Status DEFAULT ('DRAFT'),
        RecordedBy BIGINT NULL,
        RecordedAt DATETIME2(3) NULL,
        ReplacesAwardRecordId BIGINT NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AwardRecords_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AwardRecords_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        RowVersion ROWVERSION NOT NULL,
        CONSTRAINT PK_AwardRecords PRIMARY KEY CLUSTERED (AwardRecordId),
        CONSTRAINT FK_AwardRecords_Lecturers FOREIGN KEY (LecturerId) REFERENCES dbo.Lecturers(LecturerId) ON DELETE NO ACTION,
        CONSTRAINT FK_AwardRecords_OrgUnits FOREIGN KEY (OrganizationUnitId) REFERENCES dbo.OrganizationUnits(UnitId) ON DELETE NO ACTION,
        CONSTRAINT FK_AwardRecords_ContextUnit FOREIGN KEY (ContextUnitId) REFERENCES dbo.OrganizationUnits(UnitId) ON DELETE NO ACTION,
        CONSTRAINT FK_AwardRecords_AwardType FOREIGN KEY (AwardTypeId) REFERENCES dbo.AwardTypes(AwardTypeId) ON DELETE NO ACTION,
        CONSTRAINT FK_AwardRecords_Decision FOREIGN KEY (DecisionId) REFERENCES dbo.AwardDecisions(DecisionId) ON DELETE NO ACTION,
        CONSTRAINT FK_AwardRecords_RecordedBy FOREIGN KEY (RecordedBy) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT FK_AwardRecords_Replaces FOREIGN KEY (ReplacesAwardRecordId) REFERENCES dbo.AwardRecords(AwardRecordId) ON DELETE NO ACTION,
        -- RÀNG BUỘC CHỦ THỂ XOR BẮT BUỘC: ĐÚNG 1 TRONG 2 CÓ GIÁ TRỊ
        CONSTRAINT CK_AwardRecords_Subject_XOR CHECK (
            (LecturerId IS NOT NULL AND OrganizationUnitId IS NULL) OR
            (LecturerId IS NULL AND OrganizationUnitId IS NOT NULL)
        ),
        CONSTRAINT CK_AwardRecords_Dates CHECK (PeriodEnd IS NULL OR PeriodStart IS NULL OR PeriodEnd >= PeriodStart),
        CONSTRAINT CK_AwardRecords_Year CHECK (RecognitionYear >= 1990 AND RecognitionYear <= 2100),
        CONSTRAINT CK_AwardRecords_Status CHECK (Status IN ('DRAFT', 'RECORDED', 'REVOKED'))
    );
END;
GO

-- FILTERED UNIQUE INDEX: CHỐNG TRÙNG LẶP KHEN THƯỞNG ĐÃ GHI NHẬN (RECORDED)
CREATE UNIQUE NONCLUSTERED INDEX UX_AwardRecords_Lecturer_Recorded
ON dbo.AwardRecords(LecturerId, AwardTypeId, DecisionId)
WHERE Status = 'RECORDED' AND LecturerId IS NOT NULL;
GO

CREATE UNIQUE NONCLUSTERED INDEX UX_AwardRecords_Unit_Recorded
ON dbo.AwardRecords(OrganizationUnitId, AwardTypeId, DecisionId)
WHERE Status = 'RECORDED' AND OrganizationUnitId IS NOT NULL;
GO

IF OBJECT_ID('dbo.AwardRecordAchievements', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AwardRecordAchievements (
        AwardRecordId BIGINT NOT NULL,
        AchievementId BIGINT NOT NULL,
        LinkedBy BIGINT NOT NULL,
        LinkedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AwardRecordAchievements_LinkedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_AwardRecordAchievements PRIMARY KEY CLUSTERED (AwardRecordId, AchievementId),
        CONSTRAINT FK_AwardRecordAchievements_Award FOREIGN KEY (AwardRecordId) REFERENCES dbo.AwardRecords(AwardRecordId) ON DELETE NO ACTION,
        CONSTRAINT FK_AwardRecordAchievements_Achievement FOREIGN KEY (AchievementId) REFERENCES dbo.Achievements(AchievementId) ON DELETE NO ACTION,
        CONSTRAINT FK_AwardRecordAchievements_LinkedBy FOREIGN KEY (LinkedBy) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION
    );
END;
GO

IF OBJECT_ID('dbo.AwardRecordHistories', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AwardRecordHistories (
        AwardRecordHistoryId BIGINT IDENTITY(1,1) NOT NULL,
        AwardRecordId BIGINT NOT NULL,
        FromStatus VARCHAR(30) NOT NULL,
        ToStatus VARCHAR(30) NOT NULL,
        ActorId BIGINT NOT NULL,
        Reason NVARCHAR(1000) NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AwardRecordHistories_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_AwardRecordHistories PRIMARY KEY CLUSTERED (AwardRecordHistoryId),
        CONSTRAINT FK_AwardRecordHistories_Award FOREIGN KEY (AwardRecordId) REFERENCES dbo.AwardRecords(AwardRecordId) ON DELETE NO ACTION,
        CONSTRAINT FK_AwardRecordHistories_Actor FOREIGN KEY (ActorId) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION
    );
END;
GO

-- ====================================================================================
-- 9. PHÂN HỆ HỆ THỐNG VÀ KIỂM TOÁN (SYSTEM & AUDIT)
-- ====================================================================================

IF OBJECT_ID('dbo.Notifications', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Notifications (
        NotificationId BIGINT IDENTITY(1,1) NOT NULL,
        UserId BIGINT NOT NULL,
        Type VARCHAR(50) NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Message NVARCHAR(1000) NOT NULL,
        EntityType VARCHAR(50) NULL,
        EntityId BIGINT NULL,
        IsRead BIT NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT (0),
        ReadAt DATETIME2(3) NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_Notifications PRIMARY KEY CLUSTERED (NotificationId),
        CONSTRAINT FK_Notifications_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE
    );
END;
GO

CREATE NONCLUSTERED INDEX IX_Notifications_User_Unread 
ON dbo.Notifications(UserId, IsRead)
INCLUDE (Title, CreatedAt);
GO

IF OBJECT_ID('dbo.AuditLogs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AuditLogs (
        AuditLogId BIGINT IDENTITY(1,1) NOT NULL,
        ActorId BIGINT NULL,
        Action VARCHAR(50) NOT NULL,
        EntityType VARCHAR(50) NOT NULL,
        EntityId BIGINT NOT NULL,
        OldValues NVARCHAR(MAX) NULL,
        NewValues NVARCHAR(MAX) NULL,
        IpAddress VARCHAR(45) NULL,
        UserAgent NVARCHAR(255) NULL,
        CorrelationId VARCHAR(50) NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AuditLogs_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_AuditLogs PRIMARY KEY CLUSTERED (AuditLogId),
        CONSTRAINT FK_AuditLogs_Actor FOREIGN KEY (ActorId) REFERENCES dbo.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT CK_AuditLogs_OldValuesJSON CHECK (OldValues IS NULL OR ISJSON(OldValues) = 1),
        CONSTRAINT CK_AuditLogs_NewValuesJSON CHECK (NewValues IS NULL OR ISJSON(NewValues) = 1)
    );
END;
GO

CREATE NONCLUSTERED INDEX IX_AuditLogs_Entity 
ON dbo.AuditLogs(EntityType, EntityId, CreatedAt);
GO

-- ====================================================================================
-- 10. DỮ LIỆU KHỞI TẠO MẪU (SEED DATA CHO SYSTEM & ROLES)
-- ====================================================================================

-- Ghi nhận danh mục Roles
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

-- Ghi nhận danh mục AchievementTypes mẫu
IF NOT EXISTS (SELECT 1 FROM dbo.AchievementTypes WHERE Code = 'RESEARCH_JOURNAL_Q1')
    INSERT INTO dbo.AchievementTypes (Code, Name, Description, ApplicableSubjectType, IsActive) 
    VALUES ('RESEARCH_JOURNAL_Q1', N'Bài báo quốc tế ISI/Scopus Q1', N'Công bố khoa học trên tạp chí thuộc phân hạng Q1', 'BOTH', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.AchievementTypes WHERE Code = 'RESEARCH_PATENT')
    INSERT INTO dbo.AchievementTypes (Code, Name, Description, ApplicableSubjectType, IsActive) 
    VALUES ('RESEARCH_PATENT', N'Bằng độc quyền sáng chế / Giải pháp hữu ích', N'Văn bằng bảo hộ sở hữu trí tuệ đã cấp bằng', 'BOTH', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.AchievementTypes WHERE Code = 'TEACHING_CURRICULUM')
    INSERT INTO dbo.AchievementTypes (Code, Name, Description, ApplicableSubjectType, IsActive) 
    VALUES ('TEACHING_CURRICULUM', N'Biên soạn giáo trình / Tài liệu giảng dạy', N'Giáo trình đại học đã nghiệm thu và phát hành', 'BOTH', 1);

-- Ghi nhận danh mục AwardTypes mẫu
IF NOT EXISTS (SELECT 1 FROM dbo.AwardTypes WHERE Code = 'CSTĐ_CS')
    INSERT INTO dbo.AwardTypes (Code, Name, Category, Level, ApplicableSubjectType, Description, IsActive)
    VALUES ('CSTĐ_CS', N'Chiến sĩ thi đua cơ sở', 'TITLE', 'UNIVERSITY', 'LECTURER', N'Danh hiệu thi đua cấp trường hàng năm', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.AwardTypes WHERE Code = 'BANG_KHEN_BGD')
    INSERT INTO dbo.AwardTypes (Code, Name, Category, Level, ApplicableSubjectType, Description, IsActive)
    VALUES ('BANG_KHEN_BGD', N'Bằng khen Bộ Giáo dục & Đào tạo', 'REWARD_FORM', 'MINISTRY', 'BOTH', N'Khen thưởng thành tích xuất sắc cấp Bộ', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.AwardTypes WHERE Code = 'TAP_THE_LĐXS')
    INSERT INTO dbo.AwardTypes (Code, Name, Category, Level, ApplicableSubjectType, Description, IsActive)
    VALUES ('TAP_THE_LĐXS', N'Tập thể Lao động Xuất sắc', 'TITLE', 'MINISTRY', 'UNIT', N'Danh hiệu thi đua tập thể hàng năm', 1);
GO
