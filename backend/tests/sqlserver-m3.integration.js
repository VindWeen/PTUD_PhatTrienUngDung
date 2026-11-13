/**
 * Live Microsoft SQL Server Integration Suite for Milestone 3
 * Tests real SQL queries, atomicity, date validation, and repository joins.
 * Uses rollbackFixture to ensure 100% database isolation with zero residue.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { connectDB, closeDB, setPool } from '../src/config/database.js';
import { calendarService, createReminderSchema } from '../src/modules/calendar/calendarService.js';
import * as cvRepository from '../src/modules/cv/cvRepository.js';
import { createCvService } from '../src/modules/cv/cvService.js';
import organizationRepository from '../src/modules/organizations/organizationRepository.js';
import organizationService from '../src/modules/organizations/organizationService.js';
import * as kpiRepo from '../src/modules/kpi/kpiRepository.js';
import { fromAiGapSchema } from '../src/modules/kpi/kpiSchemas.js';

test.after(async () => {
  await closeDB().catch(() => {});
});

async function rollbackFixture(pool, work) {
  const client = await pool.connect();
  await client.query('BEGIN');
  let pending = Promise.resolve();
  const run = (text, params = []) => {
    if (/^(BEGIN|COMMIT|ROLLBACK)(?: TRANSACTION)?$/i.test(text.trim())) {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
    const result = pending.then(() => client.query(text, params)).catch(error => {
      error.integrationSql = text;
      throw error;
    });
    pending = result.catch(() => {});
    return result;
  };
  const sharedClient = { query: run, release: async () => {} };
  const sharedPool = { query: run, ready: async () => sharedPool, connect: async () => sharedClient };
  setPool(sharedPool);
  try {
    return await work(sharedClient);
  } finally {
    await pending;
    await client.query('ROLLBACK');
    await client.release();
    setPool(pool);
  }
}

test('SQL Server: Milestone 3 Live Database Integration (rolled back)', { timeout: 60000 }, async (t) => {
  const pool = await connectDB();

  await t.test('1. CV Module: Live SQL queries and DOCX export', async () => {
    await rollbackFixture(pool, async (client) => {
      // 1.1 Live getUserContact
      const contact = await cvRepository.getUserContact(1, client);
      assert.ok(contact, 'Contact record must exist for user 1');
      assert.ok(contact.full_name, 'Full name must not be empty');
      assert.equal(typeof contact.full_name, 'string');

      // 1.2 Live getUserActiveAchievements
      const achievements = await cvRepository.getUserActiveAchievements(1, null, client);
      assert.ok(Array.isArray(achievements), 'Achievements must return an array');

      // 1.3 End-to-end DOCX export with live repositories
      const service = createCvService(cvRepository);
      const { buffer, filename } = await service.exportCvDocx(1);
      assert.ok(buffer instanceof Buffer);
      assert.ok(filename.endsWith('.docx'));
      assert.equal(buffer.slice(0, 4).toString('hex'), '504b0304', 'Valid OpenXML PK zip header');
    });
  });

  await t.test('2. Unit AI Scan: Live Criteria & RBAC scan', async () => {
    await rollbackFixture(pool, async (client) => {
      // 2.1 Live getRegulationCriteria with c.criterion_code AS code
      const criteria = await organizationRepository.getRegulationCriteria(3, client);
      assert.ok(Array.isArray(criteria), 'Criteria list must be an array');
      if (criteria.length > 0) {
        assert.ok(criteria[0].code, 'Criterion code alias must be populated');
      }

      // 2.2 End-to-end live scanUnitWithAi as ADMIN
      const adminUser = { userId: 1, activeRoles: ['ADMIN'] };
      const result = await organizationService.scanUnitWithAi(1, 3, adminUser);
      assert.ok(result, 'Scan result must be returned');
      assert.equal(result.unitId, 1);
      assert.ok(typeof result.eligibleCount === 'number');
      assert.ok(Array.isArray(result.results));
    });
  });

  await t.test('3. KPI Bridge: Live Subject Auto-Provisioning & Item-Level Validation', async () => {
    await rollbackFixture(pool, async (client) => {
      // 3.1 Item-level inverted date validation in schema
      const invalidPayload = {
        regulationId: 1,
        missingCriteria: [
          { code: 'ISI', name: 'Paper', periodStart: '2026-12-31', periodEnd: '2026-01-01', missingCount: 1 }
        ]
      };
      assert.equal(fromAiGapSchema.safeParse(invalidPayload).success, false, 'Must reject inverted item dates');

      // 3.2 Live auto-provisioning for user without lecturer record
      const uniqueCode = `USR_TEST_${randomUUID().slice(0, 8)}`;
      const newUser = (await client.query(
        `INSERT INTO app.users (username, email, password_hash, display_name)
         OUTPUT INSERTED.user_id
         VALUES ($1, $2, 'hash123', N'Giảng viên Mới Test')`,
        [uniqueCode, `${uniqueCode}@lhu.edu.vn`]
      )).rows[0];

      const lecturer = await kpiRepo.subject(client, newUser.user_id, 'LECTURER');
      assert.ok(lecturer, 'Auto-provisioned lecturer record must be returned');
      assert.equal(Number(lecturer.user_id), Number(newUser.user_id));
    });
  });

  await t.test('4. Calendar: Strict Rollover Prevention & Atomic Transaction Rollback', async () => {
    // 4.1 Strict calendar date validation
    assert.equal(createReminderSchema.safeParse({ title: 'Hạn', deadlineDate: '2026-02-30' }).success, false);
    assert.equal(createReminderSchema.safeParse({ title: 'Hạn', deadlineDate: '2026-02-29' }).success, false);
    assert.equal(createReminderSchema.safeParse({ title: 'Hạn', deadlineDate: '2028-02-29' }).success, true);
    assert.equal(createReminderSchema.safeParse({ title: 'Hạn', deadlineDate: '2026-04-30' }).success, true);
    assert.equal(createReminderSchema.safeParse({ title: 'Hạn', deadlineDate: '2026-04-31' }).success, false);

    // 4.2 Atomicity: failure during reminder insertion rolls back personal_calendar_events
    await rollbackFixture(pool, async (client) => {
      const initialCount = (await client.query(
        'SELECT COUNT(*) AS cnt FROM app.personal_calendar_events WHERE user_id = 1'
      )).rows[0].cnt;

      const failingTxRunner = async (cb) => {
        await client.query('SAVE TRANSACTION test_tx');
        try {
          await cb({
            query: async (sql, params) => {
              if (sql.includes('INSERT INTO app.calendar_reminders')) {
                throw new Error('SIMULATED_TRANSACTION_FAILURE');
              }
              return client.query(sql, params);
            }
          });
        } catch (err) {
          await client.query('ROLLBACK TRANSACTION test_tx');
          throw err;
        }
      };

      const testService = calendarService(client.query.bind(client), failingTxRunner);

      await assert.rejects(
        () => testService.createReminder({ userId: 1 }, { title: 'Test Atomicity', deadlineDate: '2026-12-15' }),
        { message: 'SIMULATED_TRANSACTION_FAILURE' }
      );

      const afterCount = (await client.query(
        'SELECT COUNT(*) AS cnt FROM app.personal_calendar_events WHERE user_id = 1'
      )).rows[0].cnt;

      assert.equal(afterCount, initialCount, 'No orphan personal_calendar_events record must remain');
    });
  });
});
