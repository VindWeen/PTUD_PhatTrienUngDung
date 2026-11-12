import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendationBlockReason, criterionBlockReasons } from './kpiEligibility.js';

test('only completed, current evaluations permit recommendation generation', () => {
  assert.equal(recommendationBlockReason({ overallStatus: 'COMPLETED', isStale: false }), '');
  assert.match(recommendationBlockReason({ overallStatus: 'COMPLETED', isStale: true }), /thay đổi/);
  assert.match(recommendationBlockReason({ overallStatus: 'FAILED' }), /không thành công/);
  assert.match(recommendationBlockReason({ overallStatus: 'FLAGGED_UNCONFIRMED' }), /rà soát/);
  assert.ok(recommendationBlockReason(null));
});

test('blocked criteria are identified without labelling a confirmed shortfall as a review failure', () => {
  const reasons = criterionBlockReasons({ criterionResults: [
    { criterionName: 'Bài báo', isConfirmedByLhu: true, thresholdMetric: { isSatisfied: false } },
    { criterionName: 'Đề tài', isConfirmedByLhu: false, isSimulation: true },
    { criterionName: 'Minh chứng', isConfirmedByLhu: true, humanReviewRequired: true },
  ] });
  assert.equal(reasons.length, 2);
  assert.match(reasons[0], /Đề tài.*chưa được xác nhận/);
  assert.match(reasons[1], /Minh chứng.*rà soát/);
});
