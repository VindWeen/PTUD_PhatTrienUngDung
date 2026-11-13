import test from 'node:test';
import assert from 'node:assert/strict';
import { createReminderSchema, calendarService } from '../src/modules/calendar/calendarService.js';

test('Calendar Reminder Schema: validates title length, date ranges, and optional foreign keys', () => {
  // Blank title
  assert.equal(
    createReminderSchema.safeParse({ title: '   ', deadlineDate: '2026-12-15' }).success,
    false
  );
  // Invalid date
  assert.equal(
    createReminderSchema.safeParse({ title: 'Hạn nộp hồ sơ', deadlineDate: 'not-a-date' }).success,
    false
  );
  // Date out of bounds (< 1990 or > 2100)
  assert.equal(
    createReminderSchema.safeParse({ title: 'Hạn nộp', deadlineDate: '1850-01-01' }).success,
    false
  );
  // Valid payload with date string
  const validDate = createReminderSchema.safeParse({
    title: 'Hạn nộp hồ sơ NCKH',
    deadlineDate: '2026-12-15',
    regulationId: 10,
  });
  assert.equal(validDate.success, true);
  assert.equal(validDate.data.regulationId, 10);

  // Valid payload with ISO datetime
  const validIso = createReminderSchema.safeParse({
    title: 'Hạn nộp hồ sơ Chiến sĩ thi đua',
    deadlineDate: '2026-11-20T17:00:00Z',
    regulationId: 5,
    awardPeriodId: 2,
    kpiGoalId: 1,
  });
  assert.equal(validIso.success, true);
  assert.equal(validIso.data.awardPeriodId, 2);
});

test('Calendar Reminder: throws NotFoundError when regulationId does not exist', async () => {
  const service = calendarService(async (sql, params) => {
    if (sql.includes('app.regulation_documents')) {
      return { rows: [] }; // regulation not found
    }
    return { rows: [] };
  });

  await assert.rejects(
    async () => {
      await service.createReminder({ userId: 1 }, {
        title: 'Hạn nộp hồ sơ',
        deadlineDate: '2026-12-15',
        regulationId: 9999,
      });
    },
    { name: 'NotFoundError', message: 'Không tìm thấy quy chế' }
  );
});

test('Calendar Reminder: dual insertion into personal_calendar_events and calendar_reminders', async () => {
  const executedQueries = [];
  let capturedEventCategory = null;
  let capturedStartsAt = null;

  const service = calendarService(async (sql, params) => {
    executedQueries.push({ sql, params });

    if (sql.includes('SELECT document_id, title FROM app.regulation_documents')) {
      return { rows: [{ document_id: 10, title: 'Quy chế Khen thưởng' }] };
    }
    if (sql.includes('INSERT INTO app.personal_calendar_events')) {
      capturedEventCategory = 'task'; // category in values
      capturedStartsAt = params[4];
      return {
        rows: [
          {
            id: '201',
            event_id: 201,
            title: params[1],
            startsAt: '2026-12-15T09:00',
            endsAt: '2026-12-15T10:00',
            category: 'task',
          },
        ],
      };
    }
    if (sql.includes('INSERT INTO app.calendar_reminders')) {
      return {
        rows: [
          {
            reminder_id: 'rem-uuid-1234',
            created_at: new Date('2026-11-12T12:00:00Z'),
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await service.createReminder(
    { userId: 1 },
    {
      title: 'Hạn nộp hồ sơ đề nghị khen thưởng cấp cơ sở',
      deadlineDate: '2026-12-15',
      regulationId: 10,
    }
  );

  assert.equal(res.reminderId, 'rem-uuid-1234');
  assert.equal(res.eventId, '201');
  assert.equal(res.title, 'Hạn nộp hồ sơ đề nghị khen thưởng cấp cơ sở');
  assert.equal(res.regulationId, 10);
  assert.equal(capturedEventCategory, 'task');

  // Verify personal_calendar_events insert occurred
  const eventInsert = executedQueries.find(q => q.sql.includes('app.personal_calendar_events'));
  assert.ok(eventInsert);
  assert.equal(eventInsert.params[0], 1); // userId

  // Verify calendar_reminders insert occurred
  const reminderInsert = executedQueries.find(q => q.sql.includes('app.calendar_reminders'));
  assert.ok(reminderInsert);
  assert.equal(reminderInsert.params[0], 1); // userId
  assert.equal(reminderInsert.params[3], 10); // regulationId
  assert.equal(reminderInsert.params[6], '201'); // eventId
});

test('Calendar Reminder: listReminders returns reminders with regulation details', async () => {
  const service = calendarService(async (sql, params) => {
    if (sql.includes('SELECT r.reminder_id AS "reminderId"')) {
      assert.equal(params[0], 5); // filtered by userId
      return {
        rows: [
          {
            reminderId: 'rem-1',
            userId: 5,
            title: 'Hạn nộp hồ sơ Chiến sĩ thi đua',
            deadlineDate: '2026-12-20T17:00:00',
            regulationId: 10,
            regulationTitle: 'Quy chế Thi đua Khen thưởng LHU',
            awardPeriodId: null,
            awardPeriodName: null,
            kpiGoalId: null,
            kpiGoalTitle: null,
            eventId: 301,
            isCompleted: false,
            createdAt: '2026-11-12T10:00:00Z',
          },
        ],
      };
    }
    return { rows: [] };
  });

  const reminders = await service.listReminders({ userId: 5 });
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].reminderId, 'rem-1');
  assert.equal(reminders[0].regulationTitle, 'Quy chế Thi đua Khen thưởng LHU');
  assert.equal(reminders[0].isCompleted, false);
});
