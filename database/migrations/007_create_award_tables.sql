-- Migration 007: Khởi tạo phân hệ Khen thưởng có Quyết định (AwardDecisions, AwardRecords)
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

-- FILTERED UNIQUE INDEX: CHỐNG TRÙNG LẶP KHEN THƯỞNG ĐÃ GHI NHẬN (RECORDED)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_AwardRecords_Lecturer_Recorded' AND object_id = OBJECT_ID('dbo.AwardRecords'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_AwardRecords_Lecturer_Recorded
    ON dbo.AwardRecords(LecturerId, AwardTypeId, DecisionId)
    WHERE Status = 'RECORDED' AND LecturerId IS NOT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_AwardRecords_Unit_Recorded' AND object_id = OBJECT_ID('dbo.AwardRecords'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_AwardRecords_Unit_Recorded
    ON dbo.AwardRecords(OrganizationUnitId, AwardTypeId, DecisionId)
    WHERE Status = 'RECORDED' AND OrganizationUnitId IS NOT NULL;
END;

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
