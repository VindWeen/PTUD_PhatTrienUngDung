-- Set-based replacements for PostgreSQL exclusion constraints and business triggers.
-- Range checks use half-open [from,to) intervals; revoked representatives are ignored.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER TRIGGER app.trg_prevent_organization_cycle
ON app.organization_units AFTER INSERT, UPDATE AS
BEGIN
  SET NOCOUNT ON;
  IF NOT UPDATE(parent_id) RETURN;
  DECLARE @locked BIGINT, @has_cycle BIT = 0;
  SELECT @locked = COUNT_BIG(*) FROM app.organization_units WITH (TABLOCKX, HOLDLOCK);
  ;WITH ancestors AS (
    SELECT unit_id, parent_id, CAST(',' + CONVERT(VARCHAR(20),unit_id) + ',' AS VARCHAR(MAX)) AS visited,
      CAST(0 AS BIT) AS cycle
    FROM inserted
    UNION ALL
    SELECT p.unit_id, p.parent_id,
      CAST(a.visited + CONVERT(VARCHAR(20),p.unit_id) + ',' AS VARCHAR(MAX)),
      CAST(CASE WHEN CHARINDEX(',' + CONVERT(VARCHAR(20),p.unit_id) + ',',a.visited)>0 THEN 1 ELSE 0 END AS BIT)
    FROM ancestors a JOIN app.organization_units p ON p.unit_id=a.parent_id
    WHERE a.cycle=0
  )
  SELECT @has_cycle=1 FROM ancestors WHERE cycle=1 OPTION(MAXRECURSION 0);
  IF @has_cycle=1 THROW 51014, N'Organization hierarchy cannot contain a cycle.', 1;
END;
GO
CREATE OR ALTER TRIGGER app.trg_lecturer_assignments_no_overlap
ON app.lecturer_assignments AFTER INSERT, UPDATE AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @locked BIGINT;
  SELECT @locked=COUNT_BIG(*) FROM app.lecturer_assignments WITH(TABLOCKX,HOLDLOCK);
  IF EXISTS (
    SELECT 1 FROM inserted i JOIN app.lecturer_assignments a
      ON a.lecturer_id=i.lecturer_id AND a.assignment_id<>i.assignment_id
      AND (a.unit_id=i.unit_id OR (a.is_primary=1 AND i.is_primary=1))
    WHERE (i.valid_to IS NULL OR i.valid_to>i.valid_from)
      AND (a.valid_to IS NULL OR a.valid_to>a.valid_from)
      AND (a.valid_to IS NULL OR i.valid_from<a.valid_to)
      AND (i.valid_to IS NULL OR a.valid_from<i.valid_to)
  ) THROW 51001, N'Lecturer assignments overlap for the same unit or primary assignment.', 1;
END;
GO
CREATE OR ALTER TRIGGER app.trg_unit_representatives_no_overlap
ON app.unit_representatives AFTER INSERT, UPDATE AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @locked BIGINT;
  SELECT @locked=COUNT_BIG(*) FROM app.unit_representatives WITH(TABLOCKX,HOLDLOCK);
  IF EXISTS (
    SELECT 1 FROM inserted i JOIN app.unit_representatives r
      ON r.unit_id=i.unit_id AND r.unit_representative_id<>i.unit_representative_id
    WHERE i.revoked_at IS NULL AND r.revoked_at IS NULL
      AND (r.valid_to IS NULL OR i.valid_from<r.valid_to)
      AND (i.valid_to IS NULL OR r.valid_from<i.valid_to)
  ) THROW 51001, N'Active representative assignment intervals overlap for the same unit.', 1;
END;
GO
CREATE OR ALTER TRIGGER app.immutable_award_application_input
ON app.award_application_inputs INSTEAD OF UPDATE, DELETE AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS(SELECT 1 FROM deleted)
    THROW 51002, N'Award application input snapshot is immutable; submit a new input version.', 1;
END;
GO
CREATE OR ALTER TRIGGER app.criteria_source_rules_after
ON app.award_criteria_versions AFTER INSERT, UPDATE AS
BEGIN
  SET NOCOUNT ON;
  -- The internal revision/approval UPDATE does not recurse into this body.
  IF TRIGGER_NESTLEVEL(OBJECT_ID(N'app.criteria_source_rules_after'))>1 RETURN;
  DECLARE @changed TABLE (
    criteria_version_id BIGINT PRIMARY KEY, revision INT NOT NULL,
    previous_rules NVARCHAR(MAX), source_rules NVARCHAR(MAX), changed_by BIGINT
  );
  INSERT @changed(criteria_version_id,revision,previous_rules,source_rules,changed_by)
    SELECT i.criteria_version_id,
      CASE WHEN d.criteria_version_id IS NULL THEN 1 ELSE d.source_rules_revision+1 END,
      d.source_rules,i.source_rules,i.source_rules_by
    FROM inserted i LEFT JOIN deleted d ON d.criteria_version_id=i.criteria_version_id
    WHERE (d.criteria_version_id IS NULL AND i.source_rules IS NOT NULL)
      OR (d.criteria_version_id IS NOT NULL AND (
        (i.source_rules IS NULL AND d.source_rules IS NOT NULL) OR
        (i.source_rules IS NOT NULL AND d.source_rules IS NULL) OR
        (i.source_rules COLLATE Latin1_General_100_BIN2<>d.source_rules COLLATE Latin1_General_100_BIN2)));
  UPDATE t SET source_rules_revision=c.revision,is_confirmed=0,confirmed_by=NULL,confirmed_at=NULL
    FROM app.award_criteria_versions t JOIN @changed c ON c.criteria_version_id=t.criteria_version_id;
  -- A caller cannot change the revision without changing the rules.
  UPDATE t SET source_rules_revision=CASE WHEN d.criteria_version_id IS NULL THEN 0 ELSE d.source_rules_revision END
    FROM app.award_criteria_versions t JOIN inserted i ON i.criteria_version_id=t.criteria_version_id
    LEFT JOIN deleted d ON d.criteria_version_id=i.criteria_version_id
    WHERE NOT EXISTS(SELECT 1 FROM @changed c WHERE c.criteria_version_id=t.criteria_version_id);
  INSERT app.criteria_source_rule_history(criteria_version_id,revision,previous_rules,source_rules,changed_by)
    SELECT criteria_version_id,revision,previous_rules,source_rules,changed_by FROM @changed;
END;
GO
