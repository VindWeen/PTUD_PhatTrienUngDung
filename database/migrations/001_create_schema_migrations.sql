-- Migration 001: Khởi tạo bảng lưu vết lịch sử migration
IF OBJECT_ID('dbo._SchemaMigrations', 'U') IS NULL
BEGIN
    CREATE TABLE dbo._SchemaMigrations (
        MigrationId BIGINT IDENTITY(1,1) NOT NULL,
        Name VARCHAR(255) NOT NULL,
        AppliedAt DATETIME2(3) NOT NULL CONSTRAINT DF_SchemaMigrations_AppliedAt DEFAULT (SYSUTCDATETIME()),
        Checksum VARCHAR(64) NULL,
        ExecutionTimeMs INT NULL,
        CONSTRAINT PK_SchemaMigrations PRIMARY KEY CLUSTERED (MigrationId),
        CONSTRAINT UQ_SchemaMigrations_Name UNIQUE NONCLUSTERED (Name)
    );
END;
