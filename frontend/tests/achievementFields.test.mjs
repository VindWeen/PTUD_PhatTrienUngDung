import test from 'node:test';
import assert from 'node:assert/strict';
import { displayAchievementTitle, dynamicAchievementFields, suggestedAchievementFields } from '../src/pages/achievementFields.js';

test('achievement labels hide only a leading demo tag and select fields for the activity', () => {
  assert.equal(displayAchievementTitle('[DEMO] Một sáng kiến'), 'Một sáng kiến');
  assert.equal(displayAchievementTitle('Báo cáo [DEMO]'), 'Báo cáo [DEMO]');
  assert.deepEqual(dynamicAchievementFields({ code: 'TEACHING', name: 'Giảng dạy' }), ['teaching_periods', 'academic_year']);
});

test('extraction keeps numeric attributes, skips invalid dates, and resolves only a known catalog entry', () => {
  const types = [{ id: 3, code: 'TEACHING', name: 'Giảng dạy' }];
  assert.deepEqual(suggestedAchievementFields({
    title: 'Minh chứng', issueDate: '2026-02-30', achievementType: 'TEACHING', teachingPeriods: 45,
    decisionNumber: '05/QĐ', contributionPercent: 0,
  }, types), {
    fields: { title: 'Minh chứng', achievementTypeId: '3' },
    details: { decision_number: '05/QĐ', teaching_periods: 45, contribution_percent: 0 },
  });
  assert.deepEqual(suggestedAchievementFields({ issueDate: '2026-02-28', achievementType: 'Tự đoán' }, types).fields,
    { achievedAt: '2026-02-28' });
});
