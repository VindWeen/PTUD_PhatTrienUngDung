import test from 'node:test';
import assert from 'node:assert/strict';
import { intersectsDay, localInput, sameDay, startOfDay } from '../src/components/calendar/calendarDates.js';

const instant = (...parts) => new Date(...parts).toISOString();
test('a multi-day event marks every intersecting day but excludes its midnight endpoint', () => {
  const event = { startsAt: instant(2026, 10, 15, 21), endsAt: instant(2026, 10, 18, 0) };
  assert.equal(intersectsDay(event, new Date(2026, 10, 14)), false);
  for (const day of [15, 16, 17]) assert.equal(intersectsDay(event, new Date(2026, 10, day)), true);
  assert.equal(intersectsDay(event, new Date(2026, 10, 18)), false);
});
test('calendar intersections work across a month and year boundary', () => {
  const event = { startsAt: instant(2026, 11, 31, 23, 30), endsAt: instant(2027, 0, 1, 0, 30) };
  assert.equal(intersectsDay(event, new Date(2026, 11, 31)), true);
  assert.equal(intersectsDay(event, new Date(2027, 0, 1)), true);
  assert.equal(intersectsDay(event, new Date(2027, 0, 2)), false);
});
test('datetime input values preserve local wall-clock time through ISO storage', () => {
  const local = new Date(2026, 10, 15, 8, 5);
  assert.equal(localInput(new Date(local.toISOString())), '2026-11-15T08:05');
  assert.equal(new Date(localInput(local)).getTime(), local.getTime());
});
test('day comparison includes the year and startOfDay does not mutate its argument', () => {
  const source = new Date(2026, 10, 15, 18, 30);
  const start = startOfDay(source);
  assert.equal(source.getHours(), 18);
  assert.equal(start.getHours(), 0);
  assert.equal(sameDay(start, source), true);
  assert.equal(sameDay(source, new Date(2027, 10, 15)), false);
});
