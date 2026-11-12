-- SQL Server 2017+ / compatibility level 140+. Final state of archived PostgreSQL migrations 01-31.
-- UTC DATETIME2(3), except calendar starts_at/ends_at: Vietnam local wall clock.
-- All FK deletes are NO ACTION: archival/history is never silently cascaded or unlinked.
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
IF SCHEMA_ID(N'app') IS NULL EXEC(N'CREATE SCHEMA app');

CREATE TABLE app.users (
  user_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  username NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
  email NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
  password_hash NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL,
  display_name NVARCHAR(100) COLLATE Latin1_General_100_BIN2 NOT NULL,
  status NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL DEFAULT N'ACTIVE',
  must_change_password BIT NOT NULL DEFAULT 0,
  password_changed_at DATETIME2(3) NULL,
  last_login_at DATETIME2(3) NULL,
  version BIGINT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOCKED', 'DELETED'))
);

CREATE TABLE app.roles (
  role_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  code NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
  name NVARCHAR(100) COLLATE Latin1_General_100_BIN2 NOT NULL,
  description NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NULL,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE app.user_roles (
  user_role_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  valid_from DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  valid_to DATETIME2(3) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  revoked_at DATETIME2(3),
  CONSTRAINT ck_user_roles_validity CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE app.organization_units (
  unit_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  code NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
  name NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL,
  parent_id BIGINT NULL,
  type NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL,
  is_active BIT NOT NULL DEFAULT 1,
  version BIGINT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  description NVARCHAR(MAX) NULL,
  CONSTRAINT ck_units_type CHECK (type IN ('FACULTY', 'DEPARTMENT', 'DIVISION', 'OFFICE', 'CENTER', 'UNIVERSITY'))
);

CREATE TABLE app.user_unit_scopes (
  user_unit_scope_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  unit_id BIGINT NOT NULL,
  include_descendants BIT NOT NULL DEFAULT 1,
  valid_from DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  valid_to DATETIME2(3) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  revoked_at DATETIME2(3),
  CONSTRAINT ck_user_unit_scopes_validity CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE app.lecturers (
  lecturer_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  employee_code NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
  full_name NVARCHAR(100) COLLATE Latin1_General_100_BIN2 NOT NULL,
  email NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL,
  phone NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NULL,
  title NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NULL,
  degree NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NULL,
  is_active BIT NOT NULL DEFAULT 1,
  version BIGINT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE app.lecturer_assignments (
  assignment_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  lecturer_id BIGINT NOT NULL,
  unit_id BIGINT NOT NULL,
  is_primary BIT NOT NULL DEFAULT 0,
  valid_from DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  valid_to DATETIME2(3) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  assigned_by BIGINT NOT NULL,
  CONSTRAINT ck_assignments_validity CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE app.achievement_categories (
  category_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  code NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
  name NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL,
  description NVARCHAR(500) COLLATE Latin1_General_100_BIN2 NULL,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE app.criteria (
  criterion_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  category_id BIGINT NOT NULL,
  code NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
  name NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL,
  points NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  requires_evidence BIT NOT NULL DEFAULT 1,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE app.achievements (
  achievement_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  criterion_id BIGINT NULL,
  lecturer_id BIGINT NULL,
  unit_id BIGINT NULL,
  context_unit_id BIGINT NOT NULL,
  title NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL,
  description NVARCHAR(MAX) NULL,
  achievement_date DATE NULL,
  status NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL DEFAULT N'DRAFT',
  submitted_at DATETIME2(3) NULL,
  verified_at DATETIME2(3) NULL,
  version BIGINT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  achievement_type_id BIGINT NULL,
  academic_year_id BIGINT NULL,
  created_by BIGINT,
  submitted_by BIGINT,
  contribution_role NVARCHAR(100) COLLATE Latin1_General_100_BIN2 NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  recognition_year INT NULL,
  replaces_achievement_id BIGINT,
  verified_by BIGINT,
  CONSTRAINT ck_achievements_subject_xor CHECK ( (lecturer_id IS NOT NULL AND unit_id IS NULL) OR (lecturer_id IS NULL AND unit_id IS NOT NULL) ),
  CONSTRAINT ck_achievements_status CHECK ( status IN ('DRAFT', 'SUBMITTED', 'NEED_CORRECTION', 'VERIFIED', 'REJECTED', 'CANCELLED', 'REVOKED', 'RETURNED') ),
  CONSTRAINT ck_achievements_dates CHECK ( end_date IS NULL OR start_date IS NULL OR end_date >= start_date ),
  CONSTRAINT ck_achievements_recognition_year CHECK ( recognition_year IS NULL OR recognition_year >= 1990 )
);

CREATE TABLE app.evidence_files (
  evidence_file_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  evidence_id BIGINT NOT NULL,
  version_no INT NOT NULL DEFAULT 1,
  original_file_name NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL,
  storage_key NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
  mime_type NVARCHAR(100) COLLATE Latin1_General_100_BIN2 NOT NULL,
  file_extension NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  sha256_hash NCHAR(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
  uploaded_by BIGINT NOT NULL,
  uploaded_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT uq_evidence_files_version UNIQUE (evidence_id, version_no)
);

CREATE TABLE app.achievement_verifications (
  verification_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  achievement_id BIGINT NOT NULL,
  verifier_user_id BIGINT NOT NULL,
  action NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL,
  comments NVARCHAR(MAX) NULL,
  verified_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT ck_verifications_action CHECK (action IN ('VERIFY', 'REJECT', 'RETURN'))
);

CREATE TABLE app.award_periods (
  award_period_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  code NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
  name NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL DEFAULT N'PLANNED',
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT ck_award_periods_status CHECK (status IN ('PLANNED', 'OPEN', 'IN_REVIEW', 'COMPLETED', 'CLOSED')),
  CONSTRAINT ck_award_periods_date CHECK (end_date >= start_date)
);

CREATE TABLE app.award_criteria (
  award_criterion_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  award_period_id BIGINT NOT NULL,
  criterion_id BIGINT NOT NULL,
  min_points NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  weight NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE app.award_applications (
  application_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  award_period_id BIGINT NOT NULL,
  lecturer_id BIGINT NULL,
  unit_id BIGINT NULL,
  total_points NUMERIC(8,2) NOT NULL DEFAULT 0.00,
  status NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL DEFAULT N'DRAFT',
  version BIGINT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  target_award_type_id BIGINT,
  context_unit_id BIGINT,
  created_by BIGINT,
  purpose NVARCHAR(2000) COLLATE Latin1_General_100_BIN2,
  achievement_ids NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
  award_record_ids NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
  CONSTRAINT ck_award_applications_subject_xor CHECK ( (lecturer_id IS NOT NULL AND unit_id IS NULL) OR (lecturer_id IS NULL AND unit_id IS NOT NULL) ),
  CONSTRAINT ck_award_applications_status CHECK(status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','COUNCIL_PENDING','NEED_CORRECTION','RECOMMENDED','NOT_RECOMMENDED')),
  CONSTRAINT ck_award_applications_achievement_ids_json CHECK (achievement_ids IS NULL OR ISJSON(achievement_ids) = 1),
  CONSTRAINT ck_award_applications_award_record_ids_json CHECK (award_record_ids IS NULL OR ISJSON(award_record_ids) = 1)
);

CREATE TABLE app.award_records (
  record_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  award_period_id BIGINT NULL,
  lecturer_id BIGINT NULL,
  unit_id BIGINT NULL,
  decision_number NVARCHAR(100) COLLATE Latin1_General_100_BIN2 NULL,
  decision_date DATE NULL,
  status NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL DEFAULT N'DRAFT',
  version BIGINT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  award_type_id BIGINT NULL,
  context_unit_id BIGINT,
  decision_id BIGINT,
  recognition_year INT CHECK (recognition_year BETWEEN 1990 AND 2100),
  recorded_by BIGINT,
  recorded_at DATETIME2(3),
  created_by BIGINT,
  replaces_award_record_id BIGINT,
  application_id BIGINT,
  application_input_version INT,
  CONSTRAINT ck_award_records_subject_xor CHECK ( (lecturer_id IS NOT NULL AND unit_id IS NULL) OR (lecturer_id IS NULL AND unit_id IS NOT NULL) ),
  CONSTRAINT ck_award_records_status CHECK (status IN ('DRAFT','RECORDED','REVOKED','CANCELLED')),
  CONSTRAINT ck_award_records_new_complete CHECK (decision_id IS NULL OR (context_unit_id IS NOT NULL AND recognition_year IS NOT NULL AND award_type_id IS NOT NULL AND created_by IS NOT NULL)),
  CONSTRAINT ck_award_record_application_input CHECK ((application_id IS NULL AND application_input_version IS NULL) OR (application_id IS NOT NULL AND application_input_version IS NOT NULL))
);

CREATE TABLE app.refresh_tokens (
  refresh_token_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  token_hash NVARCHAR(64) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
  expires_at DATETIME2(3) NOT NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  created_ip NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NULL,
  user_agent NVARCHAR(500) COLLATE Latin1_General_100_BIN2 NULL,
  revoked_at DATETIME2(3) NULL,
  replaced_by_token_id BIGINT NULL
);

CREATE TABLE app.audit_logs (
  audit_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NULL,
  action NVARCHAR(100) COLLATE Latin1_General_100_BIN2 NOT NULL,
  entity_name NVARCHAR(100) COLLATE Latin1_General_100_BIN2 NOT NULL,
  entity_id BIGINT NULL,
  old_values NVARCHAR(MAX) NULL,
  new_values NVARCHAR(MAX) NULL,
  ip_address NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NULL,
  user_agent NVARCHAR(500) COLLATE Latin1_General_100_BIN2 NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT ck_audit_logs_old_values_json CHECK (old_values IS NULL OR ISJSON(old_values) = 1),
  CONSTRAINT ck_audit_logs_new_values_json CHECK (new_values IS NULL OR ISJSON(new_values) = 1)
);

CREATE TABLE app.unit_representatives (
  unit_representative_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  unit_id BIGINT NOT NULL,
  valid_from DATETIME2(3) NOT NULL,
  valid_to DATETIME2(3) NULL,
  assigned_by BIGINT NOT NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  revoked_at DATETIME2(3),
  CONSTRAINT ck_unit_representatives_validity CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE TABLE app.academic_years (
  academic_year_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  code NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
  name NVARCHAR(100) COLLATE Latin1_General_100_BIN2 NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BIT NOT NULL DEFAULT 0,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT ck_academic_years_dates CHECK (end_date > start_date)
);

CREATE TABLE app.achievement_types (
  achievement_type_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  code NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
  name NVARCHAR(150) COLLATE Latin1_General_100_BIN2 NOT NULL,
  description NVARCHAR(500) COLLATE Latin1_General_100_BIN2 NULL,
  applicable_subject_type NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL DEFAULT N'BOTH',
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT ck_achievement_types_subject CHECK (applicable_subject_type IN ('LECTURER', 'UNIT', 'BOTH'))
);

CREATE TABLE app.award_types (
  award_type_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  code NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
  name NVARCHAR(150) COLLATE Latin1_General_100_BIN2 NOT NULL,
  category NVARCHAR(30) COLLATE Latin1_General_100_BIN2 NOT NULL,
  level NVARCHAR(30) COLLATE Latin1_General_100_BIN2 NOT NULL,
  applicable_subject_type NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL DEFAULT N'BOTH',
  description NVARCHAR(500) COLLATE Latin1_General_100_BIN2 NULL,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT ck_award_types_category CHECK (category IN ('TITLE', 'REWARD_FORM')),
  CONSTRAINT ck_award_types_level CHECK (level IN ('FACULTY', 'UNIVERSITY', 'MINISTRY', 'STATE')),
  CONSTRAINT ck_award_types_subject CHECK (applicable_subject_type IN ('LECTURER', 'UNIT', 'BOTH'))
);

CREATE TABLE app.evidences (
  evidence_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  achievement_id BIGINT NOT NULL,
  title NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL,
  description NVARCHAR(MAX) NULL,
  is_removed BIT NOT NULL DEFAULT 0,
  created_by BIGINT NOT NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE app.award_decisions (
  decision_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  decision_number NVARCHAR(100) COLLATE Latin1_General_100_BIN2 NOT NULL CHECK (LEN(LTRIM(RTRIM(decision_number))) > 0),
  decision_date DATE NOT NULL,
  issuer NVARCHAR(150) COLLATE Latin1_General_100_BIN2 NOT NULL CHECK (LEN(LTRIM(RTRIM(issuer))) > 0),
  title NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL,
  created_by BIGINT NOT NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UNIQUE (issuer, decision_number, decision_date)
);

CREATE TABLE app.award_decision_files (
  decision_file_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  decision_id BIGINT NOT NULL,
  version_no INT NOT NULL CHECK (version_no > 0),
  original_file_name NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL,
  storage_key NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
  mime_type NVARCHAR(100) COLLATE Latin1_General_100_BIN2 NOT NULL,
  file_extension NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size BETWEEN 1 AND 10485760),
  sha256_hash NCHAR(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
  uploaded_by BIGINT NOT NULL,
  uploaded_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UNIQUE (decision_id, version_no)
);

CREATE TABLE app.award_record_achievements (
  record_id BIGINT NOT NULL,
  achievement_id BIGINT NOT NULL,
  linked_by BIGINT NOT NULL,
  PRIMARY KEY(record_id,achievement_id)
);

CREATE TABLE app.award_record_histories (
  history_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  record_id BIGINT NOT NULL,
  from_status NVARCHAR(20) COLLATE Latin1_General_100_BIN2,
  to_status NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL,
  actor_id BIGINT NOT NULL,
  reason NVARCHAR(1000) COLLATE Latin1_General_100_BIN2,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE app.notifications (
  notification_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  entity_type NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL CHECK(entity_type IN (N'AWARD',N'ACHIEVEMENT',N'APPLICATION')),
  entity_id BIGINT NOT NULL CHECK (entity_id > 0),
  entity_version BIGINT NOT NULL CHECK (entity_version > 1),
  from_status NVARCHAR(30) COLLATE Latin1_General_100_BIN2 NOT NULL,
  to_status NVARCHAR(30) COLLATE Latin1_General_100_BIN2 NOT NULL,
  audience NVARCHAR(10) COLLATE Latin1_General_100_BIN2 NOT NULL CHECK (audience IN (N'SUBJECT',N'MANAGER')),
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  read_at DATETIME2(3),
  UNIQUE(user_id, entity_type, entity_id, entity_version),
  CHECK(entity_type IN ('AWARD','ACHIEVEMENT','APPLICATION'))
);

CREATE TABLE app.achievement_submissions (
  submission_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  achievement_id BIGINT NOT NULL,
  revision_no INT NOT NULL CHECK (revision_no > 0),
  snapshot_data NVARCHAR(MAX) NOT NULL,
  submitted_by BIGINT NOT NULL,
  submitted_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT uq_achievement_submissions_revision UNIQUE (achievement_id, revision_no),
  CONSTRAINT ck_achievement_submissions_snapshot_data_json CHECK (snapshot_data IS NULL OR ISJSON(snapshot_data) = 1)
);

CREATE TABLE app.submission_evidence_files (
  submission_id BIGINT NOT NULL,
  evidence_file_id BIGINT NOT NULL,
  attached_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  PRIMARY KEY (submission_id, evidence_file_id)
);

CREATE TABLE app.achievement_status_histories (
  history_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  achievement_id BIGINT NOT NULL,
  submission_id BIGINT NULL,
  from_status NVARCHAR(30) COLLATE Latin1_General_100_BIN2 NOT NULL,
  to_status NVARCHAR(30) COLLATE Latin1_General_100_BIN2 NOT NULL,
  actor_id BIGINT NOT NULL,
  reason NVARCHAR(MAX) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE app.kpi_goals (
  goal_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  lecturer_id BIGINT,
  unit_id BIGINT,
  context_unit_id BIGINT NOT NULL,
  code NVARCHAR(80) COLLATE Latin1_General_100_BIN2 NOT NULL,
  title NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL,
  measure_unit NVARCHAR(80) COLLATE Latin1_General_100_BIN2 NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target DECIMAL(28,8) NOT NULL CHECK(target >= 0),
  [plan] NVARCHAR(MAX) NOT NULL DEFAULT N'',
  source NVARCHAR(10) COLLATE Latin1_General_100_BIN2 NOT NULL CHECK(source IN (N'MANUAL',N'CSV')),
  source_note NVARCHAR(MAX) NOT NULL,
  status NVARCHAR(12) COLLATE Latin1_General_100_BIN2 NOT NULL DEFAULT N'DRAFT' CHECK(status IN (N'DRAFT',N'ACCEPTED')),
  accepted_by BIGINT,
  accepted_at DATETIME2(3),
  created_by BIGINT NOT NULL,
  version BIGINT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CHECK ((lecturer_id IS NULL AND unit_id IS NOT NULL) OR (lecturer_id IS NOT NULL AND unit_id IS NULL)),
  CHECK(period_end >= period_start),
  CHECK(period_start >= '1990-01-01' AND period_end <= '2100-12-31'),
  CHECK((status='DRAFT' AND accepted_by IS NULL AND accepted_at IS NULL) OR (status='ACCEPTED' AND accepted_by IS NOT NULL AND accepted_at IS NOT NULL))
);

CREATE TABLE app.kpi_results (
  result_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  goal_id BIGINT NOT NULL UNIQUE,
  actual DECIMAL(28,8) NOT NULL CHECK(actual >= 0),
  source NVARCHAR(10) COLLATE Latin1_General_100_BIN2 NOT NULL CHECK(source IN (N'MANUAL',N'CSV')),
  source_note NVARCHAR(MAX) NOT NULL,
  evidence_note NVARCHAR(MAX) NOT NULL,
  achievement_id BIGINT,
  created_by BIGINT NOT NULL,
  version BIGINT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE app.regulation_documents (
  document_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  document_code NVARCHAR(100) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
  title NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL,
  issuing_authority NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NULL,
  document_type NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL CHECK (document_type IN (N'LAW', N'CIRCULAR', N'UNIVERSITY_REGULATION', N'DECISION', N'GUIDELINE')),
  description NVARCHAR(MAX) NULL,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE app.regulation_document_versions (
  version_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  document_id BIGINT NOT NULL,
  version_number NVARCHAR(100) COLLATE Latin1_General_100_BIN2 NOT NULL,
  sha256_hash NVARCHAR(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
  source_url NVARCHAR(1000) COLLATE Latin1_General_100_BIN2 NULL,
  signed_date DATE NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  supersedes_version_id BIGINT NULL,
  is_official BIT NOT NULL DEFAULT 1,
  is_confirmed BIT NOT NULL DEFAULT 0,
  confirmed_by BIGINT NULL,
  confirmed_at DATETIME2(3) NULL,
  confirmation_notes NVARCHAR(MAX) NULL,
  lhu_application_status NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL DEFAULT N'INTERNAL_CRITERIA_UNCONFIRMED' CHECK (lhu_application_status IN (N'CONFIRMED_LHU_POLICY', N'INTERNAL_CRITERIA_UNCONFIRMED', N'SIMULATION_ONLY', N'REJECTED')),
  created_by BIGINT NOT NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT uq_reg_doc_version UNIQUE (document_id, version_number),
  CONSTRAINT ck_reg_doc_version_effective CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE app.regulation_chunks (
  chunk_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  version_id BIGINT NOT NULL,
  article_no NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NULL,
  clause_no NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NULL,
  page_no INT NULL,
  content NVARCHAR(MAX) NOT NULL,
  chunk_hash NVARCHAR(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE app.award_criteria_versions (
  criteria_version_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  version_id BIGINT NOT NULL,
  criterion_code NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL,
  name NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL,
  target_type NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL CHECK (target_type IN (N'INDIVIDUAL', N'COLLECTIVE', N'BOTH')),
  academic_year_id BIGINT NULL,
  min_threshold NUMERIC(10, 2) NULL,
  unit_metric NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NULL,
  legal_references NVARCHAR(MAX) NULL,
  is_confirmed BIT NOT NULL DEFAULT 0,
  confirmed_by BIGINT NULL,
  confirmed_at DATETIME2(3) NULL,
  notes NVARCHAR(MAX) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  source_rules NVARCHAR(MAX),
  source_rules_revision INT NOT NULL DEFAULT 0,
  source_rules_by BIGINT,
  CONSTRAINT uq_award_criteria_version_code UNIQUE (version_id, criterion_code),
  CONSTRAINT ck_award_criteria_versions_source_rules_json CHECK (source_rules IS NULL OR ISJSON(source_rules) = 1)
);

CREATE TABLE app.award_application_inputs (
  application_id BIGINT NOT NULL,
  input_version INT NOT NULL,
  snapshot NVARCHAR(MAX) NOT NULL,
  submitted_by BIGINT NOT NULL,
  submitted_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  PRIMARY KEY(application_id,input_version),
  CHECK(input_version > 0),
  CONSTRAINT ck_award_application_inputs_snapshot_json CHECK (snapshot IS NULL OR ISJSON(snapshot) = 1)
);

CREATE TABLE app.award_application_histories (
  history_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  application_id BIGINT NOT NULL,
  from_status NVARCHAR(20) COLLATE Latin1_General_100_BIN2,
  to_status NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL,
  actor_id BIGINT NOT NULL,
  reason NVARCHAR(1000) COLLATE Latin1_General_100_BIN2,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE app.evaluation_runs (
  run_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  evaluation_type NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL CHECK (evaluation_type IN (N'CRITERION_ASSESSMENT', N'KPI_VERIFICATION', N'BATCH_BENCHMARK')),
  subject_type NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL CHECK (subject_type IN (N'LECTURER', N'UNIT')),
  subject_id BIGINT NOT NULL,
  achievement_id BIGINT NULL,
  application_id BIGINT NULL,
  kpi_goal_id BIGINT NULL,
  provider NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL DEFAULT N'mock',
  model NVARCHAR(100) COLLATE Latin1_General_100_BIN2 NOT NULL,
  is_mock BIT NOT NULL DEFAULT 0,
  overall_status NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL CHECK (overall_status IN (N'COMPLETED', N'FLAGGED_UNCONFIRMED', N'FAILED')),
  overall_conclusion NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL CHECK (overall_conclusion IN (N'ELIGIBLE', N'INELIGIBLE', N'NEEDS_HUMAN_REVIEW', N'SIMULATION_ONLY')),
  automatic_award_granted BIT NOT NULL DEFAULT 0 CHECK (automatic_award_granted = 0),
  input_snapshot NVARCHAR(MAX) NOT NULL,
  input_hash NVARCHAR(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  is_stale BIT NOT NULL DEFAULT 0,
  executed_by BIGINT NOT NULL,
  executed_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT ck_evaluation_runs_input_snapshot_json CHECK (input_snapshot IS NULL OR ISJSON(input_snapshot) = 1)
);

CREATE TABLE app.evaluation_criterion_results (
  result_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  run_id UNIQUEIDENTIFIER NOT NULL,
  criterion_id BIGINT NOT NULL,
  criterion_code NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL,
  criterion_name NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL,
  is_confirmed_by_lhu BIT NOT NULL DEFAULT 0,
  is_simulation BIT NOT NULL DEFAULT 0,
  target_min NUMERIC(10, 2) NULL,
  actual_recorded NUMERIC(10, 2) NULL,
  unit_metric NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NULL,
  is_satisfied NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL,
  distinct_years INT NULL,
  consecutive_years BIT NULL,
  legal_references NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
  ai_analysis NVARCHAR(MAX) NOT NULL,
  human_review_required BIT NOT NULL DEFAULT 1,
  warning_notice NVARCHAR(MAX) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT ck_evaluation_criterion_results_legal_references_json CHECK (legal_references IS NULL OR ISJSON(legal_references) = 1)
);

CREATE TABLE app.regulation_chunk_embeddings (
  chunk_id BIGINT PRIMARY KEY,
  embedding_model NVARCHAR(100) COLLATE Latin1_General_100_BIN2 NOT NULL,
  embedding_dim INT NOT NULL,
  embedding_vector NVARCHAR(MAX) NOT NULL,
  chunk_hash NVARCHAR(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
  indexed_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT ck_regulation_chunk_embeddings_embedding_vector_json CHECK (embedding_vector IS NULL OR ISJSON(embedding_vector) = 1)
);

CREATE TABLE app.ai_rag_explanations (
  explanation_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  run_id UNIQUEIDENTIFIER NULL,
  criterion_id BIGINT NULL,
  query_text NVARCHAR(MAX) NOT NULL,
  retrieved_chunk_ids NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
  citations NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
  explanation_text NVARCHAR(MAX) NOT NULL,
  model NVARCHAR(100) COLLATE Latin1_General_100_BIN2 NOT NULL,
  provider NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL,
  prompt_version NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL,
  retrieval_version NVARCHAR(50) COLLATE Latin1_General_100_BIN2 NOT NULL,
  is_sufficient_data BIT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT ck_ai_rag_explanations_retrieved_chunk_ids_json CHECK (retrieved_chunk_ids IS NULL OR ISJSON(retrieved_chunk_ids) = 1),
  CONSTRAINT ck_ai_rag_explanations_citations_json CHECK (citations IS NULL OR ISJSON(citations) = 1)
);

CREATE TABLE app.kpi_recommendations (
  recommendation_id UNIQUEIDENTIFIER PRIMARY KEY,
  run_id UNIQUEIDENTIFIER NOT NULL,
  criterion_id BIGINT NOT NULL,
  created_by BIGINT NOT NULL,
  payload NVARCHAR(MAX) NOT NULL,
  provider_evidence NVARCHAR(MAX) NOT NULL,
  status NVARCHAR(12) COLLATE Latin1_General_100_BIN2 NOT NULL DEFAULT N'PENDING' CHECK(status IN (N'PENDING',N'ACCEPTED',N'REJECTED')),
  goal_id BIGINT,
  version BIGINT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CHECK ((status='ACCEPTED' AND goal_id IS NOT NULL) OR (status<>'ACCEPTED' AND goal_id IS NULL)),
  CONSTRAINT ck_kpi_recommendations_payload_json CHECK (payload IS NULL OR ISJSON(payload) = 1),
  CONSTRAINT ck_kpi_recommendations_provider_evidence_json CHECK (provider_evidence IS NULL OR ISJSON(provider_evidence) = 1)
);

CREATE TABLE app.external_kpi_mappings (
  employee_id NVARCHAR(80) COLLATE Latin1_General_100_BIN2 PRIMARY KEY,
  lecturer_id BIGINT NOT NULL,
  created_by BIGINT NOT NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE app.external_kpi_runs (
  run_id UNIQUEIDENTIFIER PRIMARY KEY,
  retry_of UNIQUEIDENTIFIER,
  created_by BIGINT NOT NULL,
  status NVARCHAR(MAX) NOT NULL CHECK(status IN (N'RUNNING',N'COMPLETED',N'FAILED')),
  attempts INT NOT NULL DEFAULT 0,
  summary NVARCHAR(MAX) NOT NULL DEFAULT N'{}',
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  finished_at DATETIME2(3),
  CONSTRAINT ck_external_kpi_runs_summary_json CHECK (summary IS NULL OR ISJSON(summary) = 1)
);

CREATE TABLE app.external_kpi_records (
  record_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  external_id NVARCHAR(80) COLLATE Latin1_General_100_BIN2 NOT NULL,
  source_version BIGINT NOT NULL,
  payload NVARCHAR(MAX) NOT NULL,
  payload_hash NVARCHAR(MAX) NOT NULL,
  lecturer_id BIGINT,
  status NVARCHAR(MAX) NOT NULL CHECK(status IN (N'READY',N'QUARANTINED',N'DRAFTED')),
  reason NVARCHAR(MAX),
  achievement_id BIGINT,
  version BIGINT NOT NULL DEFAULT 1,
  UNIQUE(external_id,source_version),
  CONSTRAINT ck_external_kpi_records_payload_json CHECK (payload IS NULL OR ISJSON(payload) = 1)
);

CREATE TABLE app.external_kpi_run_items (
  run_id UNIQUEIDENTIFIER NOT NULL,
  item_index INT NOT NULL,
  record_id BIGINT,
  outcome NVARCHAR(MAX) NOT NULL,
  PRIMARY KEY(run_id,item_index)
);

CREATE TABLE app.application_reviews (
  review_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  application_id BIGINT NOT NULL,
  reviewer_id BIGINT NOT NULL,
  assigned_by BIGINT NOT NULL,
  assigned_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UNIQUE(application_id,reviewer_id)
);

CREATE TABLE app.application_review_comments (
  comment_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  application_id BIGINT NOT NULL,
  actor_id BIGINT NOT NULL,
  action NVARCHAR(30) COLLATE Latin1_General_100_BIN2 NOT NULL,
  content NVARCHAR(1000) COLLATE Latin1_General_100_BIN2 NOT NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE app.personal_calendar_events (
  event_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  title NVARCHAR(160) COLLATE Latin1_General_100_BIN2 NOT NULL CHECK (LEN(LTRIM(RTRIM(title))) > 0),
  description NVARCHAR(MAX) NOT NULL DEFAULT N'' CHECK (LEN(description) <= 4000),
  location NVARCHAR(500) COLLATE Latin1_General_100_BIN2 NOT NULL DEFAULT N'',
  category NVARCHAR(20) COLLATE Latin1_General_100_BIN2 NOT NULL CHECK (category IN (N'exam',N'competition',N'task',N'personal')),
  starts_at DATETIME2(3) NOT NULL,
  ends_at DATETIME2(3) NOT NULL,
  all_day BIT NOT NULL DEFAULT 0,
  completed BIT NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CHECK(ends_at >= starts_at)
);

CREATE TABLE app.lecturer_cvs (
  lecturer_id BIGINT PRIMARY KEY,
  public_id NVARCHAR(32) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
  draft NVARCHAR(MAX) NOT NULL DEFAULT N'{}',
  published NVARCHAR(MAX),
  version INT NOT NULL DEFAULT 1,
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  published_draft NVARCHAR(MAX),
  published_at DATETIME2(3),
  CONSTRAINT ck_lecturer_cvs_draft_json CHECK (draft IS NULL OR ISJSON(draft) = 1),
  CONSTRAINT ck_lecturer_cvs_published_json CHECK (published IS NULL OR ISJSON(published) = 1),
  CONSTRAINT ck_lecturer_cvs_published_draft_json CHECK (published_draft IS NULL OR ISJSON(published_draft) = 1)
);

CREATE TABLE app.criteria_source_rule_history (
  history_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  criteria_version_id BIGINT NOT NULL,
  revision INT NOT NULL,
  previous_rules NVARCHAR(MAX),
  source_rules NVARCHAR(MAX),
  changed_by BIGINT,
  changed_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT ck_criteria_source_rule_history_previous_rules_json CHECK (previous_rules IS NULL OR ISJSON(previous_rules) = 1),
  CONSTRAINT ck_criteria_source_rule_history_source_rules_json CHECK (source_rules IS NULL OR ISJSON(source_rules) = 1)
);

ALTER TABLE app.user_roles ADD CONSTRAINT fk_user_roles_user_id FOREIGN KEY(user_id) REFERENCES app.users(user_id);
ALTER TABLE app.user_roles ADD CONSTRAINT fk_user_roles_role_id FOREIGN KEY(role_id) REFERENCES app.roles(role_id);
ALTER TABLE app.organization_units ADD CONSTRAINT fk_organization_units_parent_id FOREIGN KEY(parent_id) REFERENCES app.organization_units(unit_id);
ALTER TABLE app.user_unit_scopes ADD CONSTRAINT fk_user_unit_scopes_user_id FOREIGN KEY(user_id) REFERENCES app.users(user_id);
ALTER TABLE app.user_unit_scopes ADD CONSTRAINT fk_user_unit_scopes_role_id FOREIGN KEY(role_id) REFERENCES app.roles(role_id);
ALTER TABLE app.user_unit_scopes ADD CONSTRAINT fk_user_unit_scopes_unit_id FOREIGN KEY(unit_id) REFERENCES app.organization_units(unit_id);
ALTER TABLE app.lecturers ADD CONSTRAINT fk_lecturers_user_id FOREIGN KEY(user_id) REFERENCES app.users(user_id);
ALTER TABLE app.lecturer_assignments ADD CONSTRAINT fk_lecturer_assignments_lecturer_id FOREIGN KEY(lecturer_id) REFERENCES app.lecturers(lecturer_id);
ALTER TABLE app.lecturer_assignments ADD CONSTRAINT fk_lecturer_assignments_unit_id FOREIGN KEY(unit_id) REFERENCES app.organization_units(unit_id);
ALTER TABLE app.lecturer_assignments ADD CONSTRAINT fk_lecturer_assignments_assigned_by FOREIGN KEY(assigned_by) REFERENCES app.users(user_id);
ALTER TABLE app.criteria ADD CONSTRAINT fk_criteria_category_id FOREIGN KEY(category_id) REFERENCES app.achievement_categories(category_id);
ALTER TABLE app.achievements ADD CONSTRAINT fk_achievements_criterion_id FOREIGN KEY(criterion_id) REFERENCES app.criteria(criterion_id);
ALTER TABLE app.achievements ADD CONSTRAINT fk_achievements_lecturer_id FOREIGN KEY(lecturer_id) REFERENCES app.lecturers(lecturer_id);
ALTER TABLE app.achievements ADD CONSTRAINT fk_achievements_unit_id FOREIGN KEY(unit_id) REFERENCES app.organization_units(unit_id);
ALTER TABLE app.achievements ADD CONSTRAINT fk_achievements_context_unit_id FOREIGN KEY(context_unit_id) REFERENCES app.organization_units(unit_id);
ALTER TABLE app.achievements ADD CONSTRAINT fk_achievements_achievement_type_id FOREIGN KEY(achievement_type_id) REFERENCES app.achievement_types(achievement_type_id);
ALTER TABLE app.achievements ADD CONSTRAINT fk_achievements_academic_year_id FOREIGN KEY(academic_year_id) REFERENCES app.academic_years(academic_year_id);
ALTER TABLE app.achievements ADD CONSTRAINT fk_achievements_created_by FOREIGN KEY(created_by) REFERENCES app.users(user_id);
ALTER TABLE app.achievements ADD CONSTRAINT fk_achievements_submitted_by FOREIGN KEY(submitted_by) REFERENCES app.users(user_id);
ALTER TABLE app.achievements ADD CONSTRAINT fk_achievements_replaces_achievement_id FOREIGN KEY(replaces_achievement_id) REFERENCES app.achievements(achievement_id);
ALTER TABLE app.achievements ADD CONSTRAINT fk_achievements_verified_by FOREIGN KEY(verified_by) REFERENCES app.users(user_id);
ALTER TABLE app.evidence_files ADD CONSTRAINT fk_evidence_files_evidence_id FOREIGN KEY(evidence_id) REFERENCES app.evidences(evidence_id);
ALTER TABLE app.evidence_files ADD CONSTRAINT fk_evidence_files_uploaded_by FOREIGN KEY(uploaded_by) REFERENCES app.users(user_id);
ALTER TABLE app.achievement_verifications ADD CONSTRAINT fk_achievement_verifications_achievement_id FOREIGN KEY(achievement_id) REFERENCES app.achievements(achievement_id);
ALTER TABLE app.achievement_verifications ADD CONSTRAINT fk_achievement_verifications_verifier_user_id FOREIGN KEY(verifier_user_id) REFERENCES app.users(user_id);
ALTER TABLE app.award_criteria ADD CONSTRAINT fk_award_criteria_award_period_id FOREIGN KEY(award_period_id) REFERENCES app.award_periods(award_period_id);
ALTER TABLE app.award_criteria ADD CONSTRAINT fk_award_criteria_criterion_id FOREIGN KEY(criterion_id) REFERENCES app.criteria(criterion_id);
ALTER TABLE app.award_applications ADD CONSTRAINT fk_award_applications_award_period_id FOREIGN KEY(award_period_id) REFERENCES app.award_periods(award_period_id);
ALTER TABLE app.award_applications ADD CONSTRAINT fk_award_applications_lecturer_id FOREIGN KEY(lecturer_id) REFERENCES app.lecturers(lecturer_id);
ALTER TABLE app.award_applications ADD CONSTRAINT fk_award_applications_unit_id FOREIGN KEY(unit_id) REFERENCES app.organization_units(unit_id);
ALTER TABLE app.award_applications ADD CONSTRAINT fk_award_applications_target_award_type_id FOREIGN KEY(target_award_type_id) REFERENCES app.award_types(award_type_id);
ALTER TABLE app.award_applications ADD CONSTRAINT fk_award_applications_context_unit_id FOREIGN KEY(context_unit_id) REFERENCES app.organization_units(unit_id);
ALTER TABLE app.award_applications ADD CONSTRAINT fk_award_applications_created_by FOREIGN KEY(created_by) REFERENCES app.users(user_id);
ALTER TABLE app.award_records ADD CONSTRAINT fk_award_records_award_period_id FOREIGN KEY(award_period_id) REFERENCES app.award_periods(award_period_id);
ALTER TABLE app.award_records ADD CONSTRAINT fk_award_records_lecturer_id FOREIGN KEY(lecturer_id) REFERENCES app.lecturers(lecturer_id);
ALTER TABLE app.award_records ADD CONSTRAINT fk_award_records_unit_id FOREIGN KEY(unit_id) REFERENCES app.organization_units(unit_id);
ALTER TABLE app.award_records ADD CONSTRAINT fk_award_records_award_type_id FOREIGN KEY(award_type_id) REFERENCES app.award_types(award_type_id);
ALTER TABLE app.award_records ADD CONSTRAINT fk_award_records_context_unit_id FOREIGN KEY(context_unit_id) REFERENCES app.organization_units(unit_id);
ALTER TABLE app.award_records ADD CONSTRAINT fk_award_records_decision_id FOREIGN KEY(decision_id) REFERENCES app.award_decisions(decision_id);
ALTER TABLE app.award_records ADD CONSTRAINT fk_award_records_recorded_by FOREIGN KEY(recorded_by) REFERENCES app.users(user_id);
ALTER TABLE app.award_records ADD CONSTRAINT fk_award_records_created_by FOREIGN KEY(created_by) REFERENCES app.users(user_id);
ALTER TABLE app.award_records ADD CONSTRAINT fk_award_records_replaces_award_record_id FOREIGN KEY(replaces_award_record_id) REFERENCES app.award_records(record_id);
ALTER TABLE app.award_records ADD CONSTRAINT fk_award_records_application_id FOREIGN KEY(application_id) REFERENCES app.award_applications(application_id);
ALTER TABLE app.award_records ADD CONSTRAINT fk_award_record_application_input FOREIGN KEY(application_id,application_input_version)
   REFERENCES app.award_application_inputs(application_id,input_version);
ALTER TABLE app.refresh_tokens ADD CONSTRAINT fk_refresh_tokens_user_id FOREIGN KEY(user_id) REFERENCES app.users(user_id);
ALTER TABLE app.refresh_tokens ADD CONSTRAINT fk_refresh_tokens_replaced_by_token_id FOREIGN KEY(replaced_by_token_id) REFERENCES app.refresh_tokens(refresh_token_id);
ALTER TABLE app.audit_logs ADD CONSTRAINT fk_audit_logs_user_id FOREIGN KEY(user_id) REFERENCES app.users(user_id);
ALTER TABLE app.unit_representatives ADD CONSTRAINT fk_unit_representatives_user_id FOREIGN KEY(user_id) REFERENCES app.users(user_id);
ALTER TABLE app.unit_representatives ADD CONSTRAINT fk_unit_representatives_unit_id FOREIGN KEY(unit_id) REFERENCES app.organization_units(unit_id);
ALTER TABLE app.unit_representatives ADD CONSTRAINT fk_unit_representatives_assigned_by FOREIGN KEY(assigned_by) REFERENCES app.users(user_id);
ALTER TABLE app.evidences ADD CONSTRAINT fk_evidences_achievement_id FOREIGN KEY(achievement_id) REFERENCES app.achievements(achievement_id);
ALTER TABLE app.evidences ADD CONSTRAINT fk_evidences_created_by FOREIGN KEY(created_by) REFERENCES app.users(user_id);
ALTER TABLE app.award_decisions ADD CONSTRAINT fk_award_decisions_created_by FOREIGN KEY(created_by) REFERENCES app.users(user_id);
ALTER TABLE app.award_decision_files ADD CONSTRAINT fk_award_decision_files_decision_id FOREIGN KEY(decision_id) REFERENCES app.award_decisions(decision_id);
ALTER TABLE app.award_decision_files ADD CONSTRAINT fk_award_decision_files_uploaded_by FOREIGN KEY(uploaded_by) REFERENCES app.users(user_id);
ALTER TABLE app.award_record_achievements ADD CONSTRAINT fk_award_record_achievements_record_id FOREIGN KEY(record_id) REFERENCES app.award_records(record_id);
ALTER TABLE app.award_record_achievements ADD CONSTRAINT fk_award_record_achievements_achievement_id FOREIGN KEY(achievement_id) REFERENCES app.achievements(achievement_id);
ALTER TABLE app.award_record_achievements ADD CONSTRAINT fk_award_record_achievements_linked_by FOREIGN KEY(linked_by) REFERENCES app.users(user_id);
ALTER TABLE app.award_record_histories ADD CONSTRAINT fk_award_record_histories_record_id FOREIGN KEY(record_id) REFERENCES app.award_records(record_id);
ALTER TABLE app.award_record_histories ADD CONSTRAINT fk_award_record_histories_actor_id FOREIGN KEY(actor_id) REFERENCES app.users(user_id);
ALTER TABLE app.notifications ADD CONSTRAINT fk_notifications_user_id FOREIGN KEY(user_id) REFERENCES app.users(user_id);
ALTER TABLE app.achievement_submissions ADD CONSTRAINT fk_achievement_submissions_achievement_id FOREIGN KEY(achievement_id) REFERENCES app.achievements(achievement_id);
ALTER TABLE app.achievement_submissions ADD CONSTRAINT fk_achievement_submissions_submitted_by FOREIGN KEY(submitted_by) REFERENCES app.users(user_id);
ALTER TABLE app.submission_evidence_files ADD CONSTRAINT fk_submission_evidence_files_submission_id FOREIGN KEY(submission_id) REFERENCES app.achievement_submissions(submission_id);
ALTER TABLE app.submission_evidence_files ADD CONSTRAINT fk_submission_evidence_files_evidence_file_id FOREIGN KEY(evidence_file_id) REFERENCES app.evidence_files(evidence_file_id);
ALTER TABLE app.achievement_status_histories ADD CONSTRAINT fk_achievement_status_histories_achievement_id FOREIGN KEY(achievement_id) REFERENCES app.achievements(achievement_id);
ALTER TABLE app.achievement_status_histories ADD CONSTRAINT fk_achievement_status_histories_submission_id FOREIGN KEY(submission_id) REFERENCES app.achievement_submissions(submission_id);
ALTER TABLE app.achievement_status_histories ADD CONSTRAINT fk_achievement_status_histories_actor_id FOREIGN KEY(actor_id) REFERENCES app.users(user_id);
ALTER TABLE app.kpi_goals ADD CONSTRAINT fk_kpi_goals_lecturer_id FOREIGN KEY(lecturer_id) REFERENCES app.lecturers(lecturer_id);
ALTER TABLE app.kpi_goals ADD CONSTRAINT fk_kpi_goals_unit_id FOREIGN KEY(unit_id) REFERENCES app.organization_units(unit_id);
ALTER TABLE app.kpi_goals ADD CONSTRAINT fk_kpi_goals_context_unit_id FOREIGN KEY(context_unit_id) REFERENCES app.organization_units(unit_id);
ALTER TABLE app.kpi_goals ADD CONSTRAINT fk_kpi_goals_accepted_by FOREIGN KEY(accepted_by) REFERENCES app.users(user_id);
ALTER TABLE app.kpi_goals ADD CONSTRAINT fk_kpi_goals_created_by FOREIGN KEY(created_by) REFERENCES app.users(user_id);
ALTER TABLE app.kpi_results ADD CONSTRAINT fk_kpi_results_goal_id FOREIGN KEY(goal_id) REFERENCES app.kpi_goals(goal_id);
ALTER TABLE app.kpi_results ADD CONSTRAINT fk_kpi_results_achievement_id FOREIGN KEY(achievement_id) REFERENCES app.achievements(achievement_id);
ALTER TABLE app.kpi_results ADD CONSTRAINT fk_kpi_results_created_by FOREIGN KEY(created_by) REFERENCES app.users(user_id);
ALTER TABLE app.regulation_document_versions ADD CONSTRAINT fk_regulation_document_versions_document_id FOREIGN KEY(document_id) REFERENCES app.regulation_documents(document_id);
ALTER TABLE app.regulation_document_versions ADD CONSTRAINT fk_regulation_document_versions_supersedes_version_id FOREIGN KEY(supersedes_version_id) REFERENCES app.regulation_document_versions(version_id);
ALTER TABLE app.regulation_document_versions ADD CONSTRAINT fk_regulation_document_versions_confirmed_by FOREIGN KEY(confirmed_by) REFERENCES app.users(user_id);
ALTER TABLE app.regulation_document_versions ADD CONSTRAINT fk_regulation_document_versions_created_by FOREIGN KEY(created_by) REFERENCES app.users(user_id);
ALTER TABLE app.regulation_chunks ADD CONSTRAINT fk_regulation_chunks_version_id FOREIGN KEY(version_id) REFERENCES app.regulation_document_versions(version_id);
ALTER TABLE app.award_criteria_versions ADD CONSTRAINT fk_award_criteria_versions_version_id FOREIGN KEY(version_id) REFERENCES app.regulation_document_versions(version_id);
ALTER TABLE app.award_criteria_versions ADD CONSTRAINT fk_award_criteria_versions_academic_year_id FOREIGN KEY(academic_year_id) REFERENCES app.academic_years(academic_year_id);
ALTER TABLE app.award_criteria_versions ADD CONSTRAINT fk_award_criteria_versions_confirmed_by FOREIGN KEY(confirmed_by) REFERENCES app.users(user_id);
ALTER TABLE app.award_criteria_versions ADD CONSTRAINT fk_award_criteria_versions_source_rules_by FOREIGN KEY(source_rules_by) REFERENCES app.users(user_id);
ALTER TABLE app.award_application_inputs ADD CONSTRAINT fk_award_application_inputs_application_id FOREIGN KEY(application_id) REFERENCES app.award_applications(application_id);
ALTER TABLE app.award_application_inputs ADD CONSTRAINT fk_award_application_inputs_submitted_by FOREIGN KEY(submitted_by) REFERENCES app.users(user_id);
ALTER TABLE app.award_application_histories ADD CONSTRAINT fk_award_application_histories_application_id FOREIGN KEY(application_id) REFERENCES app.award_applications(application_id);
ALTER TABLE app.award_application_histories ADD CONSTRAINT fk_award_application_histories_actor_id FOREIGN KEY(actor_id) REFERENCES app.users(user_id);
ALTER TABLE app.evaluation_runs ADD CONSTRAINT fk_evaluation_runs_achievement_id FOREIGN KEY(achievement_id) REFERENCES app.achievements(achievement_id);
ALTER TABLE app.evaluation_runs ADD CONSTRAINT fk_evaluation_runs_application_id FOREIGN KEY(application_id) REFERENCES app.award_applications(application_id);
ALTER TABLE app.evaluation_runs ADD CONSTRAINT fk_evaluation_runs_kpi_goal_id FOREIGN KEY(kpi_goal_id) REFERENCES app.kpi_goals(goal_id);
ALTER TABLE app.evaluation_runs ADD CONSTRAINT fk_evaluation_runs_executed_by FOREIGN KEY(executed_by) REFERENCES app.users(user_id);
ALTER TABLE app.evaluation_criterion_results ADD CONSTRAINT fk_evaluation_criterion_results_run_id FOREIGN KEY(run_id) REFERENCES app.evaluation_runs(run_id);
ALTER TABLE app.evaluation_criterion_results ADD CONSTRAINT fk_evaluation_criterion_results_criterion_id FOREIGN KEY(criterion_id) REFERENCES app.award_criteria_versions(criteria_version_id);
ALTER TABLE app.regulation_chunk_embeddings ADD CONSTRAINT fk_regulation_chunk_embeddings_chunk_id FOREIGN KEY(chunk_id) REFERENCES app.regulation_chunks(chunk_id);
ALTER TABLE app.ai_rag_explanations ADD CONSTRAINT fk_ai_rag_explanations_run_id FOREIGN KEY(run_id) REFERENCES app.evaluation_runs(run_id);
ALTER TABLE app.ai_rag_explanations ADD CONSTRAINT fk_ai_rag_explanations_criterion_id FOREIGN KEY(criterion_id) REFERENCES app.award_criteria_versions(criteria_version_id);
ALTER TABLE app.kpi_recommendations ADD CONSTRAINT fk_kpi_recommendations_run_id FOREIGN KEY(run_id) REFERENCES app.evaluation_runs(run_id);
ALTER TABLE app.kpi_recommendations ADD CONSTRAINT fk_kpi_recommendations_criterion_id FOREIGN KEY(criterion_id) REFERENCES app.award_criteria_versions(criteria_version_id);
ALTER TABLE app.kpi_recommendations ADD CONSTRAINT fk_kpi_recommendations_created_by FOREIGN KEY(created_by) REFERENCES app.users(user_id);
ALTER TABLE app.kpi_recommendations ADD CONSTRAINT fk_kpi_recommendations_goal_id FOREIGN KEY(goal_id) REFERENCES app.kpi_goals(goal_id);
ALTER TABLE app.external_kpi_mappings ADD CONSTRAINT fk_external_kpi_mappings_lecturer_id FOREIGN KEY(lecturer_id) REFERENCES app.lecturers(lecturer_id);
ALTER TABLE app.external_kpi_mappings ADD CONSTRAINT fk_external_kpi_mappings_created_by FOREIGN KEY(created_by) REFERENCES app.users(user_id);
ALTER TABLE app.external_kpi_runs ADD CONSTRAINT fk_external_kpi_runs_retry_of FOREIGN KEY(retry_of) REFERENCES app.external_kpi_runs(run_id);
ALTER TABLE app.external_kpi_runs ADD CONSTRAINT fk_external_kpi_runs_created_by FOREIGN KEY(created_by) REFERENCES app.users(user_id);
ALTER TABLE app.external_kpi_records ADD CONSTRAINT fk_external_kpi_records_lecturer_id FOREIGN KEY(lecturer_id) REFERENCES app.lecturers(lecturer_id);
ALTER TABLE app.external_kpi_records ADD CONSTRAINT fk_external_kpi_records_achievement_id FOREIGN KEY(achievement_id) REFERENCES app.achievements(achievement_id);
ALTER TABLE app.external_kpi_run_items ADD CONSTRAINT fk_external_kpi_run_items_run_id FOREIGN KEY(run_id) REFERENCES app.external_kpi_runs(run_id);
ALTER TABLE app.external_kpi_run_items ADD CONSTRAINT fk_external_kpi_run_items_record_id FOREIGN KEY(record_id) REFERENCES app.external_kpi_records(record_id);
ALTER TABLE app.application_reviews ADD CONSTRAINT fk_application_reviews_application_id FOREIGN KEY(application_id) REFERENCES app.award_applications(application_id);
ALTER TABLE app.application_reviews ADD CONSTRAINT fk_application_reviews_reviewer_id FOREIGN KEY(reviewer_id) REFERENCES app.users(user_id);
ALTER TABLE app.application_reviews ADD CONSTRAINT fk_application_reviews_assigned_by FOREIGN KEY(assigned_by) REFERENCES app.users(user_id);
ALTER TABLE app.application_review_comments ADD CONSTRAINT fk_application_review_comments_application_id FOREIGN KEY(application_id) REFERENCES app.award_applications(application_id);
ALTER TABLE app.application_review_comments ADD CONSTRAINT fk_application_review_comments_actor_id FOREIGN KEY(actor_id) REFERENCES app.users(user_id);
ALTER TABLE app.personal_calendar_events ADD CONSTRAINT fk_personal_calendar_events_user_id FOREIGN KEY(user_id) REFERENCES app.users(user_id);
ALTER TABLE app.lecturer_cvs ADD CONSTRAINT fk_lecturer_cvs_lecturer_id FOREIGN KEY(lecturer_id) REFERENCES app.lecturers(lecturer_id);
ALTER TABLE app.criteria_source_rule_history ADD CONSTRAINT fk_criteria_source_rule_history_criteria_version_id FOREIGN KEY(criteria_version_id) REFERENCES app.award_criteria_versions(criteria_version_id);
ALTER TABLE app.criteria_source_rule_history ADD CONSTRAINT fk_criteria_source_rule_history_changed_by FOREIGN KEY(changed_by) REFERENCES app.users(user_id);

CREATE INDEX idx_users_username ON app.users(username) ;
CREATE INDEX idx_users_email ON app.users(email) ;
CREATE INDEX idx_user_roles_user_id ON app.user_roles(user_id) ;
CREATE INDEX idx_user_roles_active ON app.user_roles(user_id, role_id, valid_from, valid_to) ;
CREATE INDEX idx_units_parent_id ON app.organization_units(parent_id) ;
CREATE INDEX idx_user_unit_scopes_lookup ON app.user_unit_scopes(user_id, role_id, unit_id) ;
CREATE INDEX idx_lecturers_employee_code ON app.lecturers(employee_code) ;
CREATE UNIQUE INDEX uq_lecturer_assignments_primary ON app.lecturer_assignments(lecturer_id) WHERE is_primary = 1 AND valid_to IS NULL;
CREATE INDEX idx_achievements_lecturer_id ON app.achievements(lecturer_id) ;
CREATE INDEX idx_achievements_unit_id ON app.achievements(unit_id) ;
CREATE INDEX idx_achievements_context_unit_id ON app.achievements(context_unit_id) ;
CREATE INDEX idx_achievements_status ON app.achievements(status) ;
CREATE INDEX idx_verifications_achievement_id ON app.achievement_verifications(achievement_id) ;
CREATE INDEX idx_award_apps_period ON app.award_applications(award_period_id) ;
CREATE INDEX idx_award_apps_lecturer ON app.award_applications(lecturer_id) ;
CREATE INDEX idx_award_apps_unit ON app.award_applications(unit_id) ;
CREATE INDEX idx_refresh_tokens_hash ON app.refresh_tokens(token_hash) ;
CREATE INDEX idx_refresh_tokens_user ON app.refresh_tokens(user_id) ;
CREATE INDEX idx_audit_logs_user_id ON app.audit_logs(user_id) ;
CREATE INDEX idx_audit_logs_entity ON app.audit_logs(entity_name, entity_id) ;
CREATE INDEX idx_audit_logs_created_at ON app.audit_logs(created_at) ;
CREATE INDEX idx_unit_representatives_user ON app.unit_representatives(user_id, valid_from, valid_to) ;
CREATE UNIQUE INDEX uq_academic_years_single_current ON app.academic_years(is_current) WHERE is_current = 1;
CREATE INDEX idx_achievements_type_year ON app.achievements(achievement_type_id, academic_year_id) ;
CREATE INDEX idx_award_records_award_type ON app.award_records(award_type_id) ;
ALTER TABLE app.academic_years ADD code_normalized AS UPPER(code) PERSISTED;
CREATE UNIQUE INDEX uq_academic_years_code_normalized ON app.academic_years(code_normalized) ;
ALTER TABLE app.achievement_types ADD code_normalized AS UPPER(code) PERSISTED;
CREATE UNIQUE INDEX uq_achievement_types_code_normalized ON app.achievement_types(code_normalized) ;
ALTER TABLE app.award_types ADD code_normalized AS UPPER(code) PERSISTED;
CREATE UNIQUE INDEX uq_award_types_code_normalized ON app.award_types(code_normalized) ;
CREATE INDEX idx_achievements_recognition_year ON app.achievements(recognition_year) ;
CREATE INDEX idx_achievements_created_by ON app.achievements(created_by) ;
CREATE INDEX idx_achievements_context_filter ON app.achievements(context_unit_id, status, recognition_year) ;
CREATE INDEX idx_evidences_achievement_id ON app.evidences(achievement_id) ;
CREATE INDEX idx_evidences_is_removed ON app.evidences(is_removed) ;
CREATE INDEX idx_evidence_files_evidence_id ON app.evidence_files(evidence_id) ;
CREATE INDEX idx_evidence_files_storage_key ON app.evidence_files(storage_key) ;
CREATE UNIQUE INDEX uq_award_records_lecturer_recorded ON app.award_records(lecturer_id,award_type_id,decision_id) WHERE status='RECORDED' AND lecturer_id IS NOT NULL AND decision_id IS NOT NULL;
CREATE UNIQUE INDEX uq_award_records_unit_recorded ON app.award_records(unit_id,award_type_id,decision_id) WHERE status='RECORDED' AND unit_id IS NOT NULL AND decision_id IS NOT NULL;
CREATE INDEX idx_award_records_scope_year ON app.award_records(context_unit_id,recognition_year,status) ;
CREATE INDEX idx_award_records_decision ON app.award_records(decision_id) ;
CREATE INDEX idx_notifications_inbox ON app.notifications(user_id, created_at DESC, notification_id DESC) ;
CREATE INDEX idx_notifications_unread ON app.notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX idx_achievement_submissions_achievement_id ON app.achievement_submissions(achievement_id) ;
CREATE INDEX idx_achievement_submissions_submitted_by ON app.achievement_submissions(submitted_by) ;
CREATE INDEX idx_sub_ev_files_submission_id ON app.submission_evidence_files(submission_id) ;
CREATE INDEX idx_sub_ev_files_file_id ON app.submission_evidence_files(evidence_file_id) ;
CREATE INDEX idx_ach_histories_achievement_id ON app.achievement_status_histories(achievement_id, created_at DESC) ;
CREATE INDEX idx_ach_histories_actor_id ON app.achievement_status_histories(actor_id) ;
CREATE UNIQUE INDEX kpi_goal_person_period ON app.kpi_goals(lecturer_id,code,period_start,period_end) WHERE lecturer_id IS NOT NULL;
CREATE UNIQUE INDEX kpi_goal_unit_period ON app.kpi_goals(unit_id,code,period_start,period_end) WHERE unit_id IS NOT NULL;
CREATE INDEX idx_reg_docs_code ON app.regulation_documents(document_code) ;
CREATE INDEX idx_reg_docs_type ON app.regulation_documents(document_type) ;
CREATE INDEX idx_reg_versions_doc_id ON app.regulation_document_versions(document_id) ;
CREATE INDEX idx_reg_versions_effective ON app.regulation_document_versions(effective_from, effective_to) ;
CREATE INDEX idx_reg_versions_confirmed ON app.regulation_document_versions(is_confirmed) ;
CREATE INDEX idx_reg_chunks_version ON app.regulation_chunks(version_id) ;
CREATE INDEX idx_reg_chunks_article ON app.regulation_chunks(article_no) ;
CREATE INDEX idx_criteria_versions_version ON app.award_criteria_versions(version_id) ;
CREATE INDEX idx_criteria_versions_confirmed ON app.award_criteria_versions(is_confirmed) ;
CREATE INDEX idx_award_application_scope ON app.award_applications(context_unit_id,status) ;
CREATE INDEX idx_eval_runs_subject ON app.evaluation_runs(subject_type, subject_id) ;
CREATE INDEX idx_eval_runs_executed_by ON app.evaluation_runs(executed_by) ;
CREATE INDEX idx_eval_runs_created_at ON app.evaluation_runs(executed_at DESC) ;
CREATE INDEX idx_eval_runs_app_id ON app.evaluation_runs(application_id) ;
CREATE INDEX idx_eval_crit_results_run ON app.evaluation_criterion_results(run_id) ;
CREATE INDEX idx_eval_crit_results_criterion ON app.evaluation_criterion_results(criterion_id) ;
CREATE INDEX idx_reg_chunk_emb_model ON app.regulation_chunk_embeddings(embedding_model) ;
CREATE INDEX idx_rag_expl_run ON app.ai_rag_explanations(run_id) ;
CREATE INDEX idx_rag_expl_criterion ON app.ai_rag_explanations(criterion_id) ;
CREATE INDEX kpi_recommendations_run ON app.kpi_recommendations(run_id,created_at) ;
CREATE INDEX idx_achievements_updated_id ON app.achievements(updated_at DESC, achievement_id DESC) ;
CREATE INDEX personal_calendar_owner_date ON app.personal_calendar_events(user_id, starts_at) ;
CREATE UNIQUE INDEX uq_award_records_application_active ON app.award_records(application_id) WHERE application_id IS NOT NULL AND status IN ('DRAFT','RECORDED');
CREATE UNIQUE INDEX uq_kpi_results_achievement ON app.kpi_results(achievement_id) WHERE achievement_id IS NOT NULL;
CREATE UNIQUE INDEX uq_kpi_recommendations_goal ON app.kpi_recommendations(goal_id) WHERE goal_id IS NOT NULL;
CREATE UNIQUE INDEX uq_external_kpi_records_achievement ON app.external_kpi_records(achievement_id) WHERE achievement_id IS NOT NULL;
