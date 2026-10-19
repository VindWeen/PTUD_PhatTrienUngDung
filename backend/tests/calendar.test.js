import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEventSchema } from '../src/modules/calendar/calendarService.js';
import { monthCells, shiftMonth, onDay } from '../../frontend/src/components/calendar/calendarModel.js';

const event = { title: 'Lịch thi', category: 'exam', startsAt: '2028-02-29T09:00', endsAt: '2028-02-29T10:00', allDay: false };
test('reject impossible dates, inverted ranges, blank titles and forged ownership/system events', () => {
  assert.equal(createEventSchema.safeParse(event).success, true);
  for (const changes of [
    { startsAt: '2027-02-29T09:00' }, { startsAt: '2028-02-30T09:00' },
    { endsAt: '2028-02-29T08:59' }, { title: '   ' },
    { userId: 99 }, { category: 'system' }, { readOnly: false },
    { allDay: true }, { startsAt: '2028-02-29T25:00' },
  ]) assert.equal(createEventSchema.safeParse({ ...event, ...changes }).success, false, JSON.stringify(changes));
});
test('all-day and multiday events include both boundary dates', () => {
  const range = { ...event, startsAt: '2028-02-29T00:00', endsAt: '2028-03-02T00:00', allDay: true };
  assert.equal(createEventSchema.safeParse(range).success, true);
  assert.equal(onDay(range, '2028-02-28'), false);
  assert.equal(onDay(range, '2028-02-29'), true);
  assert.equal(onDay(range, '2028-03-02'), true);
  assert.equal(onDay(range, '2028-03-03'), false);
});
test('month navigation handles year rollover, leap years and Monday-first grids', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2027-01', -1), '2026-12');
  assert.equal(monthCells('2028-02').includes('2028-02-29'), true);
  assert.equal(monthCells('2027-02').includes('2027-02-29'), false);
  assert.equal(monthCells('2026-10')[0], '2026-09-28');
  assert.equal(monthCells('2026-10').length, 42);
});
