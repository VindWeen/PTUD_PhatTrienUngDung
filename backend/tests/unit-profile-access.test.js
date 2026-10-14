import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadUnitProfile } from '../src/middlewares/requireUnitRead.js';

test('admin can read profiles without a unit assignment; lecturer cannot', async () => {
  const unexpectedScopeLookup = async () => { throw new Error('Unexpected scope lookup'); };
  assert.equal(await canReadUnitProfile(1, 10, ['ADMIN'], unexpectedScopeLookup), true);
  assert.equal(await canReadUnitProfile(1, 10, ['LECTURER'], unexpectedScopeLookup), false);
});

test('profile access requires a current assignment for an eligible role and target unit', async () => {
  let active = true;
  const inScope = async (userId, unitId, role) => active && userId === 1 && unitId === 10 && role === 'MANAGER';
  assert.equal(await canReadUnitProfile(1, 10, ['MANAGER'], inScope), true);
  assert.equal(await canReadUnitProfile(1, 11, ['MANAGER'], inScope), false);
  assert.equal(await canReadUnitProfile(1, 10, ['RECORDS_OFFICER'], inScope), false);
  active = false;
  assert.equal(await canReadUnitProfile(1, 10, ['MANAGER'], inScope), false);
});

test('multiple roles still allow access through a valid representative assignment', async () => {
  const checked = [];
  const inScope = async (_userId, _unitId, role) => {
    checked.push(role);
    return role === 'UNIT_REPRESENTATIVE';
  };
  assert.equal(await canReadUnitProfile(1, 10, ['MANAGER', 'UNIT_REPRESENTATIVE'], inScope), true);
  assert.deepEqual(checked, ['MANAGER', 'UNIT_REPRESENTATIVE']);
});
