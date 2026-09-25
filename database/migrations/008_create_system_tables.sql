-- Migration 008: Khởi tạo phân hệ Hệ thống (Notifications, AuditLogs)
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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Notifications_User_Unread' AND object_id = OBJECT_ID('dbo.Notifications'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Notifications_User_Unread 
    ON dbo.Notifications(UserId, IsRead)
    INCLUDE (Title, CreatedAt);
END;

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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLogs_Entity' AND object_id = OBJECT_ID('dbo.AuditLogs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_AuditLogs_Entity 
    ON dbo.AuditLogs(EntityType, EntityId, CreatedAt);
END;
