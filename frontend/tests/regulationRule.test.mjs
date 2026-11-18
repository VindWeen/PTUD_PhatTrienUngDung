import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRegulationRule } from '../src/pages/regulationRule.js';

test('regulation copy reflects the evaluator default and explicit equality', () => {
  assert.match(formatRegulationRule({ type: 'count', target: 1 }), /ít nhất 1/);
  assert.match(formatRegulationRule({ type: 'count', target: 1, comparator: 'eq' }), /đúng 1/);
});

test('regulation copy resolves achievement type and date window inside grouped rules', () => {
  const result = formatRegulationRule({
    operator: 'OR',
    rules: [{ type: 'count', target: 2, from: '2026-01-01', filters: [{ field: 'achievement_type_id', operator: 'eq', value: 7 }] }],
  }, [{ id: 7, name: 'Sáng kiến' }]);
  assert.match(result, /ít nhất một điều kiện/);
  assert.match(result, /loại thành tích là Sáng kiến/);
  assert.match(result, /từ 01\/01\/2026/);
});

test('continuous years, recognition and manual review are shown in Vietnamese', () => {
  const rule = {
    type: 'distinct_years', consecutive: true, target: 3,
    filters: [
      { field: 'attributes.recognition_scope', operator: 'in', value: ['MINISTRY', 'PROVINCE'] },
      { field: 'attributes.has_recognition_doc', operator: 'eq', value: true },
    ],
  };
  const label = formatRegulationRule(rule);
  assert.match(label, /3 năm liên tiếp/);
  assert.match(label, /Bộ, ban, ngành, Tỉnh/);
  assert.match(label, /đã có văn bản công nhận/);
  assert.doesNotMatch(label, /recognition_scope|MINISTRY|PROVINCE/);
  assert.match(formatRegulationRule(rule, [], 'MANUAL'), /Cần hội đồng \/ cán bộ rà soát minh chứng/);
  assert.match(formatRegulationRule({ type: 'distinct_years', target: 3 }), /3 năm khác nhau/);
});
