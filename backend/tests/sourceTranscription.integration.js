import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import { Pool, getDbPoolConfig, setPool } from '../src/config/database.js';
import { discardSource } from '../src/modules/regulationSources.js';

function scannedPdf() {
  // Valid blank page represents a source without a machine-readable text layer.
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << >> /Contents 4 0 R >>','<< /Length 0 >>\nstream\n\nendstream'];
  let text='%PDF-1.4\n';const offsets=[];
  for (const [index,value] of objects.entries()) { offsets.push(Buffer.byteLength(text));text+=`${index+1} 0 obj\n${value}\nendobj\n`; }
  const start=Buffer.byteLength(text);
  text+=`xref\n0 5\n0000000000 65535 f \n${offsets.map(value=>`${String(value).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(text);
}

test('SQL Server scanned-source transcription requires explicit consent, resets review and remains immutable after publish',async()=>{
  const native=new Pool(getDbPoolConfig()),client=await native.connect();await client.query('BEGIN');
  const query=(sql,params)=>/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)?Promise.resolve({rows:[],rowCount:0}):client.query(sql,params);
  setPool({query,connect:async()=>({query,release:async()=>{}})});
  const server=http.createServer(app);server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}/api/v1`,tag=randomUUID(),owner={},outsider={};let storageKey;
  async function call(url,{session=owner,method='GET',data,form,status=200}={}) {
    const headers={};if(session.token)headers.Authorization=`Bearer ${session.token}`;if(data)headers['Content-Type']='application/json';
    const response=await fetch(base+url,{method,headers,body:form??(data?JSON.stringify(data):undefined),signal:AbortSignal.timeout(30000)});
    const payload=await response.json();assert.equal(response.status,status,JSON.stringify(payload));return payload.data;
  }
  try {
    for(const [session,name] of [[owner,'owner'],[outsider,'outsider']]){const result=await call('/auth/register',{session,method:'POST',status:201,data:{email:`transcribe-${name}-${tag}@example.test`,password:'Transcription-Test-42',fullName:`DEMO ${name}`}});session.token=result.accessToken;}
    const doc=await call('/regulations/documents',{method:'POST',status:201,data:{code:tag,name:'DEMO scanned source'}});
    const version=await call(`/regulations/documents/${doc.id}/versions`,{method:'POST',status:201,data:{version_label:'v1',effective_from:'2020-01-01',effective_to:'2030-12-31',source_title:'DEMO scanned document'}});
    const url=`/regulations/versions/${version.id}/source`,form=new FormData();
    form.append('file',new Blob([scannedPdf()]),'scan.pdf');form.append('isDemo','true');
    const uploaded=await call(url,{method:'POST',form,status:201});assert.equal(uploaded.extractionMethod,'AUTO');
    storageKey=(await client.query('SELECT storage_key FROM app.regulation_source_files WHERE id=$1',[uploaded.id])).rows[0].storage_key;
    await call(`${url}/extract`,{method:'POST',status:400});
    const failed=await call(url);assert.equal(failed.extractionStatus,'FAILED');assert.equal(failed.extractionMethod,'AUTO');
    const text='DỮ LIỆU DEMO. Điều 1: hoàn thành hai hoạt động.';
    for(const data of [{text},{text,confirmed:false},{text:'   ',confirmed:true},{text:'a'.repeat(2_000_001),confirmed:true},{text:'bad\u0000text',confirmed:true}])await call(`${url}/text`,{method:'PATCH',data,status:400});
    await call(`${url}/text`,{session:outsider,method:'PATCH',data:{text,confirmed:true},status:403});
    const manual=await call(`${url}/text`,{method:'PATCH',data:{text,confirmed:true}});
    assert.equal(manual.extractionMethod,'MANUAL');assert.equal(manual.extractionStatus,'EXTRACTED');assert.equal(manual.extractionError,null);assert.equal(manual.extractedText,text);assert.equal(manual.sha256,uploaded.sha256);
    await call(`${url}/review`,{method:'POST',data:{confirmed:true}});
    assert.ok((await client.query('SELECT ai_reviewed_at FROM app.regulation_versions WHERE id=$1',[version.id])).rows[0].ai_reviewed_at);
    await call(`${url}/text`,{method:'PATCH',data:{text:text+' Người tạo đã kiểm tra.',confirmed:true}});
    assert.equal((await client.query('SELECT ai_reviewed_at FROM app.regulation_versions WHERE id=$1',[version.id])).rows[0].ai_reviewed_at,null);
    await call(`${url}/extract`,{method:'POST',status:400});assert.equal((await call(url)).extractionMethod,'AUTO');
    await call(`${url}/text`,{method:'PATCH',data:{text,confirmed:true}});
    await call(`/regulations/versions/${version.id}/criteria`,{method:'POST',status:201,data:{code:'C1',title:'Hai hoạt động',source_reference:'Điều 1 demo',rule:{type:'count',target:2}}});
    await call(`${url}/review`,{method:'POST',data:{confirmed:true}});
    await call(`/regulations/versions/${version.id}/publish`,{method:'POST'});
    await call(`${url}/text`,{method:'PATCH',data:{text:'Changed after publish',confirmed:true},status:400});
    assert.equal((await call(url)).extractedText,text);
  } finally {
    await new Promise(resolve=>server.close(resolve));setPool(native);await client.query('ROLLBACK');await client.release();await native.end();setPool(null);
    if(storageKey)await discardSource(storageKey);
  }
});
