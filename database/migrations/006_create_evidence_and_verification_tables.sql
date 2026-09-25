-- Migration 006: Khởi tạo Minh chứng, File bất biến và Lịch sử trạng thái thành tích
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
