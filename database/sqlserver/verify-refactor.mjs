import assert from 'node:assert/strict';
import { Pool, getDbPoolConfig } from '../../backend/src/config/database.js';

const pool = new Pool(getDbPoolConfig());

console.log('--- Starting Milestone 1 Refactor Verification ---');

try {
  // 1. app.achievements: check constraint and default constraint
  console.log('1. Verifying app.achievements constraints & statuses...');
  const achCheck = await pool.query(`
    SELECT cc.name, cc.definition
    FROM sys.check_constraints cc
    WHERE cc.parent_object_id = OBJECT_ID(N'app.achievements') AND cc.name = N'ck_achievements_status'
  `);
  assert.equal(achCheck.rows.length, 1, 'ck_achievements_status check constraint must exist');
  assert.ok(achCheck.rows[0].definition.includes('ACTIVE'), 'ck_achievements_status must allow ACTIVE status');

  const achDefault = await pool.query(`
    SELECT df.name, df.definition
    FROM sys.default_constraints df
    JOIN sys.columns c ON c.object_id = df.parent_object_id AND c.column_id = df.parent_column_id
    WHERE df.parent_object_id = OBJECT_ID(N'app.achievements') AND c.name = N'status'
  `);
  assert.equal(achDefault.rows.length, 1, 'Default constraint on app.achievements.status must exist');
  assert.ok(achDefault.rows[0].definition.includes('ACTIVE'), 'Default constraint on status must default to ACTIVE');

  // Verify all existing rows are ACTIVE
  const achRows = await pool.query(`
    SELECT COUNT(*) AS total, SUM(CASE WHEN status = N'ACTIVE' THEN 1 ELSE 0 END) AS active_count
    FROM app.achievements
  `);
  if (achRows.rows[0].total > 0) {
    assert.equal(
      achRows.rows[0].total,
      achRows.rows[0].active_count,
      'All existing achievement rows must have migrated to ACTIVE'
    );
  }
  console.log(`  ✓ app.achievements: constraint allows ACTIVE, defaults to ACTIVE, ${achRows.rows[0].total} rows migrated`);

  // 2. app.award_periods: submission_deadline column
  console.log('2. Verifying app.award_periods.submission_deadline...');
  const periodCol = await pool.query(`
    SELECT c.name, t.name AS type_name, c.is_nullable
    FROM sys.columns c
    JOIN sys.types t ON t.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID(N'app.award_periods') AND c.name = N'submission_deadline'
  `);
  assert.equal(periodCol.rows.length, 1, 'submission_deadline column must exist on app.award_periods');
  assert.equal(periodCol.rows[0].type_name, 'datetime2', 'submission_deadline must be DATETIME2');
  assert.equal(periodCol.rows[0].is_nullable, true, 'submission_deadline must be nullable');
  console.log('  ✓ app.award_periods.submission_deadline DATETIME2(3) NULL confirmed');

  // 3. app.kpi_goals & app.kpi_results: source column length & check constraints
  console.log('3. Verifying app.kpi_goals & app.kpi_results source column and constraints...');
  for (const table of ['kpi_goals', 'kpi_results']) {
    const colInfo = await pool.query(`
      SELECT c.name, t.name AS type_name, c.max_length
      FROM sys.columns c
      JOIN sys.types t ON t.user_type_id = c.user_type_id
      WHERE c.object_id = OBJECT_ID(N'app.' + @p1) AND c.name = N'source'
    `, [table]);
    assert.equal(colInfo.rows.length, 1, `${table}.source column must exist`);
    assert.equal(colInfo.rows[0].type_name, 'nvarchar', `${table}.source must be nvarchar`);
    assert.ok(colInfo.rows[0].max_length >= 60, `${table}.source max_length must be at least 60 bytes (30 chars)`);

    const chkInfo = await pool.query(`
      SELECT cc.name, cc.definition
      FROM sys.check_constraints cc
      WHERE cc.parent_object_id = OBJECT_ID(N'app.' + @p1)
        AND cc.parent_column_id = COLUMNPROPERTY(OBJECT_ID(N'app.' + @p1), N'source', 'ColumnId')
    `, [table]);
    assert.equal(chkInfo.rows.length, 1, `${table} must have check constraint on source`);
    const def = chkInfo.rows[0].definition;
    assert.ok(def.includes('AI_GAP'), `${table} check constraint must allow AI_GAP`);
    assert.ok(def.includes('AI_GAP_ANALYSIS'), `${table} check constraint must allow AI_GAP_ANALYSIS`);
    assert.ok(def.includes('SYSTEM'), `${table} check constraint must allow SYSTEM`);
    assert.ok(def.includes('MANUAL'), `${table} check constraint must allow MANUAL`);
  }
  console.log('  ✓ app.kpi_goals and app.kpi_results source columns updated and constraints validated');

  // 4. app.cv_profiles: table, columns, and unique filtered index on slug
  console.log('4. Verifying app.cv_profiles...');
  const cvTable = await pool.query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = N'app' AND TABLE_NAME = N'cv_profiles'
  `);
  assert.equal(cvTable.rows.length, 1, 'app.cv_profiles table must exist');

  const cvCols = await pool.query(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = N'app' AND TABLE_NAME = N'cv_profiles'
  `);
  const cvColNames = cvCols.rows.map(r => r.COLUMN_NAME);
  for (const expected of [
    'profile_id', 'user_id', 'slug', 'is_public', 'template_id',
    'custom_docx_storage_key', 'selected_achievement_ids', 'bio',
    'headline', 'version', 'created_at', 'updated_at'
  ]) {
    assert.ok(cvColNames.includes(expected), `app.cv_profiles must have column ${expected}`);
  }

  const slugIndex = await pool.query(`
    SELECT i.name, i.is_unique, i.has_filter, i.filter_definition
    FROM sys.indexes i
    WHERE i.object_id = OBJECT_ID(N'app.cv_profiles') AND i.name = N'uq_cv_profiles_slug'
  `);
  assert.equal(slugIndex.rows.length, 1, 'Unique index uq_cv_profiles_slug must exist on app.cv_profiles');
  assert.equal(slugIndex.rows[0].is_unique, true, 'uq_cv_profiles_slug must be unique');
  assert.equal(slugIndex.rows[0].has_filter, true, 'uq_cv_profiles_slug must be a filtered index');
  assert.ok(slugIndex.rows[0].filter_definition.includes('slug'), 'uq_cv_profiles_slug filter must check slug IS NOT NULL');
  console.log('  ✓ app.cv_profiles: table, 12 columns, and filtered unique index on slug confirmed');

  // 5. app.calendar_reminders: table and foreign keys
  console.log('5. Verifying app.calendar_reminders...');
  const calTable = await pool.query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = N'app' AND TABLE_NAME = N'calendar_reminders'
  `);
  assert.equal(calTable.rows.length, 1, 'app.calendar_reminders table must exist');

  const calFks = await pool.query(`
    SELECT fk.name, OBJECT_NAME(fk.referenced_object_id) AS ref_table,
           fk.is_disabled, fk.is_not_trusted
    FROM sys.foreign_keys fk
    WHERE fk.parent_object_id = OBJECT_ID(N'app.calendar_reminders')
  `);
  assert.ok(calFks.rows.length >= 1, 'app.calendar_reminders must have foreign key constraints');
  const refTables = calFks.rows.map(r => r.ref_table);
  assert.ok(refTables.includes('users'), 'Foreign key to app.users must exist');
  for (const fk of calFks.rows) {
    assert.equal(fk.is_disabled, false, `Foreign key ${fk.name} must be enabled`);
    assert.equal(fk.is_not_trusted, false, `Foreign key ${fk.name} must be trusted`);
  }
  console.log('  ✓ app.calendar_reminders: table exists with valid, trusted foreign keys');

  // 6. app.roles: 4 standard roles active, legacy roles inactive
  console.log('6. Verifying app.roles...');
  const roles = await pool.query(`
    SELECT code, is_active FROM app.roles WHERE code IN (
      'MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN',
      'COUNCIL', 'RECORDS_OFFICER', 'UNIT_REPRESENTATIVE', 'MANAGER'
    )
  `);
  const roleMap = new Map(roles.rows.map(r => [r.code, Boolean(r.is_active)]));
  for (const primary of ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN']) {
    assert.equal(roleMap.get(primary), true, `Primary role ${primary} must be active (is_active = 1)`);
  }
  for (const legacy of ['COUNCIL', 'RECORDS_OFFICER', 'UNIT_REPRESENTATIVE', 'MANAGER']) {
    assert.equal(roleMap.get(legacy), false, `Legacy role ${legacy} must be inactive (is_active = 0)`);
  }
  console.log('  ✓ app.roles: 4 primary roles active, 4 legacy roles deactivated');

  // 7. app.organization_units: LHU root and FIT/PHARM parents
  console.log('7. Verifying app.organization_units hierarchy...');
  const lhu = await pool.query(`
    SELECT unit_id, code, name, type, parent_id FROM app.organization_units WHERE code = N'LHU'
  `);
  assert.equal(lhu.rows.length, 1, 'Root unit LHU must exist');
  assert.equal(lhu.rows[0].type, 'UNIVERSITY', 'LHU type must be UNIVERSITY');
  assert.equal(lhu.rows[0].parent_id, null, 'LHU parent_id must be NULL');
  const lhuId = lhu.rows[0].unit_id;

  const faculties = await pool.query(`
    SELECT code, parent_id, type FROM app.organization_units WHERE code IN (N'FIT', N'PHARM')
  `);
  assert.equal(faculties.rows.length, 2, 'Faculties FIT and PHARM must exist');
  for (const fac of faculties.rows) {
    assert.equal(fac.parent_id, lhuId, `Faculty ${fac.code} parent_id must point to LHU (${lhuId})`);
    assert.equal(fac.type, 'FACULTY', `Faculty ${fac.code} type must be FACULTY`);
  }

  const departments = await pool.query(`
    SELECT d.code, d.parent_id, f.code AS parent_code
    FROM app.organization_units d
    JOIN app.organization_units f ON f.unit_id = d.parent_id
    WHERE d.code IN (N'FIT_SE', N'FIT_CS')
  `);
  assert.equal(departments.rows.length, 2, 'Departments FIT_SE and FIT_CS must exist');
  for (const dept of departments.rows) {
    assert.equal(dept.parent_code, 'FIT', `Department ${dept.code} parent must be FIT`);
  }
  console.log(`  ✓ app.organization_units: 3-level tree confirmed (LHU [${lhuId}] -> FIT/PHARM -> FIT_SE/FIT_CS)`);

  // 8. Functional transactional check: cv_profiles and calendar_reminders insertion & constraints
  console.log('8. Functional validation in isolated transaction...');
  const runId = Date.now();
  const profileSlug = `test-slug-${runId}`;
  const goalCode = `TEST-GAP-${runId}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Test cv_profile insertion & unique slug
    await client.query(`
      INSERT INTO app.cv_profiles (user_id, slug, is_public, template_id, headline)
      VALUES (1, @p1, 1, N'modern', N'Senior Lecturer')
    `, [profileSlug]);

    // Test duplicate slug failure
    let slugCollisionCaught = false;
    try {
      await client.query(`
        INSERT INTO app.cv_profiles (user_id, slug, is_public, template_id)
        VALUES (2, @p1, 1, N'academic')
      `, [profileSlug]);
    } catch {
      slugCollisionCaught = true;
    }
    assert.equal(slugCollisionCaught, true, 'Duplicate non-null slug must be rejected by unique index');

    // Test multiple null slugs allowed
    await client.query(`
      INSERT INTO app.cv_profiles (user_id, slug, is_public) VALUES (2, NULL, 0);
      INSERT INTO app.cv_profiles (user_id, slug, is_public) VALUES (3, NULL, 0);
    `);

    // Test calendar reminder insertion with FKs
    await client.query(`
      INSERT INTO app.calendar_reminders (user_id, title, deadline_date)
      VALUES (1, N'Hạn nộp hồ sơ thi đua 2026', '2026-12-31T23:59:59');
    `);

    // Test kpi_goals with AI_GAP source
    await client.query(`
      INSERT INTO app.kpi_goals (lecturer_id, context_unit_id, code, title, measure_unit, period_start, period_end, target, source, source_note, created_by)
      VALUES (1, 1, @p1, N'Công bố bài báo quốc tế', N'bài', '2026-01-01', '2026-12-31', 1.0, N'AI_GAP', N'Tạo từ Trợ lý AI Khám Quy chế', 1);
    `, [goalCode]);

    // Test invalid kpi_goals source failure
    let invalidSourceCaught = false;
    try {
      await client.query(`
        INSERT INTO app.kpi_goals (lecturer_id, context_unit_id, code, title, measure_unit, period_start, period_end, target, source, source_note, created_by)
        VALUES (1, 1, @p1, N'Invalid Source Test', N'bài', '2026-01-01', '2026-12-31', 1.0, N'INVALID_SOURCE', N'Note', 1);
      `, [`${goalCode}-INV`]);
    } catch {
      invalidSourceCaught = true;
    }
    assert.equal(invalidSourceCaught, true, 'Invalid kpi_goals source must be rejected by check constraint');

    await client.query('ROLLBACK');
    console.log('  ✓ Functional insertions and constraint rejections verified (rolled back cleanly)');
  } finally {
    try { await client.query('ROLLBACK'); } catch {}
    client.release();
    await pool.query('DELETE FROM app.kpi_goals WHERE code LIKE @p1', [`TEST-GAP-${runId}%`]);
    await pool.query('DELETE FROM app.cv_profiles WHERE slug = @p1', [profileSlug]);
    await pool.query('DELETE FROM app.calendar_reminders WHERE title = N\'Hạn nộp hồ sơ thi đua 2026\'');
  }

  console.log('\n========================================');
  console.log('ALL REFACTOR VERIFICATIONS PASSED (100%)');
  console.log('========================================');
} finally {
  await pool.end();
}
