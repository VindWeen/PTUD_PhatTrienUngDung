import test from 'node:test';
import assert from 'node:assert/strict';
import aiService from '../src/modules/ai/aiService.js';
import { explainEvaluationResult } from '../src/modules/ai/rag/ragExplanationService.js';
const criterionResult = {criterionId: 1, criterionCode: 'TEST', criterionName: 'kiểm thử nguồn', thresholdMetric: {targetMin: 1, actualRecorded: 0, isSatisfied: false}, aiAnalysis: 'Thiếu dữ liệu'};
const client = {query: async () => ({rows: [{chunk_id: 7, version_id: 3, content: 'kiểm thử nguồn TEST', document_code: 'SYNTHETIC', version_number: '1', chunk_hash: 'a'.repeat(64), source_url: 'https://example.invalid/synthetic'}]})};
for (const content of ['Không viện dẫn', 'Nguồn giả [CHUNK_ID: 999]', 'Nguồn đúng và giả [CHUNK_ID: 7] [CHUNK_ID: 999]']) {
  test(`W4-P4 rejects uncited/unknown source: ${content}`, async () => {
    const original = aiService.completeWithRetry;
    aiService.completeWithRetry = async () => ({content, provider: 'test', model: 'synthetic'});
    try {
      const r = await explainEvaluationResult({criterionResult}, client);
      assert.equal(r.isSufficientData, false);
      assert.deepEqual(r.citations, []);
      assert.ok(!r.explanationText.includes(content));
    } finally { aiService.completeWithRetry = original; }
  });
}
test('W4-P4 quota fallback preserves criterion and source identity', async () => {
  const original = aiService.completeWithRetry;
  const before = JSON.stringify(criterionResult);
  aiService.completeWithRetry = async () => {throw Error('429 quota');};
  try {
    const r = await explainEvaluationResult({criterionResult}, client);
    assert.equal(r.providerError, 'PROVIDER_UNAVAILABLE');
    assert.equal(r.isMock, true);
    assert.equal(r.citations[0].versionId, 3);
    assert.equal(r.citations[0].sourceUrl, 'https://example.invalid/synthetic');
    assert.equal(JSON.stringify(criterionResult), before);
  } finally { aiService.completeWithRetry = original; }
});

// Controller must reject a forged criterion before reaching retrieval/provider.
import { explainEvaluation } from '../src/modules/ai/aiController.js';
test('W4-P4 rejects criterion not belonging to authorized saved run', async () => {
  const original = aiService.getEvaluationRun;
  aiService.getEvaluationRun = async () => ({criterionResults:[{criterionId:2}],inputSnapshot:{asOfDate:'2026-10-07'}});
  let error;
  try {
    await explainEvaluation({user:{userId:999},body:{runId:'00000000-0000-4000-8000-000000000001',criterionResult:{...criterionResult,isConfirmedByLhu:false,isSimulation:true,humanReviewRequired:true}}},{json(){throw Error('must not respond successfully')}},e=>{error=e});
    assert.equal(error.code,'VALIDATION_ERROR');
  } finally {aiService.getEvaluationRun=original;}
});
