import test from 'node:test';
import assert from 'node:assert/strict';
import { queryCriteriaSchema } from '../src/modules/regulations/regulationSchemas.js';

test('criteria query defaults to confirmed and decodes both true/false query strings', () => {
  assert.equal(queryCriteriaSchema.parse({}).confirmedOnly, true);
  assert.equal(queryCriteriaSchema.parse({ confirmedOnly: 'true' }).confirmedOnly, true);
  assert.equal(queryCriteriaSchema.parse({ confirmedOnly: 'false' }).confirmedOnly, false);
  assert.equal(queryCriteriaSchema.safeParse({ confirmedOnly: 'invalid' }).success, false);
  assert.equal(queryCriteriaSchema.safeParse({ limit: '50' }).success, false);
});
