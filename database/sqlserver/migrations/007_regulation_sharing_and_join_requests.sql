ALTER TABLE app.regulations DROP CONSTRAINT CK_regulation_owner;
ALTER TABLE app.regulations ADD CONSTRAINT CK_regulation_owner CHECK(
 (owner_type='PERSONAL' AND owner_organization_id IS NULL AND is_internal=0) OR
 (owner_type='ORGANIZATION' AND owner_user_id IS NULL AND owner_organization_id IS NOT NULL));

DROP INDEX UX_reg_share_pending ON app.regulation_shares;
ALTER TABLE app.regulation_shares ALTER COLUMN recipient_organization_id bigint NULL;
ALTER TABLE app.regulation_shares ADD recipient_user_id bigint NULL REFERENCES app.users(id);
GO
ALTER TABLE app.regulation_shares ADD
 CONSTRAINT CK_reg_share_recipient CHECK((recipient_organization_id IS NULL AND recipient_user_id IS NOT NULL) OR
 (recipient_organization_id IS NOT NULL AND recipient_user_id IS NULL)),
 CONSTRAINT UQ_reg_share_person UNIQUE(id,regulation_id,recipient_user_id);
CREATE UNIQUE INDEX UX_reg_share_pending ON app.regulation_shares(regulation_id,recipient_organization_id)
 WHERE status='PENDING' AND recipient_organization_id IS NOT NULL;
CREATE UNIQUE INDEX UX_reg_share_pending_person ON app.regulation_shares(regulation_id,recipient_user_id)
 WHERE status='PENDING' AND recipient_user_id IS NOT NULL;
ALTER TABLE app.regulation_adoptions DROP CONSTRAINT CK_reg_adopt_source;
ALTER TABLE app.regulation_adoptions ADD
 CONSTRAINT CK_reg_adopt_source CHECK((source_type IN ('OWNED','PUBLIC') AND share_id IS NULL) OR (source_type='SHARE' AND share_id IS NOT NULL)),
 CONSTRAINT FK_reg_adopt_person_share FOREIGN KEY(share_id,regulation_id,user_id) REFERENCES app.regulation_shares(id,regulation_id,recipient_user_id);
GO
ALTER TRIGGER app.TR_reg_shares_integrity ON app.regulation_shares AFTER INSERT, UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN app.regulation_versions v WITH(UPDLOCK,HOLDLOCK) ON v.id=i.regulation_version_id
  JOIN app.regulations r ON r.id=i.regulation_id WHERE v.publication_status<>'PUBLISHED' OR r.owner_organization_id=i.recipient_organization_id OR r.owner_user_id=i.recipient_user_id)
 THROW 51021,'Shares require a published version and a distinct recipient.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON i.id=d.id WHERE i.regulation_id<>d.regulation_id OR i.regulation_version_id<>d.regulation_version_id
  OR ISNULL(i.recipient_organization_id,-1)<>ISNULL(d.recipient_organization_id,-1) OR ISNULL(i.recipient_user_id,-1)<>ISNULL(d.recipient_user_id,-1) OR i.shared_by_user_id<>d.shared_by_user_id OR i.created_at<>d.created_at
  OR (d.status<>'PENDING' AND i.status<>'REVOKED') OR (d.status='REVOKED' AND i.status<>'REVOKED'))
 THROW 51022,'Share identity and completed responses are immutable.',1;
END;
GO
ALTER TRIGGER app.TR_reg_adoptions_integrity ON app.regulation_adoptions AFTER INSERT, UPDATE AS
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
   (i.source_type='PUBLIC' AND r.is_public=1) OR
   (i.source_type='OWNED' AND ((i.user_id=COALESCE(r.owner_user_id,r.created_by_user_id) AND r.owner_type='PERSONAL') OR (i.organization_id=r.owner_organization_id AND r.owner_type='ORGANIZATION'))) OR
   (i.source_type='SHARE' AND EXISTS(SELECT 1 FROM app.regulation_shares s WITH(UPDLOCK,HOLDLOCK) WHERE s.id=i.share_id AND s.status='ACCEPTED' AND s.regulation_version_id=i.regulation_version_id))))
 THROW 51025,'Adoption requires ownership, public availability or an accepted matching share.',1;
END;
GO
CREATE TABLE app.membership_join_requests (
 id bigint IDENTITY NOT NULL PRIMARY KEY,
 organization_id bigint NOT NULL REFERENCES app.organizations(id),
 user_id bigint NOT NULL REFERENCES app.users(id),
 status varchar(16) NOT NULL DEFAULT 'PENDING',
 reason nvarchar(500) NULL,
 created_at datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
 responded_at datetime2(3) NULL,
 responded_by_user_id bigint NULL REFERENCES app.users(id),
 CONSTRAINT UQ_join_request_identity UNIQUE(id,organization_id,user_id),
 CONSTRAINT CK_join_request_response CHECK(
 (status='PENDING' AND responded_at IS NULL AND responded_by_user_id IS NULL) OR
 (status IN ('ACCEPTED','DECLINED') AND responded_at IS NOT NULL AND responded_at>=created_at AND responded_by_user_id IS NOT NULL))
);
CREATE UNIQUE INDEX UX_join_request_pending ON app.membership_join_requests(organization_id,user_id) WHERE status='PENDING';
ALTER TABLE app.memberships DROP CONSTRAINT UQ_membership_invitation;
ALTER TABLE app.memberships ALTER COLUMN invitation_id bigint NULL;
ALTER TABLE app.memberships ADD join_request_id bigint NULL;
GO
ALTER TABLE app.memberships ADD
 CONSTRAINT FK_membership_join_request FOREIGN KEY(join_request_id,organization_id,user_id) REFERENCES app.membership_join_requests(id,organization_id,user_id),
 CONSTRAINT CK_membership_consent CHECK((invitation_id IS NULL AND join_request_id IS NOT NULL) OR (invitation_id IS NOT NULL AND join_request_id IS NULL));
CREATE UNIQUE INDEX UX_membership_invitation ON app.memberships(invitation_id) WHERE invitation_id IS NOT NULL;
CREATE UNIQUE INDEX UX_membership_join_request ON app.memberships(join_request_id) WHERE join_request_id IS NOT NULL;
GO
ALTER TRIGGER app.TR_memberships_integrity ON app.memberships
AFTER INSERT, UPDATE AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @lock_result int;
 EXEC @lock_result=sys.sp_getapplock @Resource=N'PTUD_V2_MEMBERSHIP_PERIODS', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000;
 IF @lock_result<0 THROW 51003, 'Could not lock membership periods; retry transaction.', 1;
 IF EXISTS (
   SELECT 1 FROM inserted i JOIN app.membership_invitations v WITH (UPDLOCK,HOLDLOCK) ON v.id=i.invitation_id
   WHERE v.status<>'ACCEPTED' OR v.responded_at IS NULL OR i.valid_from<v.responded_at
 ) THROW 51004, 'Membership requires an accepted invitation and cannot start before consent.', 1;
 IF EXISTS (SELECT 1 FROM inserted i JOIN app.membership_join_requests r WITH (UPDLOCK,HOLDLOCK) ON r.id=i.join_request_id
   WHERE r.status<>'ACCEPTED' OR i.valid_from<r.responded_at)
 THROW 51004, 'Membership requires an accepted join request.', 1;
 IF EXISTS (
   SELECT 1 FROM inserted i JOIN app.memberships m WITH (UPDLOCK,HOLDLOCK,INDEX(IX_membership_scope))
   ON m.organization_id=i.organization_id AND m.user_id=i.user_id AND m.id<>i.id
   WHERE (i.valid_to IS NULL OR m.valid_from<i.valid_to) AND (m.valid_to IS NULL OR i.valid_from<m.valid_to)
 ) THROW 51005, 'Membership periods in the same organization cannot overlap.', 1;
END;
GO
