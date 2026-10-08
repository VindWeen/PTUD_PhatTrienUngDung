import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { evaluateStructuredCriterion } from '../backend/src/modules/ai/criteriaEvaluator.js';
import { buildCandidate } from '../backend/src/modules/kpi/recommendationService.js';
const raw=await fs.readFile(new URL('../docs/ai/evaluation/holdout_dataset.json',import.meta.url),'utf8');
const dataset=JSON.parse(raw);
assert.equal(createHash('sha256').update(raw).digest('hex'),'ea437e0ab9d80f9e30c469f94763b8957c25b656f294d04f5e756fd0c2838644','Q2 holdout changed; version protocol and review labels before rerunning');
for (const split of ['eval-dev/cases.dev.json','eval-final/cases.final.json']) {
 const other=JSON.parse(await fs.readFile(new URL(`../docs/ai/${split}`,import.meta.url),'utf8'));
 const ids=new Set(other.cases.map(c=>c.id));
 assert.ok(dataset.cases.every(c=>!ids.has(c.id)),'Holdout IDs overlap existing splits');
}
const rows=dataset.cases.map(c=>{
 const start=performance.now();
 const result=evaluateStructuredCriterion({...c,rules:c.criterion.rules});
 const candidate=buildCandidate({...result,yearRequirement:c.criterion.rules?.minimumDistinctYears || c.criterion.rules?.requireConsecutive,minimumDistinctYears:c.criterion.rules?.minimumDistinctYears});
 // Frozen Q2 conclusion supplies independent gate labels. No model generates truth.
 const expected=c.groundTruth.expectedConclusion==='INELIGIBLE';
 return {id:c.id,expectedRecommendation:expected,actualRecommendation:Boolean(candidate),correct:expected===Boolean(candidate),
  expectedConclusion:c.groundTruth.expectedConclusion,actualConclusion:result.overallConclusion,
  conclusionCorrect:c.groundTruth.expectedConclusion===result.overallConclusion,
  target:candidate?.target ?? null,actualRecorded:candidate?.actualRecorded ?? null,
  grounded:!candidate || JSON.stringify(candidate.legalReferences)===JSON.stringify(result.legalReferences),
  targetPreserved:!candidate || candidate.target===Number(c.criterion.minThreshold),
  latencyMs:performance.now()-start,issues:result.issues};
});
const positives=rows.filter(r=>r.expectedRecommendation).length;
const report={protocol:'W5-P2-v1',datasetSha256:createHash('sha256').update(raw).digest('hex'),
 dataLabel:'MO PHONG: offline synthetic records; confirmed flags are fixture flags, not policy approval',
 labelAuthority:'Inherited Q2 conclusion labels; recommendation mapping is W5-P2 author-derived, pending independent confirmation',
 model:'deterministic-evaluator-v1 + buildCandidate; no LLM',provider:null,isLiveProviderEvidence:false,
 holdoutStatus:'Reused Q2 holdout, previously evaluated by Q2; not an unseen test of the whole system',
 total:rows.length,positives,negatives:rows.length-positives,correct:rows.filter(r=>r.correct).length,
 conclusionCorrect:rows.filter(r=>r.conclusionCorrect).length,
 falseSuggestions:rows.filter(r=>r.actualRecommendation&&!r.expectedRecommendation).length,
 missedSuggestions:rows.filter(r=>!r.actualRecommendation&&r.expectedRecommendation).length,
 groundedSuggestions:rows.filter(r=>r.actualRecommendation&&r.grounded).length,
 targetPreservedSuggestions:rows.filter(r=>r.actualRecommendation&&r.targetPreserved).length,
 grounded:rows.filter(r=>r.grounded).length,failures:rows.filter(r=>!r.correct||!r.grounded||!r.conclusionCorrect||!r.targetPreserved),rows};
await fs.writeFile(new URL('../docs/ai/recommender-eval/results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined},null,2));
if(report.failures.length)process.exitCode=1;
