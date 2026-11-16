-- Cross-row integrity. These triggers are set-based and run inside caller transactions.
-- Stable application locks serialize competing graph / membership writes. Lock failures
-- (including deadlock victims) are errors; callers should retry the entire transaction.
-- No trigger grants access: API services must validate actor permissions/consent,
-- apply link requests atomically with parent/history writes, and record audit events.
CREATE TRIGGER app.TR_organizations_no_cycle ON app.organizations
AFTER INSERT, UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF NOT UPDATE(parent_id) RETURN;
 DECLARE @lock_result int;
 EXEC @lock_result=sys.sp_getapplock @Resource=N'PTUD_V2_ORGANIZATION_TREE', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000;
 IF @lock_result<0 THROW 51001, 'Could not lock organization tree; retry transaction.', 1;
 DECLARE @cycle bit=0;
 ;WITH ancestors AS (
   SELECT i.id AS origin_id, i.parent_id AS next_id,
     CAST(N'/'+CONVERT(nvarchar(20),i.id)+N'/' AS nvarchar(max)) AS visited, CAST(0 AS bit) AS cycle
   FROM inserted i
   UNION ALL
   SELECT a.origin_id, p.parent_id,
     CAST(a.visited+CONVERT(nvarchar(20),p.id)+N'/' AS nvarchar(max)),
     CAST(CASE WHEN CHARINDEX(N'/'+CONVERT(nvarchar(20),p.id)+N'/',a.visited)>0 THEN 1 ELSE 0 END AS bit)
   FROM ancestors a JOIN app.organizations p WITH (UPDLOCK,HOLDLOCK) ON p.id=a.next_id
   WHERE a.cycle=0
 )
 SELECT @cycle=1 FROM ancestors WHERE cycle=1 OPTION(MAXRECURSION 32767);
 IF @cycle=1 THROW 51002, 'Organization hierarchy cannot contain a cycle.', 1;
END;
GO
CREATE TRIGGER app.TR_memberships_integrity ON app.memberships
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
 IF EXISTS (
   SELECT 1 FROM inserted i JOIN app.memberships m WITH (UPDLOCK,HOLDLOCK,INDEX(IX_membership_scope))
   ON m.organization_id=i.organization_id AND m.user_id=i.user_id AND m.id<>i.id
   WHERE (i.valid_to IS NULL OR m.valid_from<i.valid_to) AND (m.valid_to IS NULL OR i.valid_from<m.valid_to)
 ) THROW 51005, 'Membership periods in the same organization cannot overlap.', 1;
END;
GO
CREATE TRIGGER app.TR_invitations_preserve_consent ON app.membership_invitations
AFTER UPDATE, DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS (
   SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id=d.id
   WHERE d.status='ACCEPTED' AND (
     i.id IS NULL OR i.status<>'ACCEPTED' OR i.organization_id<>d.organization_id OR
     i.invitee_user_id<>d.invitee_user_id OR i.invited_by_user_id<>d.invited_by_user_id OR
     i.responded_at<>d.responded_at OR i.responded_by_user_id<>d.responded_by_user_id OR
     i.created_at<>d.created_at OR i.expires_at<>d.expires_at)
 ) THROW 51006, 'Accepted membership consent is immutable.', 1;
END;
GO
-- Version content is write-once after publication, including source metadata.
-- Build draft -> groups/criteria -> publish. Corrections require a new version.
CREATE TRIGGER app.TR_versions_immutable ON app.regulation_versions
AFTER INSERT, UPDATE, DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM deleted WHERE publication_status='PUBLISHED')
   THROW 51007, 'Published regulation versions are immutable; create a new version.', 1;
 IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.id=i.id WHERE i.publication_status='PUBLISHED' AND d.id IS NULL)
   THROW 51008, 'Create a draft version and its criteria before publishing.', 1;
 IF EXISTS(SELECT 1 FROM inserted i WHERE i.publication_status='PUBLISHED' AND NOT EXISTS(SELECT 1 FROM app.criteria c WHERE c.regulation_version_id=i.id))
   THROW 51009, 'A published regulation version must contain criteria.', 1;
END;
GO
CREATE TRIGGER app.TR_groups_draft_only ON app.criterion_groups
AFTER INSERT, UPDATE, DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS (
   SELECT 1 FROM app.regulation_versions v WITH (UPDLOCK,HOLDLOCK)
   JOIN (SELECT regulation_version_id FROM inserted UNION SELECT regulation_version_id FROM deleted) changed ON changed.regulation_version_id=v.id
   WHERE v.publication_status='PUBLISHED'
 ) THROW 51010, 'Groups of published regulation versions are immutable.', 1;
END;
GO
CREATE TRIGGER app.TR_criteria_draft_only ON app.criteria
AFTER INSERT, UPDATE, DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS (
   SELECT 1 FROM app.regulation_versions v WITH (UPDLOCK,HOLDLOCK)
   JOIN (SELECT regulation_version_id FROM inserted UNION SELECT regulation_version_id FROM deleted) changed ON changed.regulation_version_id=v.id
   WHERE v.publication_status='PUBLISHED'
 ) THROW 51011, 'Criteria of published regulation versions are immutable.', 1;
END;
GO
CREATE TRIGGER app.TR_runs_integrity ON app.assessment_runs
AFTER INSERT, UPDATE, DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM deleted WHERE status IN ('COMPLETED','FAILED'))
   THROW 51012, 'Finished assessment snapshots are immutable.', 1;
 -- Subject/version/input identity cannot be swapped after child results exist.
 IF EXISTS (
   SELECT 1 FROM inserted i JOIN deleted d ON d.id=i.id
   WHERE i.subject_user_id<>d.subject_user_id OR i.regulation_version_id<>d.regulation_version_id OR
     i.initiated_by_user_id<>d.initiated_by_user_id OR i.assessed_at<>d.assessed_at OR
     i.evaluation_date<>d.evaluation_date OR i.evaluator_version<>d.evaluator_version OR
     i.input_snapshot_json<>d.input_snapshot_json
 ) THROW 51013, 'Assessment input identity and snapshot cannot change after creation.', 1;
 IF EXISTS (
   SELECT 1 FROM inserted i JOIN app.regulation_versions v WITH (UPDLOCK,HOLDLOCK) ON v.id=i.regulation_version_id
   WHERE v.publication_status<>'PUBLISHED'
 ) THROW 51014, 'Assessments require a published regulation version.', 1;
 IF EXISTS (
   SELECT 1 FROM inserted i WHERE i.status='COMPLETED' AND EXISTS (
     SELECT 1 FROM app.criteria c WHERE c.regulation_version_id=i.regulation_version_id
       AND NOT EXISTS(SELECT 1 FROM app.criterion_results r WHERE r.run_id=i.id AND r.criterion_id=c.id))
 ) THROW 51015, 'Completed assessment must contain a result for every criterion.', 1;
END;
GO
CREATE TRIGGER app.TR_results_running_only ON app.criterion_results
AFTER INSERT, UPDATE, DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS (
   SELECT 1 FROM app.assessment_runs r WITH (UPDLOCK,HOLDLOCK)
   JOIN (SELECT run_id FROM inserted UNION SELECT run_id FROM deleted) changed ON changed.run_id=r.id
   WHERE r.status<>'RUNNING'
 ) THROW 51016, 'Criterion results can only change while assessment is running.', 1;
END;
GO
CREATE TRIGGER app.TR_result_evidence_running_only ON app.result_evidence
AFTER INSERT, UPDATE, DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS (
   SELECT 1 FROM app.assessment_runs r WITH (UPDLOCK,HOLDLOCK)
   JOIN app.criterion_results cr ON cr.run_id=r.id
   JOIN (SELECT criterion_result_id FROM inserted UNION SELECT criterion_result_id FROM deleted) changed ON changed.criterion_result_id=cr.id
   WHERE r.status<>'RUNNING'
 ) THROW 51017, 'Evidence snapshots can only change while assessment is running.', 1;
END;
GO
CREATE TRIGGER app.TR_audit_append_only ON app.audit_events
AFTER UPDATE, DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM deleted) THROW 51018, 'Audit events are append-only.', 1;
END;
GO
CREATE TRIGGER app.TR_link_history_append_only ON app.organization_link_history
AFTER UPDATE, DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM deleted) THROW 51019, 'Organization link history is append-only.', 1;
END;
GO
