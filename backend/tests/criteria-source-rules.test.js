import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceRulesSchema, updateSourceRulesSchema } from '../src/modules/regulations/regulationSchemas.js';
import { buildInputSnapshot } from '../src/modules/ai/criteriaEvaluator.js';

test('Source rules accept only a typed, nonempty catalog mapping and canonicalize IDs', () => {
  assert.deepEqual(sourceRulesSchema.parse({ sourceType: 'ACHIEVEMENT', achievementTypeIds: [3, 1, 3] }), { sourceType: 'ACHIEVEMENT', achievementTypeIds: [1, 3] });
  for (const rules of [
    { sourceType: 'ACHIEVEMENT', achievementTypeIds: [] },
    { sourceType: 'AWARD_RECORD', awardTypeIds: [-1] },
    { sourceType: 'AWARD_RECORD', awardTypeIds: [1], achievementTypeIds: [2] },
    { sourceType: 'ACHIEVEMENT', achievementTypeIds: [1], isSimulation: false },
    { sourceType: 'OTHER', awardTypeIds: [1] },
  ]) assert.equal(sourceRulesSchema.safeParse(rules).success, false);
  assert.equal(updateSourceRulesSchema.safeParse({ sourceRules: null }).success, false);
});

test('Snapshots preserve each criterion mapping and revision, including mapping removal', () => {
  const a = { criteria_version_id: 1, source_rules: { sourceType: 'ACHIEVEMENT', achievementTypeIds: [3] }, source_rules_revision: 1 };
  const b = { criteria_version_id: 2, source_rules: { sourceType: 'AWARD_RECORD', awardTypeIds: [4] }, source_rules_revision: 7 };
  const make = criteria => buildInputSnapshot({ subject: { subjectType: 'LECTURER', subjectId: 1 }, criteria, asOfDate: '2026-11-03' });
  const before = make([a, b]);
  assert.deepEqual(before.snapshot.criteria.map(c => c.rules), [a.source_rules, b.source_rules]);
  assert.notEqual(before.inputHash, make([a, { ...b, source_rules: null, source_rules_revision: 8 }]).inputHash);
  assert.notEqual(before.inputHash, make([a, { ...b, source_rules_revision: 8 }]).inputHash, 'Reverting a mapping still invalidates runs of an earlier revision');
});
