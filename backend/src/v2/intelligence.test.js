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
