import test from 'node:test';
import assert from 'node:assert/strict';
import { ruleSchema, evaluateRule, evaluateVersion } from './intelligenceEvaluator.js';

const items=[{id:1,achieved_at:'2025-02-01',level_code:'PROVINCE',attributes:{hours:5}},{id:2,achieved_at:'2026-02-01',level_code:'SCHOOL',attributes:{hours:8}},{id:3,achieved_at:'2026-03-01',attributes:{}}];
const evalRule=r=>evaluateRule(ruleSchema.parse(r),items,'2026-11-15');
test('numeric accumulation, dates, distinct years and nested alternatives',()=>{
 assert.equal(evalRule({type:'count',target:2}).conclusion,'MET');
 assert.equal(evalRule({type:'count',target:2,from:'2026-01-01'}).actual_value,2);
 assert.equal(evalRule({type:'count',target:1,to:'2024-12-31'}).conclusion,'NOT_MET');
 assert.equal(evalRule({type:'distinct_years',target:2}).actual_value,2);
 assert.equal(evalRule({type:'sum',field:'attributes.hours',target:20}).conclusion,'INSUFFICIENT_DATA');
 assert.equal(evalRule({operator:'OR',rules:[{type:'count',target:9},{type:'count',target:1}]}).conclusion,'MET');
});
test('unknown filter fields cannot manufacture eligibility, exclusion overrides OR',()=>{
 assert.equal(evalRule({type:'count',target:2,filters:[{field:'level_code',operator:'eq',value:'PROVINCE'}]}).conclusion,'INSUFFICIENT_DATA');
 const c=(id,is_exclusion,target)=>({id,title:'criterion',is_required:true,is_exclusion,rule_json:{type:'count',target},criterion_group_id:null});
 const v={applicability_json:{},aggregation_json:{operator:'OR'}};
 assert.equal(evaluateVersion(v,[],[c(1,false,10),c(2,true,10)],{},items,'2026-11-15').conclusion,'NOT_MET');
 assert.equal(evaluateVersion(v,[],[c(1,false,1),c(2,true,1)],{},items,'2026-11-15').conclusion,'NOT_MET');
 assert.equal(evaluateVersion({...v,applicability_json:{person_types:['STUDENT']}},[],[c(1,false,1)],{},items,'2026-11-15').conclusion,'INSUFFICIENT_DATA');
});
test('rule schema rejects arbitrary paths and unsupported rule dialects',()=>{
 assert.equal(ruleSchema.safeParse({type:'count',target:1,filters:[{field:'attributes.__proto__.x',operator:'eq',value:1}]}).success,false);
 assert.equal(ruleSchema.safeParse({type:'sum',target:1}).success,false);
 assert.equal(ruleSchema.safeParse({type:'python',target:1}).success,false);
});

test('consecutive year rules deduplicate awards and reject gaps', () => {
 const rule = ruleSchema.parse({ type: 'distinct_years', consecutive: true, target: 3, last_years: 3 });
 const awards = ['2023-12-20', '2024-12-20', '2024-12-21', '2026-10-01']
  .map((achieved_at, id) => ({ achieved_at, id }));
 assert.equal(evaluateRule(rule, awards, '2026-11-19').actual_value, 2);
 awards.push({ id: 4, achieved_at: '2025-12-20' });
 assert.equal(evaluateRule(rule, awards, '2026-11-19').conclusion, 'MET');
});

test('a qualifying group cannot bypass required manual review outside the groups', () => {
 const version = { applicability_json: {}, aggregation_json: { operator: 'OR', require_ungrouped: true } };
 const groups = [{ id: 1, is_required: true, operator: 'AND' }];
 const criteria = [
  { id: 1, is_required: true, coverage_status: 'MANUAL', rule_json: { type: 'count', target: 1 } },
  { id: 2, is_required: true, criterion_group_id: 1, rule_json: { type: 'count', target: 1 } },
 ];
 const result = evaluateVersion(version, groups, criteria, {}, items, '2026-11-19');
 assert.equal(result.results[1].conclusion, 'MET');
 assert.equal(result.conclusion, 'INSUFFICIENT_DATA');
});

test('unrecorded recognition is distinct from an explicit negative', () => {
 const rule = ruleSchema.parse({ type: 'count', target: 1, filters: [
  { field: 'attributes.kind', operator: 'eq', value: 'sang-kien' },
  { field: 'attributes.recognition_scope', operator: 'in', value: ['MINISTRY', 'PROVINCE'] },
  { field: 'attributes.has_recognition_doc', operator: 'eq', value: true },
 ] });
 const achievement = { id: 1, achieved_at: '2026-10-01', attributes: { kind: 'sang-kien', recognition_scope: 'PROVINCE' } };
 const evaluate = () => evaluateRule(rule, [achievement], '2026-11-19').conclusion;
 assert.equal(evaluate(), 'INSUFFICIENT_DATA');
 achievement.attributes.has_recognition_doc = false;
 assert.equal(evaluate(), 'NOT_MET');
 achievement.attributes.has_recognition_doc = true;
 assert.equal(evaluate(), 'MET');
});
