import test from 'node:test';
import assert from 'node:assert/strict';
import { AiService } from '../src/modules/ai/aiService.js';
import cache from '../src/modules/ai/aiCache.js';
import { GroqProvider } from '../src/modules/ai/providers/groqProvider.js';
import { OpenRouterProvider } from '../src/modules/ai/providers/openrouterProvider.js';
import { buildCandidate, validatePeriod } from '../src/modules/kpi/recommendationService.js';
import { pullSource } from '../src/modules/kpi/externalConnector.js';
import config from '../src/config/env.js';
import { AiTimeoutError } from '../src/modules/ai/aiErrors.js';

const criterion = {criterionId:1, criterionCode:'SIM-W5',criterionName:'MO PHONG regression only',
 isConfirmedByLhu:true,isSimulation:false,thresholdMetric:{targetMin:2,actualRecorded:0,unitMetric:'bài',isSatisfied:false},
 legalReferences:[{documentCode:'SIM',clauseReference:'MO PHONG'}]};
test('calendar-year requirement distinct from numeric target',()=>{
 const c=buildCandidate({...criterion,yearRequirement:true,minimumDistinctYears:5});
 assert.equal(c.target,2);assert.equal(c.requiredCalendarYears,5);
 assert.throws(()=>validatePeriod(c,{periodStart:'2027-01-01',periodEnd:'2028-12-31'}));
 assert.doesNotThrow(()=>validatePeriod(c,{periodStart:'2027-01-01',periodEnd:'2031-12-31'}));
 const many=buildCandidate({...criterion,yearRequirement:true,minimumDistinctYears:5,thresholdMetric:{...criterion.thresholdMetric,targetMin:20}});
 assert.equal(many.target,20);assert.equal(many.requiredCalendarYears,5);
});
test('real recommender mode rejects absent keys before mock/cache access',async()=>{
 const s=new AiService();s.groqProvider.apiKey='';s.openrouterProvider.apiKey='';
 s.getProvider=()=>{throw new Error('must not reach fallback');};
 for(const forcedProvider of ['groq','openrouter','mock'])
  await assert.rejects(s.completeWithRetry({prompt:'SIM',forcedProvider,requireRealProvider:true}),{code:'AI_PROVIDER_UNAVAILABLE'});
});
test('cache isolates provider; invalid default cannot use cached response; stale TTL/hash/version miss',async()=>{
 cache.clear();const s=new AiService({providerName:'groq',groqApiKey:'SYNTHETIC-NOT-A-KEY'});let calls=0;
 s.groqProvider.defaultModel='llama-3.1-8b-instant';
 s.groqProvider.complete=async()=>({content:'SIM',model:'llama-3.1-8b-instant',provider:'groq',isMock:false});
 const original=s.groqProvider.complete;
 s.groqProvider.complete=async p=>{calls++;return original(p);};
 const p={prompt:'SIM-W5-cache',chunkHash:'A',version:'v1'};
 assert.equal((await s.completeWithRetry(p)).cached,false);
 assert.equal((await s.completeWithRetry(p)).cached,true);assert.equal(calls,1);
 await s.completeWithRetry({...p,chunkHash:'B'});await s.completeWithRetry({...p,version:'v2'});assert.equal(calls,3);
 for(const e of cache.cache.values()) e.storedAt=Date.now()-cache.ttlMs-1;
 await s.completeWithRetry(p);assert.equal(calls,4);
 s.groqProvider.defaultModel='paid-model';
 await assert.rejects(s.completeWithRetry(p),{code:'AI_INVALID_FREE_MODEL'});
 // Same model string and request across providers must not collide.
 s.mockProvider.defaultModel='llama-3.1-8b-instant';
 assert.equal((await s.completeWithRetry({...p,forcedProvider:'mock'})).provider,'mock');cache.clear();
});
test('provider adapters: 429, timeout and malformed JSON never become success',async()=>{
 const original=globalThis.fetch;
 try {
  for(const Provider of [GroqProvider,OpenRouterProvider]) {
   const p=new Provider('SYNTHETIC-NOT-A-KEY');
   globalThis.fetch=async()=>new Response('{}',{status:429,headers:{'retry-after':'7'}});
   await assert.rejects(p.complete({prompt:'SIM'}),e=>e.code==='AI_RATE_LIMIT_EXCEEDED'&&e.retryAfterSeconds===7);
   globalThis.fetch=async()=>{throw new DOMException('synthetic abort','AbortError');};
   await assert.rejects(p.complete({prompt:'SIM'}),{code:'AI_REQUEST_TIMEOUT'});
   globalThis.fetch=async()=>new Response('{invalid',{status:200});
   await assert.rejects(p.complete({prompt:'SIM'}),{code:'AI_PROVIDER_UNAVAILABLE'});
   globalThis.fetch=async()=>new Response(JSON.stringify({model:'paid-model',choices:[{message:{content:'SIM'}}]}));
   await assert.rejects(p.complete({prompt:'SIM'}),{code:'AI_INVALID_FREE_MODEL'});
   globalThis.fetch=async()=>new Response(JSON.stringify({model:p.defaultModel,choices:[{message:{content:'SIM'}}]}));
   const evidence=await p.complete({prompt:'SIM'});
   assert.equal(evidence.model,p.defaultModel);assert.equal(evidence.modelReportedByProvider,true);
  }
  const s=new AiService({groqApiKey:'SYNTHETIC-NOT-A-KEY'});let calls=0;
  s.groqProvider.complete=async()=>{calls++;const e=new Error('quota');e.name='AiRateLimitError';throw e;};
  cache.clear();await assert.rejects(s.completeWithRetry({prompt:'SIM-quota',forcedProvider:'groq'}));assert.equal(calls,1);
  assert.equal(cache.getStats().size,0);
  calls=0;s.groqProvider.complete=async()=>{calls++;throw new AiTimeoutError(1000);};
  await assert.rejects(s.completeWithRetry({prompt:'SIM-timeout',forcedProvider:'groq'}),{code:'AI_REQUEST_TIMEOUT'});
  assert.equal(calls,config.AI_MAX_RETRIES+1);assert.equal(cache.getStats().size,0);
 } finally {globalThis.fetch=original;cache.clear();}
});
test('connector 429 is bounded, invalid JSON and deletion status fail closed',async()=>{
 const original=globalThis.fetch;let calls=0;
 try {
  globalThis.fetch=async()=>{calls++;return new Response('{}',{status:429});};
  await assert.rejects(pullSource({url:'http://127.0.0.1/kpi',token:'SIM',retries:1}),/SOURCE_HTTP_429/);assert.equal(calls,2);
  calls=0;globalThis.fetch=async()=>{calls++;return new Response('{bad');};
  await assert.rejects(pullSource({url:'http://127.0.0.1/kpi',token:'SIM'}),/SOURCE_CONTRACT_INVALID/);assert.equal(calls,1);
 } finally {globalThis.fetch=original;}
});

