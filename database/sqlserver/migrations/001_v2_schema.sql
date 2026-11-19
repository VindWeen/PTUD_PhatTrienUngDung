-- Fresh personal-vault baseline. No seed/catalog data and no approval workflow.
-- All timestamps are UTC; effective intervals are half-open [from, to).
-- Authorization, invitation/link consent, JSON rule schemas, slug reservation,
-- file access and current organization scope MUST also be checked by the API.
-- FKs prove identity/ownership, not the actor's authority to perform a write.
IF SCHEMA_ID(N'app') IS NULL EXEC(N'CREATE SCHEMA app');
GO
CREATE TABLE app.users (
    id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_users PRIMARY KEY,
    email nvarchar(254) NOT NULL,
    normalized_email AS LOWER(LTRIM(RTRIM(email))) PERSISTED,
    password_hash nvarchar(512) NULL,
    account_status varchar(16) NOT NULL CONSTRAINT DF_users_status DEFAULT 'ACTIVE',
    email_verified_at datetime2(3) NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_users_created DEFAULT SYSUTCDATETIME(),
    updated_at datetime2(3) NOT NULL CONSTRAINT DF_users_updated DEFAULT SYSUTCDATETIME(),
    row_version rowversion NOT NULL,
    CONSTRAINT CK_users_email CHECK (LEN(LTRIM(RTRIM(email))) > 3 AND email LIKE N'%_@_%._%'),
    CONSTRAINT CK_users_status CHECK (account_status IN ('ACTIVE','DISABLED','DELETED'))
);
CREATE UNIQUE INDEX UX_users_email ON app.users(normalized_email);

CREATE TABLE app.person_profiles (
    user_id bigint NOT NULL CONSTRAINT PK_person_profiles PRIMARY KEY,
    full_name nvarchar(200) NOT NULL,
    person_type varchar(24) NOT NULL CONSTRAINT DF_profile_type DEFAULT 'OTHER',
    birth_date date NULL,
    phone nvarchar(40) NULL,
    headline nvarchar(300) NULL,
    biography nvarchar(max) NULL,
    avatar_storage_key nvarchar(600) NULL,
    attributes_json nvarchar(max) NOT NULL CONSTRAINT DF_profile_attributes DEFAULT N'{}',
    updated_at datetime2(3) NOT NULL CONSTRAINT DF_profile_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_profile_user FOREIGN KEY(user_id) REFERENCES app.users(id),
    CONSTRAINT CK_profile_name CHECK (LEN(LTRIM(RTRIM(full_name))) > 0),
    CONSTRAINT CK_profile_type CHECK (person_type IN ('STUDENT','LECTURER','STAFF','OTHER')),
    CONSTRAINT CK_profile_json CHECK (ISJSON(attributes_json)=1)
);

CREATE TABLE app.auth_sessions (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_auth_sessions PRIMARY KEY,
    user_id bigint NOT NULL,
    refresh_token_hash binary(32) NOT NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_session_created DEFAULT SYSUTCDATETIME(),
    expires_at datetime2(3) NOT NULL,
    revoked_at datetime2(3) NULL,
    client_description nvarchar(400) NULL,
    CONSTRAINT FK_session_user FOREIGN KEY(user_id) REFERENCES app.users(id),
    CONSTRAINT UQ_session_hash UNIQUE(refresh_token_hash),
    CONSTRAINT CK_session_period CHECK (expires_at > created_at AND (revoked_at IS NULL OR revoked_at >= created_at))
);
CREATE TABLE app.auth_tokens (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_auth_tokens PRIMARY KEY,
    user_id bigint NOT NULL,
    token_hash binary(32) NOT NULL,
    purpose varchar(24) NOT NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_token_created DEFAULT SYSUTCDATETIME(),
    expires_at datetime2(3) NOT NULL,
    consumed_at datetime2(3) NULL,
    CONSTRAINT FK_token_user FOREIGN KEY(user_id) REFERENCES app.users(id),
    CONSTRAINT UQ_token_hash UNIQUE(token_hash),
    CONSTRAINT CK_token_purpose CHECK (purpose IN ('VERIFY_EMAIL','RESET_PASSWORD')),
    CONSTRAINT CK_token_period CHECK (expires_at > created_at AND (consumed_at IS NULL OR consumed_at >= created_at))
);
CREATE TABLE app.global_role_grants (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_global_role_grants PRIMARY KEY,
    user_id bigint NOT NULL,
    role_code varchar(32) NOT NULL,
    granted_by_user_id bigint NULL,
    valid_from datetime2(3) NOT NULL CONSTRAINT DF_role_from DEFAULT SYSUTCDATETIME(),
    valid_to datetime2(3) NULL,
    CONSTRAINT FK_role_user FOREIGN KEY(user_id) REFERENCES app.users(id),
    CONSTRAINT FK_role_granter FOREIGN KEY(granted_by_user_id) REFERENCES app.users(id),
    CONSTRAINT CK_role_code CHECK (role_code IN ('SYSTEM_ADMIN','REGULATION_MANAGER')),
    CONSTRAINT CK_role_period CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE TABLE app.organizations (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_organizations PRIMARY KEY,
    parent_id bigint NULL,
    code nvarchar(80) NOT NULL,
    name nvarchar(250) NOT NULL,
    organization_type varchar(24) NOT NULL,
    status varchar(16) NOT NULL CONSTRAINT DF_org_status DEFAULT 'ACTIVE',
    created_by_user_id bigint NOT NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_org_created DEFAULT SYSUTCDATETIME(),
    updated_at datetime2(3) NOT NULL CONSTRAINT DF_org_updated DEFAULT SYSUTCDATETIME(),
    row_version rowversion NOT NULL,
    CONSTRAINT UQ_org_code UNIQUE(code),
    CONSTRAINT FK_org_parent FOREIGN KEY(parent_id) REFERENCES app.organizations(id),
    CONSTRAINT FK_org_creator FOREIGN KEY(created_by_user_id) REFERENCES app.users(id),
    CONSTRAINT CK_org_self CHECK (parent_id IS NULL OR parent_id <> id),
    CONSTRAINT CK_org_name CHECK (LEN(LTRIM(RTRIM(name)))>0 AND LEN(LTRIM(RTRIM(code)))>0),
    CONSTRAINT CK_org_type CHECK (organization_type IN ('UNIVERSITY','FACULTY','DEPARTMENT','CLASS','COMPANY','TEAM','OTHER')),
    CONSTRAINT CK_org_status CHECK (status IN ('ACTIVE','ARCHIVED'))
);
CREATE TABLE app.membership_invitations (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_membership_invitations PRIMARY KEY,
    organization_id bigint NOT NULL,
    invitee_user_id bigint NOT NULL,
    invited_by_user_id bigint NOT NULL,
    title nvarchar(200) NULL,
    status varchar(16) NOT NULL CONSTRAINT DF_invite_status DEFAULT 'PENDING',
    created_at datetime2(3) NOT NULL CONSTRAINT DF_invite_created DEFAULT SYSUTCDATETIME(),
    expires_at datetime2(3) NOT NULL,
    responded_at datetime2(3) NULL,
    responded_by_user_id bigint NULL,
    CONSTRAINT UQ_invite_identity UNIQUE(id,organization_id,invitee_user_id),
    CONSTRAINT FK_invite_org FOREIGN KEY(organization_id) REFERENCES app.organizations(id),
    CONSTRAINT FK_invite_user FOREIGN KEY(invitee_user_id) REFERENCES app.users(id),
    CONSTRAINT FK_invite_sender FOREIGN KEY(invited_by_user_id) REFERENCES app.users(id),
    CONSTRAINT FK_invite_responder FOREIGN KEY(responded_by_user_id) REFERENCES app.users(id),
    CONSTRAINT CK_invite_status CHECK(status IN ('PENDING','ACCEPTED','DECLINED','CANCELLED','EXPIRED')),
    CONSTRAINT CK_invite_period CHECK(expires_at > created_at AND (responded_at IS NULL OR responded_at >= created_at)),
    CONSTRAINT CK_invite_response CHECK (
      (status='PENDING' AND responded_at IS NULL AND responded_by_user_id IS NULL) OR
      (status IN ('ACCEPTED','DECLINED') AND responded_at IS NOT NULL AND responded_by_user_id IS NOT NULL AND responded_by_user_id=invitee_user_id AND responded_at < expires_at) OR
      (status IN ('CANCELLED','EXPIRED') AND responded_at IS NOT NULL))
);
CREATE UNIQUE INDEX UX_invite_pending ON app.membership_invitations(organization_id,invitee_user_id) WHERE status='PENDING';
CREATE TABLE app.memberships (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_memberships PRIMARY KEY,
    organization_id bigint NOT NULL,
    user_id bigint NOT NULL,
    invitation_id bigint NOT NULL,
    title nvarchar(200) NULL,
    valid_from datetime2(3) NOT NULL CONSTRAINT DF_membership_from DEFAULT SYSUTCDATETIME(),
    valid_to datetime2(3) NULL,
    ended_by_user_id bigint NULL,
    end_reason nvarchar(500) NULL,
    CONSTRAINT UQ_membership_invitation UNIQUE(invitation_id),
    CONSTRAINT FK_membership_org FOREIGN KEY(organization_id) REFERENCES app.organizations(id),
    CONSTRAINT FK_membership_user FOREIGN KEY(user_id) REFERENCES app.users(id),
    CONSTRAINT FK_membership_invite FOREIGN KEY(invitation_id,organization_id,user_id) REFERENCES app.membership_invitations(id,organization_id,invitee_user_id),
    CONSTRAINT FK_membership_ender FOREIGN KEY(ended_by_user_id) REFERENCES app.users(id),
    CONSTRAINT CK_membership_period CHECK(valid_to IS NULL OR valid_to > valid_from)
);
CREATE INDEX IX_membership_scope ON app.memberships(organization_id,user_id,valid_from,valid_to);
CREATE TABLE app.org_access_grants (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_org_access_grants PRIMARY KEY,
    organization_id bigint NOT NULL,
    user_id bigint NOT NULL,
    permission_code varchar(32) NOT NULL,
    include_descendants bit NOT NULL CONSTRAINT DF_org_grant_desc DEFAULT 0,
    granted_by_user_id bigint NOT NULL,
    valid_from datetime2(3) NOT NULL CONSTRAINT DF_org_grant_from DEFAULT SYSUTCDATETIME(),
    valid_to datetime2(3) NULL,
    CONSTRAINT FK_org_grant_org FOREIGN KEY(organization_id) REFERENCES app.organizations(id),
    CONSTRAINT FK_org_grant_user FOREIGN KEY(user_id) REFERENCES app.users(id),
    CONSTRAINT FK_org_grant_granter FOREIGN KEY(granted_by_user_id) REFERENCES app.users(id),
    CONSTRAINT CK_org_grant_permission CHECK(permission_code IN ('MEMBERS_VIEW','ASSESSMENTS_VIEW','ASSESSMENTS_RUN','MEMBERS_NOTIFY','MEMBERS_MANAGE','STRUCTURE_MANAGE','ACCESS_MANAGE')),
    CONSTRAINT CK_org_grant_period CHECK(valid_to IS NULL OR valid_to > valid_from)
);
CREATE TABLE app.organization_link_requests (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_organization_link_requests PRIMARY KEY,
    child_organization_id bigint NOT NULL,
    previous_parent_id bigint NULL,
    target_parent_id bigint NULL,
    request_type varchar(16) NOT NULL,
    status varchar(16) NOT NULL CONSTRAINT DF_link_request_status DEFAULT 'PENDING',
    requested_by_user_id bigint NOT NULL,
    child_consented_by_user_id bigint NULL,
    parent_consented_by_user_id bigint NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_link_request_created DEFAULT SYSUTCDATETIME(),
    expires_at datetime2(3) NOT NULL,
    responded_at datetime2(3) NULL,
    reason nvarchar(1000) NULL,
    CONSTRAINT FK_link_child FOREIGN KEY(child_organization_id) REFERENCES app.organizations(id),
    CONSTRAINT FK_link_previous FOREIGN KEY(previous_parent_id) REFERENCES app.organizations(id),
    CONSTRAINT FK_link_target FOREIGN KEY(target_parent_id) REFERENCES app.organizations(id),
    CONSTRAINT FK_link_requester FOREIGN KEY(requested_by_user_id) REFERENCES app.users(id),
    CONSTRAINT FK_link_child_consent FOREIGN KEY(child_consented_by_user_id) REFERENCES app.users(id),
    CONSTRAINT FK_link_parent_consent FOREIGN KEY(parent_consented_by_user_id) REFERENCES app.users(id),
    CONSTRAINT CK_link_type CHECK(request_type IN ('ATTACH','DETACH','MOVE')),
    CONSTRAINT CK_link_status CHECK(status IN ('PENDING','ACCEPTED','DECLINED','CANCELLED','EXPIRED')),
    CONSTRAINT CK_link_period CHECK(expires_at > created_at AND (responded_at IS NULL OR responded_at >= created_at)),
    CONSTRAINT CK_link_shape CHECK(
      (request_type='ATTACH' AND previous_parent_id IS NULL AND target_parent_id IS NOT NULL) OR
      (request_type='DETACH' AND previous_parent_id IS NOT NULL AND target_parent_id IS NULL) OR
      (request_type='MOVE' AND previous_parent_id IS NOT NULL AND target_parent_id IS NOT NULL AND previous_parent_id<>target_parent_id)),
    CONSTRAINT CK_link_self CHECK((previous_parent_id IS NULL OR previous_parent_id<>child_organization_id) AND (target_parent_id IS NULL OR target_parent_id<>child_organization_id)),
    CONSTRAINT CK_link_response CHECK((status='PENDING' AND responded_at IS NULL) OR (status<>'PENDING' AND responded_at IS NOT NULL)),
    CONSTRAINT CK_link_consent CHECK(status<>'ACCEPTED' OR
      (responded_at IS NOT NULL AND responded_at < expires_at AND
       ((request_type='DETACH' AND (child_consented_by_user_id IS NOT NULL OR parent_consented_by_user_id IS NOT NULL)) OR
        (request_type IN ('ATTACH','MOVE') AND child_consented_by_user_id IS NOT NULL AND parent_consented_by_user_id IS NOT NULL))))
);
CREATE UNIQUE INDEX UX_link_pending ON app.organization_link_requests(child_organization_id) WHERE status='PENDING';
CREATE TABLE app.organization_link_history (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_organization_link_history PRIMARY KEY,
    child_organization_id bigint NOT NULL,
    previous_parent_id bigint NULL,
    new_parent_id bigint NULL,
    request_id bigint NULL,
    changed_by_user_id bigint NOT NULL,
    changed_at datetime2(3) NOT NULL CONSTRAINT DF_link_history_changed DEFAULT SYSUTCDATETIME(),
    reason nvarchar(1000) NOT NULL,
    CONSTRAINT FK_history_child FOREIGN KEY(child_organization_id) REFERENCES app.organizations(id),
    CONSTRAINT FK_history_previous FOREIGN KEY(previous_parent_id) REFERENCES app.organizations(id),
    CONSTRAINT FK_history_new FOREIGN KEY(new_parent_id) REFERENCES app.organizations(id),
    CONSTRAINT FK_history_request FOREIGN KEY(request_id) REFERENCES app.organization_link_requests(id),
    CONSTRAINT FK_history_actor FOREIGN KEY(changed_by_user_id) REFERENCES app.users(id),
    CONSTRAINT CK_history_change CHECK((previous_parent_id IS NOT NULL OR new_parent_id IS NOT NULL) AND (previous_parent_id IS NULL OR new_parent_id IS NULL OR previous_parent_id<>new_parent_id)),
    CONSTRAINT CK_history_reason CHECK(LEN(LTRIM(RTRIM(reason)))>0)
);

CREATE TABLE app.achievement_types (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_achievement_types PRIMARY KEY,
    code nvarchar(80) NOT NULL CONSTRAINT UQ_achievement_type_code UNIQUE,
    name nvarchar(200) NOT NULL,
    attribute_schema_json nvarchar(max) NOT NULL CONSTRAINT DF_type_schema DEFAULT N'{}',
    is_active bit NOT NULL CONSTRAINT DF_type_active DEFAULT 1,
    CONSTRAINT CK_type_json CHECK(ISJSON(attribute_schema_json)=1)
);
CREATE TABLE app.achievements (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_achievements PRIMARY KEY,
    owner_user_id bigint NOT NULL,
    achievement_type_id bigint NULL,
    title nvarchar(300) NOT NULL,
    description nvarchar(max) NULL,
    achieved_at date NOT NULL,
    period_start date NULL,
    period_end date NULL,
    issuer nvarchar(300) NULL,
    level_code nvarchar(80) NULL,
    attributes_json nvarchar(max) NOT NULL CONSTRAINT DF_achievement_attributes DEFAULT N'{}',
    visibility varchar(16) NOT NULL CONSTRAINT DF_achievement_visibility DEFAULT 'PRIVATE',
    created_at datetime2(3) NOT NULL CONSTRAINT DF_achievement_created DEFAULT SYSUTCDATETIME(),
    updated_at datetime2(3) NOT NULL CONSTRAINT DF_achievement_updated DEFAULT SYSUTCDATETIME(),
    deleted_at datetime2(3) NULL,
    row_version rowversion NOT NULL,
    CONSTRAINT UQ_achievement_owner UNIQUE(id,owner_user_id),
    CONSTRAINT FK_achievement_owner FOREIGN KEY(owner_user_id) REFERENCES app.users(id),
    CONSTRAINT FK_achievement_type FOREIGN KEY(achievement_type_id) REFERENCES app.achievement_types(id),
    CONSTRAINT CK_achievement_title CHECK(LEN(LTRIM(RTRIM(title)))>0),
    CONSTRAINT CK_achievement_json CHECK(ISJSON(attributes_json)=1),
    CONSTRAINT CK_achievement_visibility CHECK(visibility IN ('PRIVATE','PUBLIC')),
    CONSTRAINT CK_achievement_period CHECK((period_start IS NULL AND period_end IS NULL) OR (period_start IS NOT NULL AND period_end IS NOT NULL AND period_end >= period_start)),
    CONSTRAINT CK_achievement_deleted CHECK(deleted_at IS NULL OR deleted_at >= created_at)
);
CREATE TABLE app.evidence_files (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_evidence_files PRIMARY KEY,
    achievement_id bigint NOT NULL,
    owner_user_id bigint NOT NULL,
    storage_key nvarchar(600) NOT NULL,
    original_filename nvarchar(260) NOT NULL,
    mime_type nvarchar(120) NOT NULL,
    byte_size bigint NOT NULL,
    sha256 binary(32) NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_evidence_created DEFAULT SYSUTCDATETIME(),
    deleted_at datetime2(3) NULL,
    CONSTRAINT UQ_evidence_owner UNIQUE(id,owner_user_id),
    CONSTRAINT UQ_evidence_achievement UNIQUE(id,achievement_id,owner_user_id),
    CONSTRAINT FK_evidence_achievement FOREIGN KEY(achievement_id,owner_user_id) REFERENCES app.achievements(id,owner_user_id),
    CONSTRAINT CK_evidence_size CHECK(byte_size>=0),
    CONSTRAINT CK_evidence_storage CHECK(LEN(LTRIM(RTRIM(storage_key)))>0),
    CONSTRAINT CK_evidence_deleted CHECK(deleted_at IS NULL OR deleted_at >= created_at)
);
CREATE TABLE app.evidence_shares (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_evidence_shares PRIMARY KEY,
    evidence_file_id bigint NOT NULL,
    owner_user_id bigint NOT NULL,
    recipient_user_id bigint NULL,
    recipient_organization_id bigint NULL,
    include_descendants bit NOT NULL CONSTRAINT DF_evidence_share_desc DEFAULT 0,
    valid_from datetime2(3) NOT NULL CONSTRAINT DF_evidence_share_from DEFAULT SYSUTCDATETIME(),
    valid_to datetime2(3) NULL,
    revoked_at datetime2(3) NULL,
    CONSTRAINT FK_share_file FOREIGN KEY(evidence_file_id,owner_user_id) REFERENCES app.evidence_files(id,owner_user_id),
    CONSTRAINT FK_share_recipient FOREIGN KEY(recipient_user_id) REFERENCES app.users(id),
    CONSTRAINT FK_share_org FOREIGN KEY(recipient_organization_id) REFERENCES app.organizations(id),
    CONSTRAINT CK_share_recipient CHECK((recipient_user_id IS NOT NULL AND recipient_organization_id IS NULL AND include_descendants=0 AND recipient_user_id<>owner_user_id) OR (recipient_user_id IS NULL AND recipient_organization_id IS NOT NULL)),
    CONSTRAINT CK_share_period CHECK((valid_to IS NULL OR valid_to>valid_from) AND (revoked_at IS NULL OR revoked_at>=valid_from))
);

CREATE TABLE app.regulations (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_regulations PRIMARY KEY,
    code nvarchar(80) NOT NULL CONSTRAINT UQ_regulation_code UNIQUE,
    name nvarchar(300) NOT NULL,
    description nvarchar(max) NULL,
    created_by_user_id bigint NOT NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_regulation_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_regulation_creator FOREIGN KEY(created_by_user_id) REFERENCES app.users(id)
);
CREATE TABLE app.regulation_versions (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_regulation_versions PRIMARY KEY,
    regulation_id bigint NOT NULL,
    version_label nvarchar(80) NOT NULL,
    effective_from date NOT NULL,
    effective_to date NULL,
    source_title nvarchar(500) NOT NULL,
    source_url nvarchar(2000) NULL,
    source_storage_key nvarchar(600) NULL,
    source_sha256 binary(32) NULL,
    applicability_json nvarchar(max) NOT NULL,
    aggregation_json nvarchar(max) NOT NULL CONSTRAINT DF_version_aggregation DEFAULT N'{"operator":"AND"}',
    publication_status varchar(16) NOT NULL CONSTRAINT DF_version_status DEFAULT 'DRAFT',
    published_at datetime2(3) NULL,
    published_by_user_id bigint NULL,
    created_by_user_id bigint NOT NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_version_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_version_label UNIQUE(regulation_id,version_label),
    CONSTRAINT FK_version_regulation FOREIGN KEY(regulation_id) REFERENCES app.regulations(id),
    CONSTRAINT FK_version_creator FOREIGN KEY(created_by_user_id) REFERENCES app.users(id),
    CONSTRAINT FK_version_publisher FOREIGN KEY(published_by_user_id) REFERENCES app.users(id),
    CONSTRAINT CK_version_period CHECK(effective_to IS NULL OR effective_to>=effective_from),
    CONSTRAINT CK_version_json CHECK(ISJSON(applicability_json)=1 AND ISJSON(aggregation_json)=1),
    CONSTRAINT CK_version_status CHECK(publication_status IN ('DRAFT','PUBLISHED')),
    CONSTRAINT CK_version_publication CHECK((publication_status='DRAFT' AND published_at IS NULL AND published_by_user_id IS NULL) OR (publication_status='PUBLISHED' AND published_at IS NOT NULL AND published_by_user_id IS NOT NULL))
);
CREATE TABLE app.criterion_groups (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_criterion_groups PRIMARY KEY,
    regulation_version_id bigint NOT NULL,
    code nvarchar(80) NOT NULL,
    title nvarchar(300) NOT NULL,
    operator varchar(3) NOT NULL CONSTRAINT DF_group_operator DEFAULT 'AND',
    is_required bit NOT NULL CONSTRAINT DF_group_required DEFAULT 1,
    sort_order int NOT NULL CONSTRAINT DF_group_sort DEFAULT 0,
    CONSTRAINT UQ_group_version UNIQUE(id,regulation_version_id),
    CONSTRAINT UQ_group_code UNIQUE(regulation_version_id,code),
    CONSTRAINT FK_group_version FOREIGN KEY(regulation_version_id) REFERENCES app.regulation_versions(id),
    CONSTRAINT CK_group_operator CHECK(operator IN ('AND','OR'))
);
CREATE TABLE app.criteria (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_criteria PRIMARY KEY,
    regulation_version_id bigint NOT NULL,
    criterion_group_id bigint NULL,
    code nvarchar(80) NOT NULL,
    title nvarchar(300) NOT NULL,
    description nvarchar(max) NULL,
    rule_json nvarchar(max) NOT NULL,
    source_reference nvarchar(1000) NOT NULL,
    is_required bit NOT NULL CONSTRAINT DF_criterion_required DEFAULT 1,
    is_exclusion bit NOT NULL CONSTRAINT DF_criterion_exclusion DEFAULT 0,
    sort_order int NOT NULL CONSTRAINT DF_criterion_sort DEFAULT 0,
    CONSTRAINT UQ_criterion_version UNIQUE(id,regulation_version_id),
    CONSTRAINT UQ_criterion_code UNIQUE(regulation_version_id,code),
    CONSTRAINT FK_criterion_version FOREIGN KEY(regulation_version_id) REFERENCES app.regulation_versions(id),
    CONSTRAINT FK_criterion_group FOREIGN KEY(criterion_group_id,regulation_version_id) REFERENCES app.criterion_groups(id,regulation_version_id),
    CONSTRAINT CK_criterion_rule CHECK(ISJSON(rule_json)=1),
    CONSTRAINT CK_criterion_reference CHECK(LEN(LTRIM(RTRIM(source_reference)))>0)
);
CREATE TABLE app.assessment_batches (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_assessment_batches PRIMARY KEY,
    initiated_by_user_id bigint NOT NULL,
    organization_id bigint NULL,
    include_descendants bit NOT NULL CONSTRAINT DF_batch_desc DEFAULT 0,
    batch_type varchar(24) NOT NULL,
    status varchar(16) NOT NULL CONSTRAINT DF_batch_status DEFAULT 'PENDING',
    request_snapshot_json nvarchar(max) NOT NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_batch_created DEFAULT SYSUTCDATETIME(),
    completed_at datetime2(3) NULL,
    CONSTRAINT FK_batch_initiator FOREIGN KEY(initiated_by_user_id) REFERENCES app.users(id),
    CONSTRAINT FK_batch_org FOREIGN KEY(organization_id) REFERENCES app.organizations(id),
    CONSTRAINT CK_batch_type CHECK(batch_type IN ('PERSONAL','DISCOVERY','ORGANIZATION')),
    CONSTRAINT CK_batch_scope CHECK((batch_type='ORGANIZATION' AND organization_id IS NOT NULL) OR (batch_type IN ('PERSONAL','DISCOVERY') AND organization_id IS NULL AND include_descendants=0)),
    CONSTRAINT CK_batch_status CHECK(status IN ('PENDING','RUNNING','COMPLETED','FAILED','CANCELLED')),
    CONSTRAINT CK_batch_json CHECK(ISJSON(request_snapshot_json)=1),
    CONSTRAINT CK_batch_completed CHECK((status IN ('PENDING','RUNNING') AND completed_at IS NULL) OR (status IN ('COMPLETED','FAILED','CANCELLED') AND completed_at IS NOT NULL AND completed_at>=created_at))
);
CREATE TABLE app.assessment_runs (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_assessment_runs PRIMARY KEY,
    batch_id bigint NULL,
    subject_user_id bigint NOT NULL,
    initiated_by_user_id bigint NOT NULL,
    regulation_version_id bigint NOT NULL,
    assessed_at datetime2(3) NOT NULL CONSTRAINT DF_run_assessed DEFAULT SYSUTCDATETIME(),
    evaluation_date date NOT NULL,
    evaluator_version nvarchar(80) NOT NULL,
    input_snapshot_json nvarchar(max) NOT NULL,
    status varchar(16) NOT NULL CONSTRAINT DF_run_status DEFAULT 'RUNNING',
    conclusion varchar(24) NULL,
    completion_percent decimal(5,2) NULL,
    explanation nvarchar(max) NULL,
    completed_at datetime2(3) NULL,
    CONSTRAINT UQ_run_subject_version UNIQUE(id,subject_user_id,regulation_version_id),
    CONSTRAINT FK_run_batch FOREIGN KEY(batch_id) REFERENCES app.assessment_batches(id),
    CONSTRAINT FK_run_subject FOREIGN KEY(subject_user_id) REFERENCES app.users(id),
    CONSTRAINT FK_run_initiator FOREIGN KEY(initiated_by_user_id) REFERENCES app.users(id),
    CONSTRAINT FK_run_version FOREIGN KEY(regulation_version_id) REFERENCES app.regulation_versions(id),
    CONSTRAINT CK_run_json CHECK(ISJSON(input_snapshot_json)=1),
    CONSTRAINT CK_run_status CHECK(status IN ('RUNNING','COMPLETED','FAILED')),
    CONSTRAINT CK_run_conclusion CHECK(conclusion IS NULL OR conclusion IN ('MET','NOT_MET','INSUFFICIENT_DATA','NOT_APPLICABLE')),
    CONSTRAINT CK_run_percent CHECK(completion_percent IS NULL OR completion_percent BETWEEN 0 AND 100),
    CONSTRAINT CK_run_completion CHECK((status='RUNNING' AND completed_at IS NULL AND conclusion IS NULL) OR (status='COMPLETED' AND completed_at IS NOT NULL AND completed_at>=assessed_at AND conclusion IS NOT NULL) OR (status='FAILED' AND completed_at IS NOT NULL AND completed_at>=assessed_at AND conclusion IS NULL))
);
CREATE TABLE app.criterion_results (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_criterion_results PRIMARY KEY,
    run_id bigint NOT NULL,
    subject_user_id bigint NOT NULL,
    regulation_version_id bigint NOT NULL,
    criterion_id bigint NOT NULL,
    conclusion varchar(24) NOT NULL,
    actual_value decimal(18,4) NULL,
    target_value decimal(18,4) NULL,
    measure_unit nvarchar(80) NULL,
    missing_details_json nvarchar(max) NOT NULL CONSTRAINT DF_result_missing DEFAULT N'{}',
    criterion_snapshot_json nvarchar(max) NOT NULL,
    explanation nvarchar(max) NULL,
    CONSTRAINT UQ_result_run_criterion UNIQUE(run_id,criterion_id),
    CONSTRAINT UQ_result_owner UNIQUE(id,subject_user_id),
    CONSTRAINT FK_result_run FOREIGN KEY(run_id,subject_user_id,regulation_version_id) REFERENCES app.assessment_runs(id,subject_user_id,regulation_version_id),
    CONSTRAINT FK_result_criterion FOREIGN KEY(criterion_id,regulation_version_id) REFERENCES app.criteria(id,regulation_version_id),
    CONSTRAINT CK_result_conclusion CHECK(conclusion IN ('MET','NOT_MET','INSUFFICIENT_DATA','NOT_APPLICABLE')),
    CONSTRAINT CK_result_json CHECK(ISJSON(missing_details_json)=1 AND ISJSON(criterion_snapshot_json)=1)
);
CREATE TABLE app.result_evidence (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_result_evidence PRIMARY KEY,
    criterion_result_id bigint NOT NULL,
    subject_user_id bigint NOT NULL,
    achievement_id bigint NOT NULL,
    evidence_file_id bigint NULL,
    achievement_snapshot_json nvarchar(max) NOT NULL,
    evidence_snapshot_json nvarchar(max) NULL,
    CONSTRAINT FK_result_evidence_result FOREIGN KEY(criterion_result_id,subject_user_id) REFERENCES app.criterion_results(id,subject_user_id),
    CONSTRAINT FK_result_evidence_achievement FOREIGN KEY(achievement_id,subject_user_id) REFERENCES app.achievements(id,owner_user_id),
    CONSTRAINT FK_result_evidence_file FOREIGN KEY(evidence_file_id,achievement_id,subject_user_id) REFERENCES app.evidence_files(id,achievement_id,owner_user_id),
    CONSTRAINT CK_result_evidence_json CHECK(ISJSON(achievement_snapshot_json)=1 AND (evidence_snapshot_json IS NULL OR ISJSON(evidence_snapshot_json)=1)),
    CONSTRAINT CK_result_evidence_snapshot CHECK(evidence_file_id IS NULL OR evidence_snapshot_json IS NOT NULL)
);
CREATE UNIQUE INDEX UX_result_evidence_pair ON app.result_evidence(criterion_result_id,achievement_id,evidence_file_id);

CREATE TABLE app.kpi_goals (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_kpi_goals PRIMARY KEY,
    owner_user_id bigint NOT NULL,
    source_result_id bigint NULL,
    title nvarchar(300) NOT NULL,
    description nvarchar(max) NULL,
    target_value decimal(18,4) NOT NULL CONSTRAINT DF_goal_target DEFAULT 1,
    measure_unit nvarchar(80) NOT NULL,
    progress_source varchar(16) NOT NULL CONSTRAINT DF_goal_progress_source DEFAULT 'MANUAL',
    status varchar(16) NOT NULL CONSTRAINT DF_goal_status DEFAULT 'PLANNED',
    start_date date NULL,
    due_date date NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_goal_created DEFAULT SYSUTCDATETIME(),
    updated_at datetime2(3) NOT NULL CONSTRAINT DF_goal_updated DEFAULT SYSUTCDATETIME(),
    deleted_at datetime2(3) NULL,
    row_version rowversion NOT NULL,
    CONSTRAINT UQ_goal_owner UNIQUE(id,owner_user_id),
    CONSTRAINT FK_goal_owner FOREIGN KEY(owner_user_id) REFERENCES app.users(id),
    CONSTRAINT FK_goal_source FOREIGN KEY(source_result_id,owner_user_id) REFERENCES app.criterion_results(id,subject_user_id),
    CONSTRAINT CK_goal_target CHECK(target_value>0),
    CONSTRAINT CK_goal_title CHECK(LEN(LTRIM(RTRIM(title)))>0),
    CONSTRAINT CK_goal_progress_source CHECK(progress_source IN ('MANUAL','ACHIEVEMENTS')),
    CONSTRAINT CK_goal_status CHECK(status IN ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')),
    CONSTRAINT CK_goal_dates CHECK(start_date IS NULL OR due_date IS NULL OR due_date>=start_date)
);
CREATE TABLE app.kpi_tasks (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_kpi_tasks PRIMARY KEY,
    goal_id bigint NOT NULL,
    title nvarchar(300) NOT NULL,
    description nvarchar(max) NULL,
    status varchar(16) NOT NULL CONSTRAINT DF_task_status DEFAULT 'TODO',
    due_date date NULL,
    sort_order int NOT NULL CONSTRAINT DF_task_sort DEFAULT 0,
    completed_at datetime2(3) NULL,
    CONSTRAINT FK_task_goal FOREIGN KEY(goal_id) REFERENCES app.kpi_goals(id),
    CONSTRAINT CK_task_status CHECK(status IN ('TODO','IN_PROGRESS','DONE','CANCELLED')),
    CONSTRAINT CK_task_completed CHECK((status='DONE' AND completed_at IS NOT NULL) OR (status<>'DONE' AND completed_at IS NULL))
);
CREATE TABLE app.kpi_progress (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_kpi_progress PRIMARY KEY,
    goal_id bigint NOT NULL,
    owner_user_id bigint NOT NULL,
    current_value decimal(18,4) NOT NULL,
    note nvarchar(max) NULL,
    recorded_at datetime2(3) NOT NULL CONSTRAINT DF_progress_recorded DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_progress_goal FOREIGN KEY(goal_id,owner_user_id) REFERENCES app.kpi_goals(id,owner_user_id),
    CONSTRAINT CK_progress_value CHECK(current_value>=0)
);
CREATE TABLE app.kpi_achievements (
    goal_id bigint NOT NULL,
    achievement_id bigint NOT NULL,
    owner_user_id bigint NOT NULL,
    contribution_value decimal(18,4) NOT NULL CONSTRAINT DF_kpi_contribution DEFAULT 1,
    linked_at datetime2(3) NOT NULL CONSTRAINT DF_kpi_linked DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_kpi_achievements PRIMARY KEY(goal_id,achievement_id),
    CONSTRAINT FK_kpi_achievement_goal FOREIGN KEY(goal_id,owner_user_id) REFERENCES app.kpi_goals(id,owner_user_id),
    CONSTRAINT FK_kpi_achievement_item FOREIGN KEY(achievement_id,owner_user_id) REFERENCES app.achievements(id,owner_user_id),
    CONSTRAINT CK_kpi_contribution CHECK(contribution_value>0)
);

CREATE TABLE app.cv_templates (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_cv_templates PRIMARY KEY,
    code nvarchar(80) NOT NULL CONSTRAINT UQ_cv_template_code UNIQUE,
    name nvarchar(200) NOT NULL,
    renderer_key nvarchar(120) NOT NULL,
    config_schema_json nvarchar(max) NOT NULL CONSTRAINT DF_template_schema DEFAULT N'{}',
    is_active bit NOT NULL CONSTRAINT DF_template_active DEFAULT 1,
    CONSTRAINT CK_template_json CHECK(ISJSON(config_schema_json)=1)
);
CREATE TABLE app.cvs (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_cvs PRIMARY KEY,
    owner_user_id bigint NOT NULL,
    template_id bigint NULL,
    title nvarchar(200) NOT NULL,
    public_slug varchar(100) NOT NULL CONSTRAINT DF_cv_slug DEFAULT LOWER(CONVERT(varchar(36),NEWID())),
    publication_status varchar(16) NOT NULL CONSTRAINT DF_cv_status DEFAULT 'PRIVATE',
    introduction nvarchar(max) NULL,
    content_json nvarchar(max) NOT NULL CONSTRAINT DF_cv_content DEFAULT N'{}',
    public_contact_settings_json nvarchar(max) NOT NULL CONSTRAINT DF_cv_contact DEFAULT N'{"email":false,"phone":false}',
    template_config_json nvarchar(max) NOT NULL CONSTRAINT DF_cv_config DEFAULT N'{}',
    created_at datetime2(3) NOT NULL CONSTRAINT DF_cv_created DEFAULT SYSUTCDATETIME(),
    updated_at datetime2(3) NOT NULL CONSTRAINT DF_cv_updated DEFAULT SYSUTCDATETIME(),
    published_at datetime2(3) NULL,
    row_version rowversion NOT NULL,
    CONSTRAINT UQ_cv_slug UNIQUE(public_slug),
    CONSTRAINT UQ_cv_owner UNIQUE(id,owner_user_id),
    CONSTRAINT FK_cv_owner FOREIGN KEY(owner_user_id) REFERENCES app.users(id),
    CONSTRAINT FK_cv_template FOREIGN KEY(template_id) REFERENCES app.cv_templates(id),
    CONSTRAINT CK_cv_slug CHECK(LEN(public_slug) BETWEEN 3 AND 100 AND public_slug COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-z0-9-]%' AND public_slug NOT LIKE '-%' AND public_slug NOT LIKE '%-' AND public_slug NOT LIKE '%--%'),
    CONSTRAINT CK_cv_status CHECK(publication_status IN ('PRIVATE','PUBLIC')),
    CONSTRAINT CK_cv_publication CHECK((publication_status='PRIVATE' AND published_at IS NULL) OR (publication_status='PUBLIC' AND published_at IS NOT NULL AND template_id IS NOT NULL)),
    CONSTRAINT CK_cv_json CHECK(ISJSON(content_json)=1 AND ISJSON(public_contact_settings_json)=1 AND ISJSON(template_config_json)=1)
);
CREATE TABLE app.cv_achievements (
    cv_id bigint NOT NULL,
    achievement_id bigint NOT NULL,
    owner_user_id bigint NOT NULL,
    sort_order int NOT NULL CONSTRAINT DF_cv_item_sort DEFAULT 0,
    CONSTRAINT PK_cv_achievements PRIMARY KEY(cv_id,achievement_id),
    CONSTRAINT FK_cv_item_cv FOREIGN KEY(cv_id,owner_user_id) REFERENCES app.cvs(id,owner_user_id),
    CONSTRAINT FK_cv_item_achievement FOREIGN KEY(achievement_id,owner_user_id) REFERENCES app.achievements(id,owner_user_id)
);
CREATE TABLE app.notifications (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_notifications PRIMARY KEY,
    recipient_user_id bigint NOT NULL,
    sender_user_id bigint NULL,
    organization_id bigint NULL,
    assessment_run_id bigint NULL,
    notification_type varchar(40) NOT NULL,
    title nvarchar(300) NOT NULL,
    body nvarchar(max) NULL,
    payload_json nvarchar(max) NOT NULL CONSTRAINT DF_notification_payload DEFAULT N'{}',
    deduplication_key nvarchar(160) NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_notification_created DEFAULT SYSUTCDATETIME(),
    read_at datetime2(3) NULL,
    CONSTRAINT FK_notification_recipient FOREIGN KEY(recipient_user_id) REFERENCES app.users(id),
    CONSTRAINT FK_notification_sender FOREIGN KEY(sender_user_id) REFERENCES app.users(id),
    CONSTRAINT FK_notification_org FOREIGN KEY(organization_id) REFERENCES app.organizations(id),
    CONSTRAINT FK_notification_run FOREIGN KEY(assessment_run_id) REFERENCES app.assessment_runs(id),
    CONSTRAINT CK_notification_json CHECK(ISJSON(payload_json)=1),
    CONSTRAINT CK_notification_read CHECK(read_at IS NULL OR read_at>=created_at)
);
CREATE UNIQUE INDEX UX_notification_dedup ON app.notifications(recipient_user_id,deduplication_key) WHERE deduplication_key IS NOT NULL;
CREATE INDEX IX_notification_inbox ON app.notifications(recipient_user_id,created_at DESC) INCLUDE(read_at,notification_type);
CREATE TABLE app.calendar_events (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_calendar_events PRIMARY KEY,
    owner_user_id bigint NOT NULL,
    goal_id bigint NULL,
    title nvarchar(300) NOT NULL,
    description nvarchar(max) NULL,
    starts_at datetime2(3) NOT NULL,
    ends_at datetime2(3) NOT NULL,
    remind_at datetime2(3) NULL,
    status varchar(16) NOT NULL CONSTRAINT DF_event_status DEFAULT 'SCHEDULED',
    created_at datetime2(3) NOT NULL CONSTRAINT DF_event_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_event_owner FOREIGN KEY(owner_user_id) REFERENCES app.users(id),
    CONSTRAINT FK_event_goal FOREIGN KEY(goal_id,owner_user_id) REFERENCES app.kpi_goals(id,owner_user_id),
    CONSTRAINT CK_event_period CHECK(ends_at>starts_at AND (remind_at IS NULL OR remind_at<=starts_at)),
    CONSTRAINT CK_event_status CHECK(status IN ('SCHEDULED','COMPLETED','CANCELLED'))
);
CREATE TABLE app.audit_events (
    id bigint IDENTITY NOT NULL CONSTRAINT PK_audit_events PRIMARY KEY,
    actor_user_id bigint NULL,
    organization_id bigint NULL,
    action_code varchar(80) NOT NULL,
    entity_type varchar(80) NOT NULL,
    entity_id nvarchar(100) NULL,
    reason nvarchar(1000) NULL,
    details_json nvarchar(max) NOT NULL CONSTRAINT DF_audit_details DEFAULT N'{}',
    occurred_at datetime2(3) NOT NULL CONSTRAINT DF_audit_occurred DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_audit_actor FOREIGN KEY(actor_user_id) REFERENCES app.users(id),
    CONSTRAINT FK_audit_org FOREIGN KEY(organization_id) REFERENCES app.organizations(id),
    CONSTRAINT CK_audit_json CHECK(ISJSON(details_json)=1)
);
CREATE INDEX IX_audit_entity ON app.audit_events(entity_type,entity_id,occurred_at);
GO
-- Ensure every FK has a usable leading-column index, including composite owner FKs.
-- Names derive deterministically from FK names; unique constraints may already cover it.
DECLARE @fk_id int, @table nvarchar(517), @index sysname, @columns nvarchar(max), @sql nvarchar(max);
DECLARE fk_indexes CURSOR LOCAL FAST_FORWARD FOR
SELECT fk.object_id, QUOTENAME(s.name)+N'.'+QUOTENAME(t.name), N'IX_'+fk.name
FROM sys.foreign_keys fk JOIN sys.tables t ON t.object_id=fk.parent_object_id
JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name=N'app';
OPEN fk_indexes;
FETCH NEXT FROM fk_indexes INTO @fk_id,@table,@index;
WHILE @@FETCH_STATUS=0
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM sys.indexes ix WHERE ix.object_id=(SELECT parent_object_id FROM sys.foreign_keys WHERE object_id=@fk_id)
   AND ix.is_disabled=0 AND ix.has_filter=0 AND NOT EXISTS (
     SELECT 1 FROM sys.foreign_key_columns fkc WHERE fkc.constraint_object_id=@fk_id
     AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic WHERE ic.object_id=ix.object_id AND ic.index_id=ix.index_id AND ic.key_ordinal=fkc.constraint_column_id AND ic.column_id=fkc.parent_column_id)))
 BEGIN
   SELECT @columns=STUFF((SELECT N','+QUOTENAME(c.name) FROM sys.foreign_key_columns fkc
     JOIN sys.columns c ON c.object_id=fkc.parent_object_id AND c.column_id=fkc.parent_column_id
     WHERE fkc.constraint_object_id=@fk_id ORDER BY fkc.constraint_column_id FOR XML PATH(''),TYPE).value('.','nvarchar(max)'),1,1,N'');
   SET @sql=N'CREATE INDEX '+QUOTENAME(@index)+N' ON '+@table+N'('+@columns+N');';
   EXEC sys.sp_executesql @sql;
 END;
 FETCH NEXT FROM fk_indexes INTO @fk_id,@table,@index;
END;
CLOSE fk_indexes;
DEALLOCATE fk_indexes;
GO
