-- Migration 005: Khởi tạo phân hệ Thành tích (Achievements, AchievementSubmissions)
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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Achievements_Context_Year_Status' AND object_id = OBJECT_ID('dbo.Achievements'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Achievements_Context_Year_Status 
    ON dbo.Achievements(ContextUnitId, RecognitionYear, Status)
    INCLUDE (Title, AchievementTypeId, LecturerId, OrganizationUnitId);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Achievements_Lecturer' AND object_id = OBJECT_ID('dbo.Achievements'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Achievements_Lecturer 
    ON dbo.Achievements(LecturerId, Status)
    WHERE LecturerId IS NOT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Achievements_Unit' AND object_id = OBJECT_ID('dbo.Achievements'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Achievements_Unit 
    ON dbo.Achievements(OrganizationUnitId, Status)
    WHERE OrganizationUnitId IS NOT NULL;
END;

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
