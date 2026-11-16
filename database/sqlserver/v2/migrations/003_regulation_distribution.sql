-- Distribution is independent from ownership. Adoptions are durable, explicit pins;
-- withdrawing an offer or public listing does not revoke previously accepted pins.
ALTER TABLE app.regulations ADD
 owner_type varchar(16) NOT NULL CONSTRAINT DF_regulation_owner_type DEFAULT 'PERSONAL',
 owner_user_id bigint NULL,
 owner_organization_id bigint NULL,
 is_public bit NOT NULL CONSTRAINT DF_regulation_public DEFAULT 0,
 is_internal bit NOT NULL CONSTRAINT DF_regulation_internal DEFAULT 0;
GO
UPDATE app.regulations SET owner_user_id=created_by_user_id;
ALTER TABLE app.regulations ADD
 CONSTRAINT FK_regulation_owner_user FOREIGN KEY(owner_user_id) REFERENCES app.users(id),
 CONSTRAINT FK_regulation_owner_org FOREIGN KEY(owner_organization_id) REFERENCES app.organizations(id),
 -- NULL personal owner is filled from creator by the legacy-compatible insert trigger.
 CONSTRAINT CK_regulation_owner CHECK(
 (owner_type='PERSONAL' AND owner_organization_id IS NULL AND is_public=0 AND is_internal=0) OR
 (owner_type='ORGANIZATION' AND owner_user_id IS NULL AND owner_organization_id IS NOT NULL));
ALTER TABLE app.org_access_grants DROP CONSTRAINT CK_org_grant_permission;
ALTER TABLE app.org_access_grants ADD CONSTRAINT CK_org_grant_permission CHECK(permission_code IN
 ('MEMBERS_VIEW','ASSESSMENTS_VIEW','ASSESSMENTS_RUN','MEMBERS_NOTIFY','MEMBERS_MANAGE','STRUCTURE_MANAGE','ACCESS_MANAGE',
  'REGULATIONS_CREATE','REGULATIONS_MANAGE','REGULATIONS_PUBLISH','REGULATIONS_SHARE','REGULATIONS_ADOPT','REGULATIONS_UPDATE'));
ALTER TABLE app.regulation_versions ADD
 source_kind varchar(16) NOT NULL CONSTRAINT DF_version_source_kind DEFAULT 'MANUAL',
 issuing_authority nvarchar(500) NULL,
 collected_at datetime2(3) NULL,
 coverage_json nvarchar(max) NOT NULL CONSTRAINT DF_version_coverage DEFAULT N'{}',
 ai_reviewed_at datetime2(3) NULL,
 ai_reviewed_by_user_id bigint NULL;
GO
ALTER TABLE app.regulation_versions ADD
 CONSTRAINT UQ_version_regulation_identity UNIQUE(id,regulation_id),
 CONSTRAINT CK_version_source_kind CHECK(source_kind IN ('MANUAL','OFFICIAL','DEMO')),
 CONSTRAINT CK_version_coverage CHECK(ISJSON(coverage_json)=1),
 CONSTRAINT CK_version_ai_review CHECK((ai_reviewed_at IS NULL AND ai_reviewed_by_user_id IS NULL) OR (ai_reviewed_at IS NOT NULL AND ai_reviewed_by_user_id IS NOT NULL)),
 CONSTRAINT FK_version_ai_reviewer FOREIGN KEY(ai_reviewed_by_user_id) REFERENCES app.users(id);
ALTER TABLE app.criteria ADD
 coverage_status varchar(16) NOT NULL CONSTRAINT DF_criterion_coverage DEFAULT 'AUTOMATED',
 provenance_json nvarchar(max) NOT NULL CONSTRAINT DF_criterion_provenance DEFAULT N'{}';
GO
ALTER TABLE app.criteria ADD
 CONSTRAINT CK_criterion_coverage CHECK(coverage_status IN ('AUTOMATED','MANUAL','UNSUPPORTED')),
 CONSTRAINT CK_criterion_provenance CHECK(ISJSON(provenance_json)=1);
GO
CREATE TRIGGER app.TR_regulation_owner ON app.regulations AFTER INSERT, UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF TRIGGER_NESTLEVEL()>1 RETURN;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.id=i.id WHERE i.owner_type<>d.owner_type
  OR ISNULL(i.owner_user_id,-1)<>ISNULL(d.owner_user_id,-1)
  OR ISNULL(i.owner_organization_id,-1)<>ISNULL(d.owner_organization_id,-1))
  THROW 51020, 'Regulation ownership is immutable.',1;
 UPDATE r SET owner_user_id=i.created_by_user_id FROM app.regulations r JOIN inserted i ON i.id=r.id
 WHERE i.owner_type='PERSONAL' AND i.owner_user_id IS NULL;
END;
GO
CREATE TABLE app.regulation_shares (
 id bigint IDENTITY NOT NULL CONSTRAINT PK_regulation_shares PRIMARY KEY,
 regulation_id bigint NOT NULL,
 regulation_version_id bigint NOT NULL,
 recipient_organization_id bigint NOT NULL,
 status varchar(16) NOT NULL CONSTRAINT DF_reg_share_status DEFAULT 'PENDING',
 shared_by_user_id bigint NOT NULL,
 created_at datetime2(3) NOT NULL CONSTRAINT DF_reg_share_created DEFAULT SYSUTCDATETIME(),
 responded_at datetime2(3) NULL,
 responded_by_user_id bigint NULL,
 revoked_at datetime2(3) NULL,
 CONSTRAINT UQ_reg_share_identity UNIQUE(id,regulation_id,recipient_organization_id),
 CONSTRAINT FK_reg_share_version FOREIGN KEY(regulation_version_id,regulation_id) REFERENCES app.regulation_versions(id,regulation_id),
 CONSTRAINT FK_reg_share_org FOREIGN KEY(recipient_organization_id) REFERENCES app.organizations(id),
 CONSTRAINT FK_reg_share_sender FOREIGN KEY(shared_by_user_id) REFERENCES app.users(id),
 CONSTRAINT FK_reg_share_responder FOREIGN KEY(responded_by_user_id) REFERENCES app.users(id),
 CONSTRAINT CK_reg_share_status CHECK(status IN ('PENDING','ACCEPTED','REJECTED','REVOKED')),
 CONSTRAINT CK_reg_share_response CHECK(
 (status='PENDING' AND responded_at IS NULL AND responded_by_user_id IS NULL AND revoked_at IS NULL) OR
 (status IN ('ACCEPTED','REJECTED') AND responded_at>=created_at AND responded_by_user_id IS NOT NULL AND revoked_at IS NULL) OR
 (status='REVOKED' AND revoked_at>=created_at))
);
CREATE UNIQUE INDEX UX_reg_share_pending ON app.regulation_shares(regulation_id,recipient_organization_id) WHERE status='PENDING';
CREATE TABLE app.regulation_adoptions (
 id bigint IDENTITY NOT NULL CONSTRAINT PK_regulation_adoptions PRIMARY KEY,
 regulation_id bigint NOT NULL,
 regulation_version_id bigint NOT NULL,
 user_id bigint NULL,
 organization_id bigint NULL,
 source_type varchar(16) NOT NULL,
 share_id bigint NULL,
 adopted_by_user_id bigint NOT NULL,
 adopted_at datetime2(3) NOT NULL CONSTRAINT DF_reg_adopt_created DEFAULT SYSUTCDATETIME(),
 updated_at datetime2(3) NOT NULL CONSTRAINT DF_reg_adopt_updated DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_reg_adopt_version FOREIGN KEY(regulation_version_id,regulation_id) REFERENCES app.regulation_versions(id,regulation_id),
 CONSTRAINT FK_reg_adopt_user FOREIGN KEY(user_id) REFERENCES app.users(id),
 CONSTRAINT FK_reg_adopt_org FOREIGN KEY(organization_id) REFERENCES app.organizations(id),
 CONSTRAINT FK_reg_adopt_actor FOREIGN KEY(adopted_by_user_id) REFERENCES app.users(id),
 CONSTRAINT FK_reg_adopt_share FOREIGN KEY(share_id,regulation_id,organization_id) REFERENCES app.regulation_shares(id,regulation_id,recipient_organization_id),
 CONSTRAINT CK_reg_adopt_target CHECK((user_id IS NOT NULL AND organization_id IS NULL) OR (user_id IS NULL AND organization_id IS NOT NULL)),
 CONSTRAINT CK_reg_adopt_source CHECK((source_type IN ('OWNED','PUBLIC') AND share_id IS NULL) OR (source_type='SHARE' AND share_id IS NOT NULL AND organization_id IS NOT NULL))
);
CREATE UNIQUE INDEX UX_reg_adopt_user ON app.regulation_adoptions(regulation_id,user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX UX_reg_adopt_org ON app.regulation_adoptions(regulation_id,organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IX_reg_adopt_version ON app.regulation_adoptions(regulation_version_id);
CREATE TABLE app.regulation_source_files (
 id bigint IDENTITY NOT NULL CONSTRAINT PK_regulation_source_files PRIMARY KEY,
 regulation_version_id bigint NOT NULL CONSTRAINT UQ_reg_source_version UNIQUE,
 owner_user_id bigint NOT NULL,
 storage_key nvarchar(600) NOT NULL CONSTRAINT UQ_reg_source_key UNIQUE,
 original_filename nvarchar(260) NOT NULL,
 mime_type nvarchar(120) NOT NULL,
 byte_size bigint NOT NULL,
 sha256 binary(32) NOT NULL,
 source_url nvarchar(2000) NULL,
 collected_at datetime2(3) NULL,
 issuing_authority nvarchar(500) NULL,
 is_demo bit NOT NULL CONSTRAINT DF_reg_source_demo DEFAULT 0,
 extracted_text nvarchar(max) NULL,
 extraction_status varchar(16) NOT NULL CONSTRAINT DF_reg_source_extraction DEFAULT 'PENDING',
 extraction_error nvarchar(2000) NULL,
 created_at datetime2(3) NOT NULL CONSTRAINT DF_reg_source_created DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_reg_source_version FOREIGN KEY(regulation_version_id) REFERENCES app.regulation_versions(id),
 CONSTRAINT FK_reg_source_owner FOREIGN KEY(owner_user_id) REFERENCES app.users(id),
 CONSTRAINT CK_reg_source_size CHECK(byte_size>0 AND byte_size<=10485760),
 CONSTRAINT CK_reg_source_mime CHECK(mime_type IN ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
 CONSTRAINT CK_reg_source_key CHECK(LEN(storage_key)>0 AND storage_key NOT LIKE N'%..%' AND storage_key NOT LIKE N'%:%' AND LEFT(storage_key,1) NOT IN (N'/',N'\')),
 CONSTRAINT CK_reg_source_extraction CHECK(extraction_status IN ('PENDING','EXTRACTED','FAILED'))
);
GO
CREATE TRIGGER app.TR_reg_shares_integrity ON app.regulation_shares AFTER INSERT, UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN app.regulation_versions v WITH(UPDLOCK,HOLDLOCK) ON v.id=i.regulation_version_id
  JOIN app.regulations r ON r.id=i.regulation_id WHERE v.publication_status<>'PUBLISHED' OR r.owner_type<>'ORGANIZATION' OR r.owner_organization_id=i.recipient_organization_id)
 THROW 51021,'Shares require a published organization-owned version and another recipient.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON i.id=d.id WHERE i.regulation_id<>d.regulation_id OR i.regulation_version_id<>d.regulation_version_id
  OR i.recipient_organization_id<>d.recipient_organization_id OR i.shared_by_user_id<>d.shared_by_user_id OR i.created_at<>d.created_at
  OR (d.status<>'PENDING' AND i.status<>'REVOKED') OR (d.status='REVOKED' AND i.status<>'REVOKED'))
 THROW 51022,'Share identity and completed responses are immutable.',1;
END;
GO
CREATE TRIGGER app.TR_reg_adoptions_integrity ON app.regulation_adoptions AFTER INSERT, UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN app.regulation_versions v WITH(UPDLOCK,HOLDLOCK) ON v.id=i.regulation_version_id WHERE v.publication_status<>'PUBLISHED')
 THROW 51023,'Adoptions must pin a published version.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON i.id=d.id WHERE i.regulation_id<>d.regulation_id
  OR ISNULL(i.user_id,-1)<>ISNULL(d.user_id,-1) OR ISNULL(i.organization_id,-1)<>ISNULL(d.organization_id,-1))
 THROW 51024,'Adoption target and regulation cannot change.',1;
 -- Only new/changed pins need a live distribution offer; retained pins survive withdrawal.
 IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.id=i.id JOIN app.regulations r ON r.id=i.regulation_id
  WHERE (d.id IS NULL OR i.regulation_version_id<>d.regulation_version_id OR i.source_type<>d.source_type OR ISNULL(i.share_id,-1)<>ISNULL(d.share_id,-1)) AND NOT (
   (i.source_type='PUBLIC' AND r.is_public=1 AND r.owner_type='ORGANIZATION') OR
   (i.source_type='OWNED' AND ((i.user_id=COALESCE(r.owner_user_id,r.created_by_user_id) AND r.owner_type='PERSONAL') OR (i.organization_id=r.owner_organization_id AND r.owner_type='ORGANIZATION'))) OR
   (i.source_type='SHARE' AND EXISTS(SELECT 1 FROM app.regulation_shares s WITH(UPDLOCK,HOLDLOCK) WHERE s.id=i.share_id AND s.status='ACCEPTED' AND s.regulation_version_id=i.regulation_version_id))))
 THROW 51025,'Adoption requires ownership, public availability or an accepted matching share.',1;
END;
GO
CREATE TRIGGER app.TR_reg_source_draft_only ON app.regulation_source_files AFTER INSERT, UPDATE, DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM app.regulation_versions v WITH(UPDLOCK,HOLDLOCK)
 JOIN(SELECT regulation_version_id FROM inserted UNION SELECT regulation_version_id FROM deleted) c ON c.regulation_version_id=v.id WHERE v.publication_status='PUBLISHED')
 THROW 51026,'Source files of published versions are immutable.',1;
END;
GO
