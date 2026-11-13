import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool, getDbPoolConfig } from '../backend/src/config/database.js';

const pool = new Pool(getDbPoolConfig());

// Helper to run each test in an isolated transaction that ALWAYS rolls back
async function withIsolatedTx(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION');
    return await callback(client);
  } finally {
    try {
      await client.query('IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION');
    } catch {}
    client.release();
  }
}

test.before(async () => {
  const ping = await pool.query('SELECT 1 AS alive');
  assert.equal(ping.rows[0].alive, 1, 'Database connection must be established');
});

test.after(async () => {
  await pool.end();
});

// =========================================================================
// Category 1: app.achievements constraint & default enforcement
// =========================================================================
test('1.1: Reject invalid status BOGUS_STATUS in app.achievements', async () => {
  await withIsolatedTx(async (client) => {
    let rejected = false;
    try {
      await client.query(`
        INSERT INTO app.achievements (lecturer_id, context_unit_id, title, status)
        VALUES (1, 1, N'Challenge Test Bogus Status', N'BOGUS_STATUS')
      `);
    } catch (err) {
      rejected = true;
      assert.ok(
        err.message.includes('ck_achievements_status') || err.number === 547,
        `Expected check constraint violation, got error #${err.number}: ${err.message}`
      );
    }
    assert.equal(rejected, true, 'Insert with BOGUS_STATUS must fail check constraint');
  });
});

test('1.2: Reject lowercase active under Latin1_General_100_BIN2 collation in app.achievements', async () => {
  await withIsolatedTx(async (client) => {
    let rejected = false;
    try {
      await client.query(`
        INSERT INTO app.achievements (lecturer_id, context_unit_id, title, status)
        VALUES (1, 1, N'Challenge Test Lowercase Active', N'active')
      `);
    } catch (err) {
      rejected = true;
      assert.ok(
        err.message.includes('ck_achievements_status') || err.number === 547,
        `Expected check constraint violation for lowercase active, got error #${err.number}: ${err.message}`
      );
    }
    assert.equal(rejected, true, 'Insert with lowercase active must fail BIN2 check constraint');
  });
});

test('1.3: Reject empty status string in app.achievements', async () => {
  await withIsolatedTx(async (client) => {
    let rejected = false;
    try {
      await client.query(`
        INSERT INTO app.achievements (lecturer_id, context_unit_id, title, status)
        VALUES (1, 1, N'Challenge Test Empty Status', N'')
      `);
    } catch (err) {
      rejected = true;
      assert.ok(err.number === 547, `Expected check constraint violation, got: ${err.message}`);
    }
    assert.equal(rejected, true, 'Insert with empty string status must fail check constraint');
  });
});

test('1.4: Reject NULL status in app.achievements', async () => {
  await withIsolatedTx(async (client) => {
    let rejected = false;
    try {
      await client.query(`
        INSERT INTO app.achievements (lecturer_id, context_unit_id, title, status)
        VALUES (1, 1, N'Challenge Test NULL Status', NULL)
      `);
    } catch (err) {
      rejected = true;
      assert.ok(
        err.number === 515 || err.message.includes('cannot insert the value NULL'),
        `Expected NOT NULL violation, got: ${err.message}`
      );
    }
    assert.equal(rejected, true, 'Insert with NULL status must be rejected');
  });
});

test('1.5: Insert valid status ACTIVE in app.achievements must succeed', async () => {
  await withIsolatedTx(async (client) => {
    const res = await client.query(`
      INSERT INTO app.achievements (lecturer_id, context_unit_id, title, status)
      OUTPUT inserted.achievement_id, inserted.status
      VALUES (1, 1, N'Challenge Test Valid ACTIVE Status', N'ACTIVE')
    `);
    assert.equal(res.rows.length, 1, 'Row must be inserted');
    assert.equal(res.rows[0].status, 'ACTIVE', 'Inserted status must be ACTIVE');
  });
});

test('1.6: Insert without status column in app.achievements must default to ACTIVE', async () => {
  await withIsolatedTx(async (client) => {
    const res = await client.query(`
      INSERT INTO app.achievements (lecturer_id, context_unit_id, title)
      OUTPUT inserted.achievement_id, inserted.status
      VALUES (1, 1, N'Challenge Test Default Status')
    `);
    assert.equal(res.rows.length, 1, 'Row must be inserted');
    assert.equal(res.rows[0].status, 'ACTIVE', 'Default status must be ACTIVE');
  });
});

test('1.7: Valid historical statuses in app.achievements must all succeed', async () => {
  await withIsolatedTx(async (client) => {
    const historicalStatuses = [
      'DRAFT', 'SUBMITTED', 'NEED_CORRECTION', 'VERIFIED',
      'APPROVED', 'REJECTED', 'CANCELLED', 'REVOKED', 'RETURNED', 'PENDING'
    ];
    for (const st of historicalStatuses) {
      const res = await client.query(`
        INSERT INTO app.achievements (lecturer_id, context_unit_id, title, status)
        OUTPUT inserted.status
        VALUES (1, 1, N'Historical Test ' + @p1, @p1)
      `, [st]);
      assert.equal(res.rows[0].status, st, `Status ${st} must be accepted`);
    }
  });
});

// =========================================================================
// Category 2: app.kpi_goals & app.kpi_results source constraints
// =========================================================================
test('2.1: kpi_goals rejects invalid source INVALID_SOURCE', async () => {
  await withIsolatedTx(async (client) => {
    let rejected = false;
    try {
      await client.query(`
        INSERT INTO app.kpi_goals (lecturer_id, context_unit_id, code, title, measure_unit, period_start, period_end, target, source, source_note, created_by)
        VALUES (1, 1, N'TEST-INV-SRC', N'Invalid Source Goal', N'bài', '2026-01-01', '2026-12-31', 1.0, N'INVALID_SOURCE', N'Note', 1)
      `);
    } catch (err) {
      rejected = true;
      assert.ok(
        err.message.includes('ck_kpi_goals_source') || err.number === 547,
        `Expected ck_kpi_goals_source violation, got error #${err.number}: ${err.message}`
      );
    }
    assert.equal(rejected, true, 'kpi_goals must reject INVALID_SOURCE');
  });
});

test('2.2: kpi_goals rejects lowercase source ai_gap under BIN2 collation', async () => {
  await withIsolatedTx(async (client) => {
    let rejected = false;
    try {
      await client.query(`
        INSERT INTO app.kpi_goals (lecturer_id, context_unit_id, code, title, measure_unit, period_start, period_end, target, source, source_note, created_by)
        VALUES (1, 1, N'TEST-LOW-SRC', N'Lowercase Source Goal', N'bài', '2026-01-01', '2026-12-31', 1.0, N'ai_gap', N'Note', 1)
      `);
    } catch (err) {
      rejected = true;
      assert.ok(err.number === 547, `Expected check constraint violation, got: ${err.message}`);
    }
    assert.equal(rejected, true, 'kpi_goals must reject lowercase ai_gap');
  });
});

test('2.3: kpi_goals accepts valid sources AI_GAP, AI_GAP_ANALYSIS, SYSTEM, MANUAL, CSV', async () => {
  await withIsolatedTx(async (client) => {
    const validSources = ['AI_GAP', 'AI_GAP_ANALYSIS', 'SYSTEM', 'MANUAL', 'CSV'];
    for (let i = 0; i < validSources.length; i++) {
      const src = validSources[i];
      const res = await client.query(`
        INSERT INTO app.kpi_goals (lecturer_id, context_unit_id, code, title, measure_unit, period_start, period_end, target, source, source_note, created_by)
        OUTPUT inserted.source
        VALUES (1, 1, @p1, N'Valid Goal ' + @p2, N'bài', '2026-01-01', '2026-12-31', 1.0, @p2, N'Note', 1)
      `, [`TEST-VALID-${i}`, src]);
      assert.equal(res.rows[0].source, src, `kpi_goals must accept source ${src}`);
    }
  });
});

test('2.4: kpi_results rejects invalid source INVALID_SOURCE', async () => {
  await withIsolatedTx(async (client) => {
    const gRes = await client.query(`
      INSERT INTO app.kpi_goals (lecturer_id, context_unit_id, code, title, measure_unit, period_start, period_end, target, source, source_note, created_by)
      OUTPUT inserted.goal_id
      VALUES (1, 1, N'TEMP-FOR-RES-INV', N'Temp Goal For Results', N'bài', '2026-01-01', '2026-12-31', 1.0, N'MANUAL', N'Note', 1)
    `);
    const goalId = gRes.rows[0].goal_id;

    let rejected = false;
    try {
      await client.query(`
        INSERT INTO app.kpi_results (goal_id, actual, source, source_note, evidence_note, created_by)
        VALUES (@p1, 1.0, N'INVALID_SOURCE', N'Note', N'Evidence', 1)
      `, [goalId]);
    } catch (err) {
      rejected = true;
      assert.ok(
        err.message.includes('ck_kpi_results_source') || err.number === 547,
        `Expected ck_kpi_results_source violation, got error #${err.number}: ${err.message}`
      );
    }
    assert.equal(rejected, true, 'kpi_results must reject INVALID_SOURCE');
  });
});

test('2.5: kpi_results accepts valid sources AI_GAP, AI_GAP_ANALYSIS, SYSTEM, MANUAL, CSV', async () => {
  await withIsolatedTx(async (client) => {
    const validSources = ['AI_GAP', 'AI_GAP_ANALYSIS', 'SYSTEM', 'MANUAL', 'CSV'];
    for (let i = 0; i < validSources.length; i++) {
      const src = validSources[i];
      const gRes = await client.query(`
        INSERT INTO app.kpi_goals (lecturer_id, context_unit_id, code, title, measure_unit, period_start, period_end, target, source, source_note, created_by)
        OUTPUT inserted.goal_id
        VALUES (1, 1, @p1, N'Temp Goal ' + @p2, N'bài', '2026-01-01', '2026-12-31', 1.0, @p2, N'Note', 1)
      `, [`TEMP-GOAL-${i}`, src]);
      const gId = gRes.rows[0].goal_id;

      const rRes = await client.query(`
        INSERT INTO app.kpi_results (goal_id, actual, source, source_note, evidence_note, created_by)
        OUTPUT inserted.source
        VALUES (@p1, 1.0, @p2, N'Note', N'Evidence', 1)
      `, [gId, src]);
      assert.equal(rRes.rows[0].source, src, `kpi_results must accept source ${src}`);
    }
  });
});

// =========================================================================
// Category 3: app.cv_profiles slug unique filtered index & FKs
// =========================================================================
test('3.1: app.cv_profiles allows multiple rows with slug = NULL for different users', async () => {
  await withIsolatedTx(async (client) => {
    const res1 = await client.query(`
      INSERT INTO app.cv_profiles (user_id, slug, is_public)
      OUTPUT inserted.profile_id, inserted.slug
      VALUES (1, NULL, 0)
    `);
    assert.equal(res1.rows[0].slug, null);

    const res2 = await client.query(`
      INSERT INTO app.cv_profiles (user_id, slug, is_public)
      OUTPUT inserted.profile_id, inserted.slug
      VALUES (2, NULL, 0)
    `);
    assert.equal(res2.rows[0].slug, null);

    const res3 = await client.query(`
      INSERT INTO app.cv_profiles (user_id, slug, is_public)
      OUTPUT inserted.profile_id, inserted.slug
      VALUES (3, NULL, 0)
    `);
    assert.equal(res3.rows[0].slug, null);
  });
});

test('3.2: app.cv_profiles accepts valid unique non-null slug', async () => {
  await withIsolatedTx(async (client) => {
    const slug = `challenger-test-slug-${Date.now()}`;
    const res = await client.query(`
      INSERT INTO app.cv_profiles (user_id, slug, is_public, template_id, headline)
      OUTPUT inserted.profile_id, inserted.slug, inserted.template_id, inserted.is_public, inserted.version
      VALUES (1, @p1, 1, N'academic', N'Dean of FIT')
    `, [slug]);
    assert.equal(res.rows[0].slug, slug);
    assert.equal(res.rows[0].is_public, true);
    assert.equal(res.rows[0].template_id, 'academic');
    assert.equal(res.rows[0].version, 1);
  });
});

test('3.3: app.cv_profiles rejects duplicate non-null slug with unique index violation', async () => {
  await withIsolatedTx(async (client) => {
    const slug = `duplicate-slug-${Date.now()}`;
    await client.query(`
      INSERT INTO app.cv_profiles (user_id, slug, is_public, template_id)
      VALUES (1, @p1, 1, N'standard')
    `, [slug]);

    let rejected = false;
    try {
      await client.query(`
        INSERT INTO app.cv_profiles (user_id, slug, is_public, template_id)
        VALUES (2, @p1, 1, N'modern')
      `, [slug]);
    } catch (err) {
      rejected = true;
      assert.ok(
        err.number === 2601 || err.number === 2627 || err.message.includes('uq_cv_profiles_slug'),
        `Expected unique index violation (2601/2627), got error #${err.number}: ${err.message}`
      );
    }
    assert.equal(rejected, true, 'Duplicate non-null slug must fail uq_cv_profiles_slug index');
  });
});

test('3.4: app.cv_profiles rejects updating existing row to duplicate non-null slug', async () => {
  await withIsolatedTx(async (client) => {
    const slugA = `slug-alpha-${Date.now()}`;
    const slugB = `slug-beta-${Date.now()}`;

    await client.query(`
      INSERT INTO app.cv_profiles (user_id, slug, is_public) VALUES (1, @p1, 1)
    `, [slugA]);

    const profB = await client.query(`
      INSERT INTO app.cv_profiles (user_id, slug, is_public)
      OUTPUT inserted.profile_id
      VALUES (2, @p1, 1)
    `, [slugB]);
    const bId = profB.rows[0].profile_id;

    let rejected = false;
    try {
      await client.query(`
        UPDATE app.cv_profiles SET slug = @p1 WHERE profile_id = @p2
      `, [slugA, bId]);
    } catch (err) {
      rejected = true;
      assert.ok(
        err.number === 2601 || err.number === 2627 || err.message.includes('uq_cv_profiles_slug'),
        `Expected unique index violation on update, got error #${err.number}: ${err.message}`
      );
    }
    assert.equal(rejected, true, 'Updating to duplicate slug must fail unique index');
  });
});

test('3.5: app.cv_profiles rejects non-existent user_id via foreign key constraint', async () => {
  await withIsolatedTx(async (client) => {
    let rejected = false;
    try {
      await client.query(`
        INSERT INTO app.cv_profiles (user_id, slug, is_public)
        VALUES (999999999, N'orphan-cv', 0)
      `);
    } catch (err) {
      rejected = true;
      assert.ok(
        err.number === 547 || err.message.includes('fk_cv_profiles_user'),
        `Expected foreign key violation (547), got: ${err.message}`
      );
    }
    assert.equal(rejected, true, 'Non-existent user_id must be rejected by foreign key constraint');
  });
});

test('3.6: app.cv_profiles defaults are correctly populated on minimal insert', async () => {
  await withIsolatedTx(async (client) => {
    const res = await client.query(`
      INSERT INTO app.cv_profiles (user_id)
      OUTPUT inserted.profile_id, inserted.slug, inserted.is_public, inserted.template_id,
             inserted.custom_docx_storage_key, inserted.version, inserted.created_at, inserted.updated_at
      VALUES (1)
    `);
    const row = res.rows[0];
    assert.ok(row.profile_id, 'profile_id must be generated GUID');
    assert.equal(row.slug, null, 'slug must default to NULL');
    assert.equal(row.is_public, false, 'is_public must default to 0 (false)');
    assert.equal(row.template_id, 'standard', 'template_id must default to standard');
    assert.equal(row.custom_docx_storage_key, null, 'custom_docx_storage_key must default to NULL');
    assert.equal(row.version, 1, 'version must default to 1');
    assert.ok(row.created_at, 'created_at must be populated');
    assert.ok(row.updated_at, 'updated_at must be populated');
  });
});

// =========================================================================
// Category 4: app.calendar_reminders foreign keys & defaults
// =========================================================================
test('4.1: app.calendar_reminders rejects non-existent user_id', async () => {
  await withIsolatedTx(async (client) => {
    let rejected = false;
    try {
      await client.query(`
        INSERT INTO app.calendar_reminders (user_id, title, deadline_date)
        VALUES (999999999, N'Reminder Invalid User', '2026-12-31')
      `);
    } catch (err) {
      rejected = true;
      assert.ok(err.number === 547, `Expected FK violation (547), got: ${err.message}`);
    }
    assert.equal(rejected, true, 'Non-existent user_id must be rejected');
  });
});

test('4.2: app.calendar_reminders rejects non-existent regulation_id', async () => {
  await withIsolatedTx(async (client) => {
    let rejected = false;
    try {
      await client.query(`
        INSERT INTO app.calendar_reminders (user_id, title, deadline_date, regulation_id)
        VALUES (1, N'Reminder Invalid Reg', '2026-12-31', 999999999)
      `);
    } catch (err) {
      rejected = true;
      assert.ok(err.number === 547, `Expected FK violation (547), got: ${err.message}`);
    }
    assert.equal(rejected, true, 'Non-existent regulation_id must be rejected');
  });
});

test('4.3: app.calendar_reminders rejects non-existent award_period_id', async () => {
  await withIsolatedTx(async (client) => {
    let rejected = false;
    try {
      await client.query(`
        INSERT INTO app.calendar_reminders (user_id, title, deadline_date, award_period_id)
        VALUES (1, N'Reminder Invalid Period', '2026-12-31', 999999999)
      `);
    } catch (err) {
      rejected = true;
      assert.ok(err.number === 547, `Expected FK violation (547), got: ${err.message}`);
    }
    assert.equal(rejected, true, 'Non-existent award_period_id must be rejected');
  });
});

test('4.4: app.calendar_reminders rejects non-existent kpi_goal_id', async () => {
  await withIsolatedTx(async (client) => {
    let rejected = false;
    try {
      await client.query(`
        INSERT INTO app.calendar_reminders (user_id, title, deadline_date, kpi_goal_id)
        VALUES (1, N'Reminder Invalid Goal', '2026-12-31', 999999999)
      `);
    } catch (err) {
      rejected = true;
      assert.ok(err.number === 547, `Expected FK violation (547), got: ${err.message}`);
    }
    assert.equal(rejected, true, 'Non-existent kpi_goal_id must be rejected');
  });
});

test('4.5: app.calendar_reminders rejects non-existent event_id', async () => {
  await withIsolatedTx(async (client) => {
    let rejected = false;
    try {
      await client.query(`
        INSERT INTO app.calendar_reminders (user_id, title, deadline_date, event_id)
        VALUES (1, N'Reminder Invalid Event', '2026-12-31', 999999999)
      `);
    } catch (err) {
      rejected = true;
      assert.ok(err.number === 547, `Expected FK violation (547), got: ${err.message}`);
    }
    assert.equal(rejected, true, 'Non-existent event_id must be rejected');
  });
});

test('4.6: app.calendar_reminders accepts valid reminder with defaults', async () => {
  await withIsolatedTx(async (client) => {
    const res = await client.query(`
      INSERT INTO app.calendar_reminders (user_id, title, deadline_date)
      OUTPUT inserted.reminder_id, inserted.user_id, inserted.title, inserted.is_completed, inserted.created_at
      VALUES (1, N'Hạn nộp hồ sơ thi đua cuối năm 2026', '2026-12-15T17:00:00')
    `);
    assert.equal(res.rows.length, 1);
    assert.ok(res.rows[0].reminder_id);
    assert.equal(res.rows[0].user_id, 1);
    assert.equal(res.rows[0].is_completed, false);
    assert.ok(res.rows[0].created_at);
  });
});

test('4.7: app.calendar_reminders accepts valid reminder with all FK references populated', async () => {
  await withIsolatedTx(async (client) => {
    const reg = await client.query('SELECT TOP 1 document_id FROM app.regulation_documents');
    const period = await client.query('SELECT TOP 1 award_period_id FROM app.award_periods');
    const goal = await client.query('SELECT TOP 1 goal_id FROM app.kpi_goals');

    const res = await client.query(`
      INSERT INTO app.calendar_reminders (user_id, title, deadline_date, regulation_id, award_period_id, kpi_goal_id)
      OUTPUT inserted.reminder_id, inserted.regulation_id, inserted.award_period_id, inserted.kpi_goal_id
      VALUES (1, N'Nhắc nhở nộp KPI & Thi đua đầy đủ', '2026-11-30T17:00:00', @p1, @p2, @p3)
    `, [reg.rows[0].document_id, period.rows[0].award_period_id, goal.rows[0].goal_id]);
    assert.equal(res.rows.length, 1);
    assert.equal(res.rows[0].regulation_id, reg.rows[0].document_id);
    assert.equal(res.rows[0].award_period_id, period.rows[0].award_period_id);
    assert.equal(res.rows[0].kpi_goal_id, goal.rows[0].goal_id);
  });
});

// =========================================================================
// Category 5: Organization hierarchy cycle prevention trigger
// =========================================================================
test('5.1: Direct cycle LHU -> FIT -> LHU rejected by trg_prevent_organization_cycle', async () => {
  await withIsolatedTx(async (client) => {
    const lhu = (await client.query("SELECT unit_id FROM app.organization_units WHERE code = 'LHU'")).rows[0].unit_id;
    const fit = (await client.query("SELECT unit_id FROM app.organization_units WHERE code = 'FIT'")).rows[0].unit_id;

    let rejected = false;
    try {
      await client.query(`
        UPDATE app.organization_units SET parent_id = @p1 WHERE unit_id = @p2
      `, [fit, lhu]);
    } catch (err) {
      rejected = true;
      assert.ok(
        err.number === 51014 || err.message.includes('Organization hierarchy cannot contain a cycle'),
        `Expected cycle error 51014, got error #${err.number}: ${err.message}`
      );
    }
    assert.equal(rejected, true, 'Direct cycle LHU -> FIT -> LHU must be rejected by trigger');
  });
});

test('5.2: Self-cycle LHU -> LHU rejected by trg_prevent_organization_cycle', async () => {
  await withIsolatedTx(async (client) => {
    const lhu = (await client.query("SELECT unit_id FROM app.organization_units WHERE code = 'LHU'")).rows[0].unit_id;

    let rejected = false;
    try {
      await client.query(`
        UPDATE app.organization_units SET parent_id = @p1 WHERE unit_id = @p1
      `, [lhu]);
    } catch (err) {
      rejected = true;
      assert.ok(
        err.number === 51014 || err.message.includes('Organization hierarchy cannot contain a cycle'),
        `Expected cycle error 51014, got error #${err.number}: ${err.message}`
      );
    }
    assert.equal(rejected, true, 'Self cycle LHU -> LHU must be rejected by trigger');
  });
});

test('5.3: Indirect 3-level cycle LHU -> FIT_SE -> FIT -> LHU rejected', async () => {
  await withIsolatedTx(async (client) => {
    const lhu = (await client.query("SELECT unit_id FROM app.organization_units WHERE code = 'LHU'")).rows[0].unit_id;
    const fitSe = (await client.query("SELECT unit_id FROM app.organization_units WHERE code = 'FIT_SE'")).rows[0].unit_id;

    let rejected = false;
    try {
      await client.query(`
        UPDATE app.organization_units SET parent_id = @p1 WHERE unit_id = @p2
      `, [fitSe, lhu]);
    } catch (err) {
      rejected = true;
      assert.ok(
        err.number === 51014 || err.message.includes('Organization hierarchy cannot contain a cycle'),
        `Expected cycle error 51014, got error #${err.number}: ${err.message}`
      );
    }
    assert.equal(rejected, true, '3-level cycle LHU -> FIT_SE -> FIT -> LHU must be rejected');
  });
});

test('5.4: Multi-level cycle involving newly inserted unit rejected', async () => {
  await withIsolatedTx(async (client) => {
    const lhu = (await client.query("SELECT unit_id FROM app.organization_units WHERE code = 'LHU'")).rows[0].unit_id;
    const fitSe = (await client.query("SELECT unit_id FROM app.organization_units WHERE code = 'FIT_SE'")).rows[0].unit_id;

    // Insert unit without OUTPUT clause (avoids SQL Server error 334 on tables with triggers)
    await client.query(`
      INSERT INTO app.organization_units (code, name, parent_id, type, is_active, version)
      VALUES (N'TEMP_CYCLE_LAB', N'Lab Test Cycle', @p1, N'CENTER', 1, 1)
    `, [fitSe]);

    const lab = (await client.query("SELECT unit_id FROM app.organization_units WHERE code = 'TEMP_CYCLE_LAB'")).rows[0].unit_id;

    let rejected = false;
    try {
      await client.query(`
        UPDATE app.organization_units SET parent_id = @p1 WHERE unit_id = @p2
      `, [lab, lhu]);
    } catch (err) {
      rejected = true;
      assert.ok(
        err.number === 51014 || err.message.includes('Organization hierarchy cannot contain a cycle'),
        `Expected cycle error 51014, got error #${err.number}: ${err.message}`
      );
    }
    assert.equal(rejected, true, '4-level cycle LHU -> LAB -> FIT_SE -> FIT -> LHU must be rejected');
  });
});

// =========================================================================
// Category 6: Standard Roles and Compatibility Views
// =========================================================================
test('6.1: 4 standard roles are active and legacy roles are inactive', async () => {
  const roles = await pool.query(`
    SELECT code, is_active FROM app.roles WHERE code IN (
      'MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN',
      'COUNCIL', 'RECORDS_OFFICER', 'UNIT_REPRESENTATIVE', 'MANAGER'
    )
  `);
  const roleMap = new Map(roles.rows.map(r => [r.code, Boolean(r.is_active)]));
  for (const r of ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN']) {
    assert.equal(roleMap.get(r), true, `Role ${r} must be active (is_active = 1)`);
  }
  for (const r of ['COUNCIL', 'RECORDS_OFFICER', 'UNIT_REPRESENTATIVE', 'MANAGER']) {
    assert.equal(roleMap.get(r), false, `Role ${r} must be inactive (is_active = 0)`);
  }
});

test('6.2: app.regulations view returns documents matching app.regulation_documents', async () => {
  const viewRes = await pool.query('SELECT COUNT(*) AS total FROM app.regulations');
  const baseRes = await pool.query('SELECT COUNT(*) AS total FROM app.regulation_documents');
  assert.equal(viewRes.rows[0].total, baseRes.rows[0].total, 'app.regulations view must match app.regulation_documents');
  assert.ok(viewRes.rows[0].total > 0, 'Regulations view must return at least 1 row');
});

test('6.3: app.award_periods.submission_deadline supports DATETIME2 values', async () => {
  await withIsolatedTx(async (client) => {
    const deadline = '2026-11-20T23:59:59.123';
    await client.query(`
      UPDATE app.award_periods SET submission_deadline = @p1 WHERE award_period_id = 1
    `, [deadline]);
    const check = await client.query('SELECT submission_deadline FROM app.award_periods WHERE award_period_id = 1');
    assert.ok(check.rows[0].submission_deadline, 'submission_deadline must be stored');
  });
});

// =========================================================================
// Category 7: Live database cleanliness and integrity post-tests
// =========================================================================
test('7.1: Live database cleanliness and integrity verification', async () => {
  // Confirm LHU root hierarchy intact
  const lhu = await pool.query("SELECT parent_id, type FROM app.organization_units WHERE code = 'LHU'");
  assert.equal(lhu.rows[0].parent_id, null, 'LHU parent_id must remain NULL in live DB');
  assert.equal(lhu.rows[0].type, 'UNIVERSITY', 'LHU type must remain UNIVERSITY');

  const lhuId = (await pool.query("SELECT unit_id FROM app.organization_units WHERE code = 'LHU'")).rows[0].unit_id;
  const faculties = await pool.query("SELECT code, parent_id FROM app.organization_units WHERE code IN ('FIT', 'PHARM')");
  for (const f of faculties.rows) {
    assert.equal(f.parent_id, lhuId, `${f.code} parent must be LHU (${lhuId})`);
  }

  // Confirm baseline 12 achievements remain untouched and all ACTIVE
  const ach = await pool.query("SELECT COUNT(*) AS total, SUM(CASE WHEN status = N'ACTIVE' THEN 1 ELSE 0 END) AS active_cnt FROM app.achievements");
  assert.equal(ach.rows[0].total, 12, 'Live database must contain exactly 12 baseline achievements');
  assert.equal(ach.rows[0].active_cnt, 12, 'All 12 baseline achievements must remain in ACTIVE status');

  // Confirm no leftover test rows in any refactored tables
  const cvTest = await pool.query("SELECT COUNT(*) AS cnt FROM app.cv_profiles WHERE slug LIKE 'challenger%' OR slug LIKE 'duplicate%' OR slug LIKE 'slug-%'");
  assert.equal(cvTest.rows[0].cnt, 0, 'No test CV profiles must remain in database');

  const calTest = await pool.query("SELECT COUNT(*) AS cnt FROM app.calendar_reminders WHERE title LIKE '%Challenge%' OR title LIKE '%Nhắc nhở%' OR title LIKE '%Hạn nộp%'");
  assert.equal(calTest.rows[0].cnt, 0, 'No test reminders must remain in database');

  const goalTest = await pool.query("SELECT COUNT(*) AS cnt FROM app.kpi_goals WHERE code LIKE 'TEST-%' OR code LIKE 'TEMP-%'");
  assert.equal(goalTest.rows[0].cnt, 0, 'No test KPI goals must remain in database');

  const orgTest = await pool.query("SELECT COUNT(*) AS cnt FROM app.organization_units WHERE code LIKE 'TEMP_%'");
  assert.equal(orgTest.rows[0].cnt, 0, 'No test organization units must remain in database');
});
