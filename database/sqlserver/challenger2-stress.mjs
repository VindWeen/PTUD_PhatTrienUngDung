import assert from 'node:assert/strict';
import { Pool, getDbPoolConfig } from '../../backend/src/config/database.js';

const pool = new Pool(getDbPoolConfig());
const RUN_ID = `ch2_${Date.now()}`;

console.log('=== Challenger 2: Adversarial Stress Test Suite ===');
console.log(`Test Run ID: ${RUN_ID}\n`);

async function run() {
  let testsPassed = 0;
  let testsFailed = 0;

  function pass(msg) {
    testsPassed++;
    console.log(`  [PASS] ${msg}`);
  }

  function fail(msg, err) {
    testsFailed++;
    console.error(`  [FAIL] ${msg}:`, err?.message || err);
  }

  // Pre-cleanup in case of prior aborted runs
  await pool.query(`
    DELETE FROM app.cv_profiles WHERE slug LIKE 'slug-%' OR slug LIKE 'ch2_%' OR headline LIKE 'T%' OR headline LIKE 'H%';
    DELETE FROM app.calendar_reminders WHERE title LIKE '%Reminder%' OR title LIKE 'T%' OR title LIKE 'ch2_%';
    DELETE FROM app.award_periods WHERE code LIKE 'CHALLENGE_PER_%' OR code LIKE 'CH2_%';
    DELETE FROM app.kpi_goals WHERE code LIKE 'TEST-SRC-%' OR code LIKE 'CH2_%';
    DELETE FROM app.achievements WHERE title LIKE 'Test %' OR title LIKE 'CH2_%';
  `);

  try {
    // ---------------------------------------------------------
    // TEST GROUP 1: Migration Idempotence & Tracking Verification
    // ---------------------------------------------------------
    console.log('--- 1. Testing Schema Migration Tracking & Idempotence ---');

    // 1.1 Verify _schema_migrations record
    const migRecord = await pool.query(`
      SELECT migration_id, name, applied_at, checksum, execution_time_ms
      FROM app._schema_migrations
      WHERE name = N'005_refactor_personal_vault_and_cv.sql'
    `);
    assert.equal(migRecord.rows.length, 1, 'Migration 005 must be registered in app._schema_migrations');
    assert.ok(migRecord.rows[0].checksum, 'Checksum must be populated');
    assert.ok(migRecord.rows[0].applied_at, 'applied_at must be populated');
    pass(`app._schema_migrations entry confirmed: id=${migRecord.rows[0].migration_id}, checksum=${migRecord.rows[0].checksum.substring(0, 12)}..., applied_at=${migRecord.rows[0].applied_at}`);

    // 1.2 Query all migrations in order
    const allMigs = await pool.query(`
      SELECT migration_id, name FROM app._schema_migrations ORDER BY migration_id
    `);
    assert.equal(allMigs.rows.length, 5, 'Must have exactly 5 applied migrations');
    assert.equal(allMigs.rows[4].name, '005_refactor_personal_vault_and_cv.sql');
    pass(`All 5 migrations present in tracking table in sequential order`);

    // ---------------------------------------------------------
    // TEST GROUP 2: Boundary conditions for award_periods.submission_deadline
    // ---------------------------------------------------------
    console.log('\n--- 2. Testing app.award_periods.submission_deadline Boundary & Edge Cases ---');

    // 2.1 Positive tests inside a transaction
    {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // NULL submission_deadline
        const resNull = await client.query(`
          INSERT INTO app.award_periods (code, name, start_date, end_date, status, submission_deadline)
          OUTPUT INSERTED.award_period_id, INSERTED.submission_deadline
          VALUES (@p1, N'Period Null Test', '2026-01-01', '2026-12-31', N'PLANNED', NULL)
        `, [`${RUN_ID}_PER_NULL`]);
        assert.equal(resNull.rows[0].submission_deadline, null, 'NULL submission_deadline must be allowed');
        pass('Inserted award_period with submission_deadline = NULL');

        // Minimum DATETIME2(3) value: '0001-01-01 00:00:00.000'
        const resMin = await client.query(`
          INSERT INTO app.award_periods (code, name, start_date, end_date, status, submission_deadline)
          OUTPUT INSERTED.award_period_id, INSERTED.submission_deadline
          VALUES (@p1, N'Period Min Test', '2026-01-01', '2026-12-31', N'PLANNED', '0001-01-01 00:00:00.000')
        `, [`${RUN_ID}_PER_MIN`]);
        assert.ok(resMin.rows[0].submission_deadline, 'Min DATETIME2 must be accepted');
        pass(`Inserted award_period with min DATETIME2 '0001-01-01 00:00:00.000'`);

        // Maximum DATETIME2(3) value: '9999-12-31 23:59:59.999'
        const resMax = await client.query(`
          INSERT INTO app.award_periods (code, name, start_date, end_date, status, submission_deadline)
          OUTPUT INSERTED.award_period_id, INSERTED.submission_deadline
          VALUES (@p1, N'Period Max Test', '2026-01-01', '2026-12-31', N'PLANNED', '9999-12-31 23:59:59.999')
        `, [`${RUN_ID}_PER_MAX`]);
        assert.ok(resMax.rows[0].submission_deadline, 'Max DATETIME2 must be accepted');
        pass(`Inserted award_period with max DATETIME2 '9999-12-31 23:59:59.999'`);

        // Fractional precision: preserve 3 millisecond digits
        const testPrecisionDate = '2026-11-12 13:45:30.123';
        const resPrec = await client.query(`
          INSERT INTO app.award_periods (code, name, start_date, end_date, status, submission_deadline)
          OUTPUT INSERTED.award_period_id, CONVERT(VARCHAR(30), INSERTED.submission_deadline, 121) AS str_val
          VALUES (@p1, N'Period Precision Test', '2026-01-01', '2026-12-31', N'PLANNED', @p2)
        `, [`${RUN_ID}_PER_PREC`, testPrecisionDate]);
        assert.equal(resPrec.rows[0].str_val, testPrecisionDate, 'DATETIME2(3) must preserve exact millisecond value');
        pass(`Inserted award_period preserving exact millisecond precision: ${resPrec.rows[0].str_val}`);

        // Sub-millisecond rounding (.1238 -> .124)
        const resSubMilli = await client.query(`
          INSERT INTO app.award_periods (code, name, start_date, end_date, status, submission_deadline)
          OUTPUT INSERTED.award_period_id, CONVERT(VARCHAR(30), INSERTED.submission_deadline, 121) AS str_val
          VALUES (@p1, N'Period Rounding Test', '2026-01-01', '2026-12-31', N'PLANNED', '2026-11-12 13:45:30.1238')
        `, [`${RUN_ID}_PER_ROUND`]);
        assert.equal(resSubMilli.rows[0].str_val, '2026-11-12 13:45:30.124');
        pass(`Sub-millisecond rounding behavior verified: '...30.1238' correctly rounded to '...30.124'`);

        await client.query('ROLLBACK');
        pass('award_periods positive test transaction rolled back cleanly');
      } finally {
        await client.release();
      }
    }

    // 2.2 Negative test: invalid date string
    {
      let invalidDateCaught = false;
      try {
        await pool.query(`
          INSERT INTO app.award_periods (code, name, start_date, end_date, status, submission_deadline)
          VALUES (@p1, N'Period Invalid Test', '2026-01-01', '2026-12-31', N'PLANNED', 'not-a-valid-date')
        `, [`${RUN_ID}_PER_INV`]);
      } catch {
        invalidDateCaught = true;
      }
      assert.equal(invalidDateCaught, true, 'Invalid date string must throw conversion error');
      pass('Invalid date string rejected with conversion error');
    }

    // ---------------------------------------------------------
    // TEST GROUP 3: app.cv_profiles stress & edge cases
    // ---------------------------------------------------------
    console.log('\n--- 3. Testing app.cv_profiles Columns, Limits & Unicode ---');

    const userRes = await pool.query('SELECT TOP 1 user_id FROM app.users ORDER BY user_id');
    assert.ok(userRes.rows.length > 0, 'Must have at least one user');
    const testUserId = userRes.rows[0].user_id;

    // 3.1 Positive tests inside transaction
    {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 100-character slug (max allowed)
        const slug100 = `${RUN_ID}_` + 'a'.repeat(100 - RUN_ID.length - 1);
        const resSlug100 = await client.query(`
          INSERT INTO app.cv_profiles (user_id, slug, is_public, template_id)
          OUTPUT INSERTED.profile_id, INSERTED.slug
          VALUES (@p1, @p2, 1, N'modern')
        `, [testUserId, slug100]);
        assert.equal(resSlug100.rows[0].slug.length, 100, 'Slug of 100 chars must succeed');
        pass(`Inserted cv_profile with 100-character slug (length=${resSlug100.rows[0].slug.length})`);

        // 255-character headline (max allowed)
        const headline255 = 'T'.repeat(255);
        const resHeadline255 = await client.query(`
          INSERT INTO app.cv_profiles (user_id, slug, headline, is_public)
          OUTPUT INSERTED.profile_id, INSERTED.headline
          VALUES (@p1, @p2, @p3, 0)
        `, [testUserId, `${RUN_ID}_hl255`, headline255]);
        assert.equal(resHeadline255.rows[0].headline.length, 255, 'Headline of 255 chars must succeed');
        pass(`Inserted cv_profile with 255-character headline (length=${resHeadline255.rows[0].headline.length})`);

        // Unicode in bio (Vietnamese diacritics, symbols, emojis)
        const complexUnicodeBio = `
          Tiến sĩ - Giảng viên cao cấp Khoa Công nghệ Thông tin 🎓
          Trường Đại học Lạc Hồng (LHU) - Đồng Nai, Việt Nam 🇻🇳
          Thành tích: Giải Nhất Hội thi Sáng tạo Kỹ thuật Toàn quốc 🏆
          Nghiên cứu: Trí tuệ nhân tạo (AI), Học máy (Machine Learning) & Thị giác máy tính 🤖
          Châm ngôn: "Học tập suốt đời, cống hiến vì cộng đồng" ✨ 🌟 🚀
          Ký tự đặc biệt: © ® ™ § ¶ † ‡ • … ‰ ₹ € ¥ £
        `.trim();
        const resUnicode = await client.query(`
          INSERT INTO app.cv_profiles (user_id, slug, bio, is_public)
          OUTPUT INSERTED.profile_id, INSERTED.bio
          VALUES (@p1, @p2, @p3, 1)
        `, [testUserId, `${RUN_ID}_bio_unicode`, complexUnicodeBio]);
        assert.equal(resUnicode.rows[0].bio, complexUnicodeBio, 'Bio unicode string must match identically without corruption');
        pass('Inserted cv_profile with complex Unicode bio (Vietnamese diacritics, emojis, symbols preserved identically)');

        // Large JSON in selected_achievement_ids (NVARCHAR(MAX))
        const achievementItems = [];
        for (let i = 1; i <= 2500; i++) {
          achievementItems.push({
            id: i,
            title: `Thành tích nghiên cứu khoa học cấp quốc tế số ${i}`,
            category: 'SCIENTIFIC_RESEARCH',
            year: 2020 + (i % 7),
            verified: true,
            metadata: {
              doi: `10.1000/xyz.${i}`,
              citations: i * 3,
              tags: ['AI', 'Computer Vision', 'Deep Learning', 'Big Data']
            }
          });
        }
        const largeJsonStr = JSON.stringify(achievementItems);
        const jsonByteLength = Buffer.byteLength(largeJsonStr, 'utf8');
        const jsonCharLength = largeJsonStr.length;

        const resJson = await client.query(`
          INSERT INTO app.cv_profiles (user_id, slug, selected_achievement_ids, is_public)
          OUTPUT INSERTED.profile_id, LEN(INSERTED.selected_achievement_ids) AS stored_char_len
          VALUES (@p1, @p2, @p3, 1)
        `, [testUserId, `${RUN_ID}_large_json`, largeJsonStr]);
        assert.equal(resJson.rows[0].stored_char_len, jsonCharLength, 'NVARCHAR(MAX) must store full large JSON without truncation');

        // Read back and verify round-trip parsing
        const readBackJson = await client.query(`
          SELECT selected_achievement_ids FROM app.cv_profiles WHERE profile_id = @p1
        `, [resJson.rows[0].profile_id]);
        const parsed = JSON.parse(readBackJson.rows[0].selected_achievement_ids);
        assert.equal(parsed.length, 2500, 'Parsed JSON must contain all 2500 elements');
        assert.equal(parsed[2499].id, 2500);
        pass(`Large JSON round-trip verified: ${(jsonByteLength / 1024).toFixed(1)} KB (${jsonCharLength} chars, 2500 objects) parsed intact`);

        // Multiple NULL slugs allowed
        await client.query(`
          INSERT INTO app.cv_profiles (user_id, slug, is_public) VALUES (@p1, NULL, 0);
          INSERT INTO app.cv_profiles (user_id, slug, is_public) VALUES (@p1, NULL, 0);
        `, [testUserId]);
        pass('Multiple profiles with slug = NULL inserted successfully without collision');

        // Default values verification
        const resDefaults = await client.query(`
          INSERT INTO app.cv_profiles (user_id)
          OUTPUT INSERTED.is_public, INSERTED.template_id, INSERTED.version, INSERTED.profile_id
          VALUES (@p1)
        `, [testUserId]);
        assert.equal(resDefaults.rows[0].is_public, false, 'Default is_public must be 0 (false)');
        assert.equal(resDefaults.rows[0].template_id, 'standard', 'Default template_id must be standard');
        assert.equal(resDefaults.rows[0].version, 1, 'Default version must be 1');
        assert.ok(resDefaults.rows[0].profile_id, 'profile_id must be auto-generated NEWID()');
        pass('cv_profiles defaults verified (is_public=0, template_id=standard, version=1, NEWID() generated)');

        await client.query('ROLLBACK');
        pass('cv_profiles positive test transaction rolled back cleanly');
      } finally {
        await client.release();
      }
    }

    // 3.2 Negative tests for cv_profiles
    // Slug 101 characters (should fail due to NVARCHAR(100))
    {
      const slug101 = 'b'.repeat(101);
      let slug101Failed = false;
      try {
        await pool.query(`
          INSERT INTO app.cv_profiles (user_id, slug, is_public, template_id)
          VALUES (@p1, @p2, 1, N'modern')
        `, [testUserId, slug101]);
      } catch {
        slug101Failed = true;
      }
      assert.equal(slug101Failed, true, 'Slug with 101 chars must fail due to NVARCHAR(100) limit');
      pass('Slug with 101 characters rejected (NVARCHAR(100) boundary enforced)');
    }

    // Headline 256 characters (should fail due to NVARCHAR(255))
    {
      const headline256 = 'T'.repeat(256);
      let headline256Failed = false;
      try {
        await pool.query(`
          INSERT INTO app.cv_profiles (user_id, slug, headline, is_public)
          VALUES (@p1, @p2, @p3, 0)
        `, [testUserId, `${RUN_ID}_hl256`, headline256]);
      } catch {
        headline256Failed = true;
      }
      assert.equal(headline256Failed, true, 'Headline of 256 chars must fail due to NVARCHAR(255) limit');
      pass('Headline with 256 characters rejected (NVARCHAR(255) boundary enforced)');
    }

    // Duplicate non-null slug rejection
    {
      const testSlug = `${RUN_ID}_dup_slug`;
      await pool.query(`
        INSERT INTO app.cv_profiles (user_id, slug, is_public) VALUES (@p1, @p2, 1)
      `, [testUserId, testSlug]);

      let duplicateCaught = false;
      try {
        await pool.query(`
          INSERT INTO app.cv_profiles (user_id, slug, is_public) VALUES (@p1, @p2, 0)
        `, [testUserId, testSlug]);
      } catch {
        duplicateCaught = true;
      }
      assert.equal(duplicateCaught, true, 'Duplicate non-null slug must fail unique index');
      pass('Duplicate non-null slug rejected by filtered unique index uq_cv_profiles_slug');

      await pool.query('DELETE FROM app.cv_profiles WHERE slug = @p1', [testSlug]);
    }

    // Non-existent user_id FK violation
    {
      let invalidUserCaught = false;
      try {
        await pool.query(`
          INSERT INTO app.cv_profiles (user_id, slug) VALUES (-999999, @p1)
        `, [`${RUN_ID}_inv_user`]);
      } catch {
        invalidUserCaught = true;
      }
      assert.equal(invalidUserCaught, true, 'Non-existent user_id must fail FK constraint');
      pass('Non-existent user_id rejected by fk_cv_profiles_user constraint');
    }

    // ---------------------------------------------------------
    // TEST GROUP 4: app.calendar_reminders foreign key permutations
    // ---------------------------------------------------------
    console.log('\n--- 4. Testing app.calendar_reminders Foreign Key Permutations ---');

    const validUser = (await pool.query('SELECT TOP 1 user_id FROM app.users ORDER BY user_id')).rows[0]?.user_id;
    const validPeriod = (await pool.query('SELECT TOP 1 award_period_id FROM app.award_periods ORDER BY award_period_id')).rows[0]?.award_period_id;
    const validReg = (await pool.query('SELECT TOP 1 document_id FROM app.regulation_documents ORDER BY document_id')).rows[0]?.document_id;
    const validKpiGoal = (await pool.query('SELECT TOP 1 goal_id FROM app.kpi_goals ORDER BY goal_id')).rows[0]?.goal_id;
    const validEvent = (await pool.query('SELECT TOP 1 event_id FROM app.personal_calendar_events ORDER BY event_id')).rows[0]?.event_id;

    pass(`Discovered valid entity IDs: user=${validUser}, period=${validPeriod}, reg=${validReg}, kpi=${validKpiGoal}, event=${validEvent}`);

    // 4.1 Positive tests inside transaction
    {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Permutation 1: All FKs NULL except user_id
        const resPerm1 = await client.query(`
          INSERT INTO app.calendar_reminders (user_id, title, deadline_date, regulation_id, award_period_id, kpi_goal_id, event_id)
          OUTPUT INSERTED.reminder_id, INSERTED.is_completed, INSERTED.created_at
          VALUES (@p1, @p2, '2026-12-31 23:59:59', NULL, NULL, NULL, NULL)
        `, [validUser, `${RUN_ID} All FKs NULL`]);
        assert.ok(resPerm1.rows[0].reminder_id, 'Reminder must be inserted');
        assert.equal(resPerm1.rows[0].is_completed, false, 'Default is_completed must be 0');
        assert.ok(resPerm1.rows[0].created_at, 'Default created_at must be populated');
        pass('Permutation 1: Reminder with all optional FKs = NULL inserted successfully (defaults verified)');

        // Permutation 2: Only regulation_id populated
        if (validReg) {
          await client.query(`
            INSERT INTO app.calendar_reminders (user_id, title, deadline_date, regulation_id)
            VALUES (@p1, @p2, '2026-12-31 23:59:59', @p3)
          `, [validUser, `${RUN_ID} reg only`, validReg]);
          pass('Permutation 2: Reminder with only regulation_id populated succeeded');
        }

        // Permutation 3: Only award_period_id populated
        if (validPeriod) {
          await client.query(`
            INSERT INTO app.calendar_reminders (user_id, title, deadline_date, award_period_id)
            VALUES (@p1, @p2, '2026-12-31 23:59:59', @p3)
          `, [validUser, `${RUN_ID} period only`, validPeriod]);
          pass('Permutation 3: Reminder with only award_period_id populated succeeded');
        }

        // Permutation 4: Only kpi_goal_id populated
        if (validKpiGoal) {
          await client.query(`
            INSERT INTO app.calendar_reminders (user_id, title, deadline_date, kpi_goal_id)
            VALUES (@p1, @p2, '2026-12-31 23:59:59', @p3)
          `, [validUser, `${RUN_ID} kpi only`, validKpiGoal]);
          pass('Permutation 4: Reminder with only kpi_goal_id populated succeeded');
        }

        // Permutation 5: Only event_id populated
        if (validEvent) {
          await client.query(`
            INSERT INTO app.calendar_reminders (user_id, title, deadline_date, event_id)
            VALUES (@p1, @p2, '2026-12-31 23:59:59', @p3)
          `, [validUser, `${RUN_ID} event only`, validEvent]);
          pass('Permutation 5: Reminder with only event_id populated succeeded');
        }

        // Permutation 6: All FKs populated together
        await client.query(`
          INSERT INTO app.calendar_reminders (user_id, title, deadline_date, regulation_id, award_period_id, kpi_goal_id, event_id)
          OUTPUT INSERTED.reminder_id
          VALUES (@p1, @p2, '2026-12-31 23:59:59', @p3, @p4, @p5, @p6)
        `, [validUser, `${RUN_ID} all FKs`, validReg ?? null, validPeriod ?? null, validKpiGoal ?? null, validEvent ?? null]);
        pass('Permutation 6: Reminder with all FKs populated together succeeded');

        // Permutation 13a: Title exactly 255 chars
        const title255 = 'T'.repeat(255);
        await client.query(`
          INSERT INTO app.calendar_reminders (user_id, title, deadline_date)
          VALUES (@p1, @p2, '2026-12-31 23:59:59')
        `, [validUser, title255]);
        pass('Permutation 13a: Title of exactly 255 chars succeeded');

        await client.query('ROLLBACK');
        pass('calendar_reminders positive test transaction rolled back cleanly');
      } finally {
        await client.release();
      }
    }

    // 4.2 Negative tests for calendar_reminders
    // Non-existent user_id
    {
      let invalidUserCaught = false;
      try {
        await pool.query(`
          INSERT INTO app.calendar_reminders (user_id, title, deadline_date)
          VALUES (-999999, @p1, '2026-12-31 23:59:59')
        `, [`${RUN_ID} inv user`]);
      } catch {
        invalidUserCaught = true;
      }
      assert.equal(invalidUserCaught, true, 'Non-existent user_id must trigger FK violation');
      pass('Permutation 7: Non-existent user_id rejected by fk_calendar_reminders_user');
    }

    // Non-existent regulation_id
    {
      let invalidRegCaught = false;
      try {
        await pool.query(`
          INSERT INTO app.calendar_reminders (user_id, title, deadline_date, regulation_id)
          VALUES (@p1, @p2, '2026-12-31 23:59:59', -999999)
        `, [validUser, `${RUN_ID} inv reg`]);
      } catch {
        invalidRegCaught = true;
      }
      assert.equal(invalidRegCaught, true, 'Non-existent regulation_id must trigger FK violation');
      pass('Permutation 8: Non-existent regulation_id rejected by fk_calendar_reminders_regulation');
    }

    // Non-existent award_period_id
    {
      let invalidPeriodCaught = false;
      try {
        await pool.query(`
          INSERT INTO app.calendar_reminders (user_id, title, deadline_date, award_period_id)
          VALUES (@p1, @p2, '2026-12-31 23:59:59', -999999)
        `, [validUser, `${RUN_ID} inv period`]);
      } catch {
        invalidPeriodCaught = true;
      }
      assert.equal(invalidPeriodCaught, true, 'Non-existent award_period_id must trigger FK violation');
      pass('Permutation 9: Non-existent award_period_id rejected by fk_calendar_reminders_award_period');
    }

    // Non-existent kpi_goal_id
    {
      let invalidKpiCaught = false;
      try {
        await pool.query(`
          INSERT INTO app.calendar_reminders (user_id, title, deadline_date, kpi_goal_id)
          VALUES (@p1, @p2, '2026-12-31 23:59:59', -999999)
        `, [validUser, `${RUN_ID} inv kpi`]);
      } catch {
        invalidKpiCaught = true;
      }
      assert.equal(invalidKpiCaught, true, 'Non-existent kpi_goal_id must trigger FK violation');
      pass('Permutation 10: Non-existent kpi_goal_id rejected by fk_calendar_reminders_kpi_goal');
    }

    // Non-existent event_id
    {
      let invalidEventCaught = false;
      try {
        await pool.query(`
          INSERT INTO app.calendar_reminders (user_id, title, deadline_date, event_id)
          VALUES (@p1, @p2, '2026-12-31 23:59:59', -999999)
        `, [validUser, `${RUN_ID} inv event`]);
      } catch {
        invalidEventCaught = true;
      }
      assert.equal(invalidEventCaught, true, 'Non-existent event_id must trigger FK violation');
      pass('Permutation 11: Non-existent event_id rejected by fk_calendar_reminders_event');
    }

    // NULL title
    {
      let nullTitleCaught = false;
      try {
        await pool.query(`
          INSERT INTO app.calendar_reminders (user_id, title, deadline_date)
          VALUES (@p1, NULL, '2026-12-31 23:59:59')
        `, [validUser]);
      } catch {
        nullTitleCaught = true;
      }
      assert.equal(nullTitleCaught, true, 'NULL title must be rejected');
      pass('Permutation 12: NULL title rejected by column NOT NULL constraint');
    }

    // Title 256 chars
    {
      let title256Caught = false;
      try {
        await pool.query(`
          INSERT INTO app.calendar_reminders (user_id, title, deadline_date)
          VALUES (@p1, @p2, '2026-12-31 23:59:59')
        `, [validUser, 'T'.repeat(256)]);
      } catch {
        title256Caught = true;
      }
      assert.equal(title256Caught, true, 'Title of 256 chars must be rejected');
      pass('Permutation 13b: Title of 256 chars rejected by NVARCHAR(255) boundary');
    }

    // ---------------------------------------------------------
    // TEST GROUP 5: Role Configuration & Active Role Business Rules
    // ---------------------------------------------------------
    console.log('\n--- 5. Testing Roles & Inactive Role Business Rules ---');

    // 5.1 Check all active roles
    const activeRolesRes = await pool.query(`
      SELECT role_id, code, name, is_active
      FROM app.roles
      WHERE is_active = 1
      ORDER BY code
    `);
    const activeCodes = activeRolesRes.rows.map(r => r.code);
    pass(`Active roles count=${activeCodes.length}: [${activeCodes.join(', ')}]`);
    for (const expected of ['MEMBER', 'DEPARTMENT_HEAD', 'FACULTY_LEAD', 'ADMIN']) {
      assert.ok(activeCodes.includes(expected), `Role ${expected} must be active`);
    }
    pass('All 4 standard roles verified active (is_active = 1)');

    // 5.2 Check legacy inactive roles
    const inactiveRolesRes = await pool.query(`
      SELECT role_id, code, name, is_active
      FROM app.roles
      WHERE is_active = 0
      ORDER BY code
    `);
    const inactiveCodes = inactiveRolesRes.rows.map(r => r.code);
    pass(`Inactive roles count=${inactiveCodes.length}: [${inactiveCodes.join(', ')}]`);
    for (const expected of ['COUNCIL', 'RECORDS_OFFICER', 'UNIT_REPRESENTATIVE', 'MANAGER']) {
      assert.ok(inactiveCodes.includes(expected), `Legacy role ${expected} must be inactive`);
    }
    pass('All 4 legacy roles verified inactive (is_active = 0)');

    // 5.3 Business rule verification: active role query filter
    const selectableRoles = await pool.query(`
      SELECT code FROM app.roles WHERE is_active = 1
    `);
    const selectableSet = new Set(selectableRoles.rows.map(r => r.code));
    for (const legacy of ['COUNCIL', 'RECORDS_OFFICER', 'UNIT_REPRESENTATIVE', 'MANAGER']) {
      assert.ok(!selectableSet.has(legacy), `Inactive role ${legacy} must NOT appear in active role list`);
    }
    pass('Business rule verified: Inactive roles cannot be selected by active role queries');

    // ---------------------------------------------------------
    // TEST GROUP 6: app.achievements immediate ACTIVE status & constraints
    // ---------------------------------------------------------
    console.log('\n--- 6. Testing app.achievements Immediate ACTIVE & Check Constraints ---');

    const validUnit = (await pool.query('SELECT TOP 1 unit_id FROM app.organization_units WHERE parent_id IS NOT NULL')).rows[0]?.unit_id;

    // 6.1 Positive tests inside transaction
    {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Insert without status -> must default to 'ACTIVE'
        const resAchDefault = await client.query(`
          INSERT INTO app.achievements (lecturer_id, context_unit_id, title, achievement_date)
          OUTPUT INSERTED.achievement_id, INSERTED.status
          VALUES (@p1, @p2, @p3, '2026-05-15')
        `, [validUser, validUnit, `${RUN_ID} Immediate Active`]);
        assert.equal(resAchDefault.rows[0].status, 'ACTIVE', 'Default status must be ACTIVE');
        pass('Newly inserted achievement without status defaults to ACTIVE immediately');

        // Insert with explicit 'ACTIVE' status
        const resAchExplicit = await client.query(`
          INSERT INTO app.achievements (lecturer_id, context_unit_id, title, achievement_date, status)
          OUTPUT INSERTED.achievement_id, INSERTED.status
          VALUES (@p1, @p2, @p3, '2026-05-15', N'ACTIVE')
        `, [validUser, validUnit, `${RUN_ID} Explicit Active`]);
        assert.equal(resAchExplicit.rows[0].status, 'ACTIVE');
        pass('Achievement with explicit status = ACTIVE accepted');

        // Insert with historical statuses (APPROVED, VERIFIED, DRAFT, SUBMITTED, REJECTED)
        for (const st of ['APPROVED', 'VERIFIED', 'DRAFT', 'SUBMITTED', 'REJECTED']) {
          await client.query(`
            INSERT INTO app.achievements (lecturer_id, context_unit_id, title, achievement_date, status)
            VALUES (@p1, @p2, @p3, '2026-05-15', @p4)
          `, [validUser, validUnit, `${RUN_ID} Status ${st}`, st]);
        }
        pass('Historical statuses (APPROVED, VERIFIED, DRAFT, SUBMITTED, REJECTED) permitted by constraint');

        await client.query('ROLLBACK');
        pass('achievements positive test transaction rolled back cleanly');
      } finally {
        await client.release();
      }
    }

    // 6.2 Negative test: invalid achievement status
    {
      let invalidStatusCaught = false;
      try {
        await pool.query(`
          INSERT INTO app.achievements (lecturer_id, context_unit_id, title, achievement_date, status)
          VALUES (@p1, @p2, @p3, '2026-05-15', N'BOGUS_STATUS')
        `, [validUser, validUnit, `${RUN_ID} Invalid Status`]);
      } catch {
        invalidStatusCaught = true;
      }
      assert.equal(invalidStatusCaught, true, 'Invalid achievement status must be rejected');
      pass('Invalid achievement status rejected by ck_achievements_status constraint');
    }

    // ---------------------------------------------------------
    // TEST GROUP 7: app.kpi_goals & app.kpi_results source constraints
    // ---------------------------------------------------------
    console.log('\n--- 7. Testing KPI Source Constraints (AI_GAP, AI_GAP_ANALYSIS, SYSTEM) ---');

    // 7.1 Positive tests inside transaction
    {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        for (const src of ['AI_GAP', 'AI_GAP_ANALYSIS', 'SYSTEM', 'MANUAL', 'CSV']) {
          const goalCode = `${RUN_ID}_${src}`;
          await client.query(`
            INSERT INTO app.kpi_goals (lecturer_id, context_unit_id, code, title, measure_unit, period_start, period_end, target, source, source_note, created_by)
            VALUES (@p1, @p2, @p3, @p4, N'tiêu chí', '2026-01-01', '2026-12-31', 1.0, @p5, N'Test note', @p1)
          `, [validUser, validUnit, goalCode, `Goal source ${src}`, src]);
        }
        pass('All allowed KPI sources (AI_GAP, AI_GAP_ANALYSIS, SYSTEM, MANUAL, CSV) inserted successfully');

        await client.query('ROLLBACK');
        pass('KPI sources positive test transaction rolled back cleanly');
      } finally {
        await client.release();
      }
    }

    // 7.2 Negative test: invalid KPI source
    {
      let invalidKpiSrcCaught = false;
      try {
        await pool.query(`
          INSERT INTO app.kpi_goals (lecturer_id, context_unit_id, code, title, measure_unit, period_start, period_end, target, source, source_note, created_by)
          VALUES (@p1, @p2, @p3, N'Goal Invalid Source', N'tiêu chí', '2026-01-01', '2026-12-31', 1.0, N'INVALID_SRC', N'Test note', @p1)
        `, [validUser, validUnit, `${RUN_ID}_INV_SRC`]);
      } catch {
        invalidKpiSrcCaught = true;
      }
      assert.equal(invalidKpiSrcCaught, true, 'Invalid KPI source must be rejected');
      pass('Invalid KPI source rejected by ck_kpi_goals_source constraint');
    }

    // ---------------------------------------------------------
    // TEST GROUP 8: Final DB Clean State Verification
    // ---------------------------------------------------------
    console.log('\n--- 8. Verifying DB Clean State (Zero Residual Artifacts) ---');

    // Clean up any remaining records from this or previous test runs
    await pool.query(`
      DELETE FROM app.cv_profiles WHERE slug LIKE 'slug-%' OR slug LIKE 'ch2_%' OR headline LIKE 'T%' OR headline LIKE 'H%';
      DELETE FROM app.calendar_reminders WHERE title LIKE '%Reminder%' OR title LIKE 'T%' OR title LIKE 'ch2_%';
      DELETE FROM app.award_periods WHERE code LIKE 'CHALLENGE_PER_%' OR code LIKE 'CH2_%';
      DELETE FROM app.kpi_goals WHERE code LIKE 'TEST-SRC-%' OR code LIKE 'CH2_%';
      DELETE FROM app.achievements WHERE title LIKE 'Test %' OR title LIKE 'CH2_%';
    `);

    const lingeringCv = await pool.query("SELECT COUNT(*) AS c FROM app.cv_profiles WHERE slug LIKE 'ch2_%' OR slug LIKE 'slug-%'");
    assert.equal(lingeringCv.rows[0].c, 0, 'No lingering CV test profiles should exist');

    const lingeringReminders = await pool.query("SELECT COUNT(*) AS c FROM app.calendar_reminders WHERE title LIKE 'ch2_%' OR title LIKE '%Reminder%'");
    assert.equal(lingeringReminders.rows[0].c, 0, 'No lingering reminder test records should exist');

    const lingeringPeriods = await pool.query("SELECT COUNT(*) AS c FROM app.award_periods WHERE code LIKE 'CH2_%' OR code LIKE 'CHALLENGE_PER_%'");
    assert.equal(lingeringPeriods.rows[0].c, 0, 'No lingering award period test records should exist');

    const lingeringGoals = await pool.query("SELECT COUNT(*) AS c FROM app.kpi_goals WHERE code LIKE 'CH2_%' OR code LIKE 'TEST-SRC-%'");
    assert.equal(lingeringGoals.rows[0].c, 0, 'No lingering KPI goal test records should exist');

    pass('Database clean state confirmed: 0 test rows persisted.');

  } catch (err) {
    fail('Unexpected exception during adversarial stress tests', err);
    throw err;
  } finally {
    await pool.end();
  }

  console.log(`\n======================================================`);
  console.log(`CHALLENGER 2 TESTS SUMMARY: ${testsPassed} passed, ${testsFailed} failed (100% SUCCESS)`);
  console.log(`======================================================\n`);
}

run().catch(err => {
  console.error('Fatal stress test runner failure:', err);
  process.exit(1);
});
