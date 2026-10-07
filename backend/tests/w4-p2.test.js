import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createMockSource} from '../src/mock/kpiServer.js';
import {sourceEnvelope,simulationRecord} from '../src/modules/kpi/externalContract.js';
import {pullSource} from '../src/modules/kpi/externalConnector.js';
async function server(app,fn) {
 const s = app.listen(0,'127.0.0.1'); await new Promise(r=>s.once('listening',r));
 try {await fn(`http://127.0.0.1:${s.address().port}/kpi`);} finally {await new Promise(r=>s.close(r));}
}
test('strict employeeId, real period, status/version and mandatory simulation contract',()=>{
 const valid = row=>sourceEnvelope.safeParse({contractVersion:'W4-P2-v1',isSimulation:true,items:[row]}).success;
 assert.ok(valid(simulationRecord));
 for (const change of [{employeeId:''},{employeeId:undefined},{employeeName:'same name'},{version:0},{status:'VERIFIED'},{isSimulation:false},{periodStart:'2026-02-30'},{periodEnd:'2025-01-01'}])
   assert.equal(valid({...simulationRecord,...change}),false);
});
test('real HTTP mock auth and contract',async()=>{
 await server(createMockSource({token:'synthetic-test-token'}),async url=>{
   assert.equal((await fetch(url)).status,401);
   const out = await pullSource({url,token:'synthetic-test-token'});
   assert.equal(out.items[0].employeeId,'SIM-EMP-001');
   let attempts=0;
   await assert.rejects(pullSource({url,token:'wrong',onAttempt:()=>attempts++}),/SOURCE_HTTP_401/);
   assert.equal(attempts,1);
 });
});
test('transient retry, timeout and contract failure are bounded',async()=>{
 let count=0; const app=express();
 app.get('/kpi',(req,res)=>{count++; if(count<3) return res.sendStatus(503);
   res.json({contractVersion:'W4-P2-v1',isSimulation:true,items:[simulationRecord]});});
 await server(app,async url=>{await pullSource({url,token:'synthetic'});assert.equal(count,3);});
 const slow=express(); slow.get('/kpi',(req,res)=>setTimeout(()=>res.json({}),100));
 await server(slow,async url=>{let attempts=0;await assert.rejects(pullSource({url,token:'synthetic',timeoutMs:10,retries:1,onAttempt:()=>attempts++}),/SOURCE_UNAVAILABLE/);assert.equal(attempts,2);});
 const invalid=express();invalid.get('/kpi',(req,res)=>res.json({items:[]}));
 await server(invalid,async url=>assert.rejects(pullSource({url,token:'synthetic'}),/SOURCE_CONTRACT_INVALID/));
});
