-- Migration 004: Khởi tạo Giảng viên, Phân công công tác và Danh mục dùng chung
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
