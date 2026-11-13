-- Migration 005: Refactor Personal Achievement Vault, KPI sources, CV Profiles, Calendar Reminders, Roles & Organization Hierarchy
-- Aligns database schema with Smart Achievement Vault & Career Assistant architecture.

-- 1. app.achievements: Transition to personal vault with immediate ACTIVE status
DECLARE @chk_ach SYSNAME = (
  SELECT cc.name
  FROM sys.check_constraints cc
  WHERE cc.parent_object_id = OBJECT_ID(N'app.achievements') AND cc.name = N'ck_achievements_status'
);
IF @chk_ach IS NOT NULL
BEGIN
  DECLARE @sql_chk NVARCHAR(MAX) = N'ALTER TABLE app.achievements DROP CONSTRAINT ' + QUOTENAME(@chk_ach);
  EXEC(@sql_chk);
END

DECLARE @df_ach SYSNAME = (
  SELECT df.name
  FROM sys.default_constraints df
  JOIN sys.columns c ON c.object_id = df.parent_object_id AND c.column_id = df.parent_column_id
  WHERE df.parent_object_id = OBJECT_ID(N'app.achievements') AND c.name = N'status'
);
IF @df_ach IS NOT NULL
BEGIN
  DECLARE @sql_df NVARCHAR(MAX) = N'ALTER TABLE app.achievements DROP CONSTRAINT ' + QUOTENAME(@df_ach);
  EXEC(@sql_df);
END

-- Migrate all existing achievements to ACTIVE status
UPDATE app.achievements SET status = N'ACTIVE';

-- Add new default constraint defaulting to ACTIVE
ALTER TABLE app.achievements ADD CONSTRAINT df_achievements_status DEFAULT N'ACTIVE' FOR status;

-- Add updated check constraint allowing ACTIVE and historical statuses
ALTER TABLE app.achievements ADD CONSTRAINT ck_achievements_status
  CHECK (status IN (N'ACTIVE', N'DRAFT', N'SUBMITTED', N'NEED_CORRECTION', N'VERIFIED', N'APPROVED', N'REJECTED', N'CANCELLED', N'REVOKED', N'RETURNED', N'PENDING'));
GO

-- 2. app.award_periods: Add submission_deadline for calendar reminders and AI discovery
IF COL_LENGTH(N'app.award_periods', N'submission_deadline') IS NULL
BEGIN
  ALTER TABLE app.award_periods ADD submission_deadline DATETIME2(3) NULL;
END
GO

-- 3. app.kpi_goals & app.kpi_results: Expand source column to NVARCHAR(30) and allow AI_GAP, AI_GAP_ANALYSIS, SYSTEM
DECLARE @chk_kpi_goals SYSNAME = (
  SELECT cc.name
  FROM sys.check_constraints cc
  WHERE cc.parent_object_id = OBJECT_ID(N'app.kpi_goals')
    AND cc.parent_column_id = COLUMNPROPERTY(OBJECT_ID(N'app.kpi_goals'), N'source', 'ColumnId')
);
IF @chk_kpi_goals IS NOT NULL
BEGIN
  DECLARE @sql_kpi_goals NVARCHAR(MAX) = N'ALTER TABLE app.kpi_goals DROP CONSTRAINT ' + QUOTENAME(@chk_kpi_goals);
  EXEC(@sql_kpi_goals);
END

DECLARE @chk_kpi_results SYSNAME = (
  SELECT cc.name
  FROM sys.check_constraints cc
  WHERE cc.parent_object_id = OBJECT_ID(N'app.kpi_results')
    AND cc.parent_column_id = COLUMNPROPERTY(OBJECT_ID(N'app.kpi_results'), N'source', 'ColumnId')
);
IF @chk_kpi_results IS NOT NULL
BEGIN
  DECLARE @sql_kpi_results NVARCHAR(MAX) = N'ALTER TABLE app.kpi_results DROP CONSTRAINT ' + QUOTENAME(@chk_kpi_results);
  EXEC(@sql_kpi_results);
END

ALTER TABLE app.kpi_goals ALTER COLUMN source NVARCHAR(30) COLLATE Latin1_General_100_BIN2 NOT NULL;
ALTER TABLE app.kpi_results ALTER COLUMN source NVARCHAR(30) COLLATE Latin1_General_100_BIN2 NOT NULL;

ALTER TABLE app.kpi_goals ADD CONSTRAINT ck_kpi_goals_source
  CHECK (source IN (N'MANUAL', N'CSV', N'AI_GAP', N'AI_GAP_ANALYSIS', N'SYSTEM'));

ALTER TABLE app.kpi_results ADD CONSTRAINT ck_kpi_results_source
  CHECK (source IN (N'MANUAL', N'CSV', N'AI_GAP', N'AI_GAP_ANALYSIS', N'SYSTEM'));
GO

-- 4. app.cv_profiles: Create personalized CV profiles table with custom slug and templates
IF OBJECT_ID(N'app.cv_profiles', N'U') IS NULL
BEGIN
  CREATE TABLE app.cv_profiles (
    profile_id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    user_id BIGINT NOT NULL CONSTRAINT fk_cv_profiles_user FOREIGN KEY REFERENCES app.users(user_id),
    slug NVARCHAR(100) NULL,
    is_public BIT NOT NULL DEFAULT 0,
    template_id NVARCHAR(50) NOT NULL DEFAULT N'standard',
    custom_docx_storage_key NVARCHAR(500) NULL,
    selected_achievement_ids NVARCHAR(MAX) NULL,
    bio NVARCHAR(MAX) NULL,
    headline NVARCHAR(255) NULL,
    version INT NOT NULL DEFAULT 1,
    created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'uq_cv_profiles_slug' AND object_id = OBJECT_ID(N'app.cv_profiles'))
BEGIN
  CREATE UNIQUE INDEX uq_cv_profiles_slug ON app.cv_profiles(slug) WHERE slug IS NOT NULL;
END
GO

-- 5. app.calendar_reminders: Create submission deadline reminders linked to regulations and periods
IF OBJECT_ID(N'app.calendar_reminders', N'U') IS NULL
BEGIN
  CREATE TABLE app.calendar_reminders (
    reminder_id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    user_id BIGINT NOT NULL CONSTRAINT fk_calendar_reminders_user FOREIGN KEY REFERENCES app.users(user_id),
    title NVARCHAR(255) NOT NULL,
    deadline_date DATETIME2(3) NOT NULL,
    regulation_id BIGINT NULL CONSTRAINT fk_calendar_reminders_regulation FOREIGN KEY REFERENCES app.regulation_documents(document_id),
    award_period_id BIGINT NULL CONSTRAINT fk_calendar_reminders_award_period FOREIGN KEY REFERENCES app.award_periods(award_period_id),
    kpi_goal_id BIGINT NULL CONSTRAINT fk_calendar_reminders_kpi_goal FOREIGN KEY REFERENCES app.kpi_goals(goal_id),
    event_id BIGINT NULL CONSTRAINT fk_calendar_reminders_event FOREIGN KEY REFERENCES app.personal_calendar_events(event_id),
    is_completed BIT NOT NULL DEFAULT 0,
    created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID(N'app.regulations', N'V') IS NULL AND OBJECT_ID(N'app.regulations', N'U') IS NULL
BEGIN
  EXEC(N'CREATE VIEW app.regulations AS SELECT document_id AS regulation_id, document_id, document_code, title, issuing_authority, document_type, description, is_active, created_at, updated_at FROM app.regulation_documents');
END
GO

-- 6. app.roles: Standardize 4 primary roles (MEMBER, DEPARTMENT_HEAD, FACULTY_LEAD, ADMIN) and deactivate legacy roles
IF NOT EXISTS (SELECT 1 FROM app.roles WHERE code = N'MEMBER')
BEGIN
  INSERT INTO app.roles (code, name, description, is_active)
  VALUES (N'MEMBER', N'Thành viên', N'Thành viên cá nhân (Giảng viên / Nghiên cứu viên / Người dùng tự do)', 1);
END;

IF NOT EXISTS (SELECT 1 FROM app.roles WHERE code = N'DEPARTMENT_HEAD')
BEGIN
  INSERT INTO app.roles (code, name, description, is_active)
  VALUES (N'DEPARTMENT_HEAD', N'Trưởng Bộ môn', N'Trưởng Bộ môn / GVCN quản lý nhân sự và thành tích cấp bộ môn', 1);
END;

IF NOT EXISTS (SELECT 1 FROM app.roles WHERE code = N'FACULTY_LEAD')
BEGIN
  INSERT INTO app.roles (code, name, description, is_active)
  VALUES (N'FACULTY_LEAD', N'Ban Chủ nhiệm Khoa', N'Ban Chủ nhiệm Khoa quản lý toàn khoa', 1);
END;

IF NOT EXISTS (SELECT 1 FROM app.roles WHERE code = N'ADMIN')
BEGIN
  INSERT INTO app.roles (code, name, description, is_active)
  VALUES (N'ADMIN', N'Quản trị viên Hệ thống', N'Quản trị viên hệ thống', 1);
END;

UPDATE app.roles
SET is_active = 1
WHERE code IN (N'MEMBER', N'DEPARTMENT_HEAD', N'FACULTY_LEAD', N'ADMIN');

UPDATE app.roles
SET is_active = 0
WHERE code IN (N'COUNCIL', N'RECORDS_OFFICER', N'UNIT_REPRESENTATIVE', N'MANAGER');
GO

-- 7. app.organization_units: Insert root UNIVERSITY unit LHU and update faculties FIT and PHARM
IF NOT EXISTS (SELECT 1 FROM app.organization_units WHERE code = N'LHU')
BEGIN
  INSERT INTO app.organization_units (code, name, parent_id, type, description, is_active, version)
  VALUES (N'LHU', N'Trường Đại học Lạc Hồng', NULL, N'UNIVERSITY', N'Đơn vị cấp trường / Root organization unit', 1, 1);
END;

DECLARE @lhu_id BIGINT = (SELECT unit_id FROM app.organization_units WHERE code = N'LHU');

UPDATE app.organization_units
SET parent_id = @lhu_id, updated_at = SYSUTCDATETIME()
WHERE code IN (N'FIT', N'PHARM') AND (parent_id IS NULL OR parent_id <> @lhu_id);
GO
