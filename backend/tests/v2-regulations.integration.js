import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import PizZip from 'pizzip';
import app from '../src/app.js';
import { Pool,getDbPoolConfig,setPool } from '../src/config/database.js';
import { discardSource } from '../src/v2/regulationSources.js';

test('SQL Server HTTP regulations: private source, scoped internal/share/public pins, review and immutable updates',async t=>{
 const native=new Pool(getDbPoolConfig()),client=await native.connect();await client.query('BEGIN');
 const query=(s,p)=>/^(BEGIN|COMMIT|ROLLBACK)$/.test(s)?Promise.resolve({rows:[],rowCount:0}):client.query(s,p);
 setPool({query,connect:async()=>({query,release:async()=>{}})});
 const server=http.createServer(app);server.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}/api/v1`,tag=randomUUID(),files=[];
 const a={},b={},member={},outside={};
 async function call(path,{method='GET',data,form,session=a,expected=200,raw=false}={}){const headers={};if(session.token)headers.Authorization=`Bearer ${session.token}`;if(data)headers['Content-Type']='application/json';const r=await fetch(base+path,{method,headers,body:form??(data?JSON.stringify(data):undefined),signal:AbortSignal.timeout(20000)});if(raw){assert.equal(r.status,expected);return r;}const payload=await r.json();assert.equal(r.status,expected,`${method} ${path}: ${JSON.stringify(payload)}`);if(payload.data?.accessToken)session.token=payload.data.accessToken;return payload.data;}
 async function register(session,name){const d=await call('/auth/register',{method:'POST',session,data:{email:`${name}-${tag}@example.test`,password:'Regulations-Test-42',fullName:`DEMO ${name}`},expected:201});session.id=d.user.userId;session.email=`${name}-${tag}@example.test`;}
 async function doc(session,extra={}){return call('/regulations/documents',{method:'POST',session,data:{code:randomUUID(),name:'DEMO quy chế',...extra},expected:201});}
 async function version(d,session=a,label='v1',extra={}){const v=await call(`/regulations/documents/${d.id}/versions`,{method:'POST',session,data:{version_label:label,effective_from:'2020-01-01',effective_to:'2030-12-31',source_title:'DEMO quy chế',...extra},expected:201});await call(`/regulations/versions/${v.id}/criteria`,{method:'POST',session,data:{code:'C1',title:'Hai hoạt động',source_reference:'Điều 1 demo',rule:{type:'count',target:2}},expected:201});return v;}
 async function publish(v,session=a){return call(`/regulations/versions/${v.id}/publish`,{method:'POST',session});}
 let privateDoc,privateV,school,recipient,internal,v1,v2,offer,publicDoc,publicV;
 try{
  await t.test('ordinary individual creates private regulation; guessed ID never opens document/version/source',async()=>{
   for(const [s,n] of [[a,'owner'],[b,'receiver'],[member,'member'],[outside,'outside']])await register(s,n);
   privateDoc=await doc(a);privateV=await version(privateDoc);
   const zip=new PizZip();zip.file('[Content_Types].xml','<Types/>');zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>DỮ LIỆU DEMO. Điều 1: hoàn thành hai hoạt động.</w:t></w:r></w:p></w:body></w:document>');
   const form=new FormData();form.append('file',new Blob([zip.generate({type:'nodebuffer'})]),'quy-che.docx');form.append('isDemo','true');
   const source=await call(`/regulations/versions/${privateV.id}/source`,{method:'POST',form,expected:201});assert.equal(source.isDemo,true);assert.equal(source.storage_key,undefined);
   files.push((await client.query('SELECT storage_key FROM app.regulation_source_files WHERE id=$1',[source.id])).rows[0].storage_key);
   assert.ok((await call('/regulations/documents')).items.some(d=>Number(d.id)===Number(privateDoc.id)));
   assert.ok(!(await call('/regulations/documents',{session:outside})).items.some(d=>Number(d.id)===Number(privateDoc.id)));
   await call(`/regulations/documents/${privateDoc.id}`,{session:outside,expected:404});await call(`/regulations/versions/${privateV.id}`,{session:outside,expected:404});await call(`/regulations/versions/${privateV.id}/source/download`,{session:outside,expected:403});
   const extracted=await call(`/regulations/versions/${privateV.id}/source/extract`,{method:'POST'});assert.match(extracted.extractedText,/DỮ LIỆU DEMO/);
   await call(`/regulations/versions/${privateV.id}/publish`,{method:'POST',expected:400});
   await call(`/regulations/versions/${privateV.id}/source/review`,{method:'POST',data:{confirmed:true}});
   const c=(await call(`/regulations/versions/${privateV.id}`)).criteria[0];await call(`/regulations/criteria/${c.id}`,{method:'PATCH',data:{title:'Hai hoạt động theo nguồn'}});
   await call(`/regulations/versions/${privateV.id}/publish`,{method:'POST',expected:400});
   await call(`/regulations/versions/${privateV.id}/source/review`,{method:'POST',data:{confirmed:true}});await publish(privateV);
   await call(`/regulations/versions/${privateV.id}/source/extract`,{method:'POST',expected:400});
   const downloaded=await call(`/regulations/versions/${privateV.id}/source/download`,{raw:true});assert.equal(new PizZip(Buffer.from(await downloaded.arrayBuffer())).file('word/document.xml')!==null,true);
   await call('/ai/evaluations/structured',{method:'POST',session:outside,data:{regulation_version_id:privateV.id},expected:403});
  });
  await t.test('organization must pin internal version; members inherit it and outsiders are denied',async()=>{
   school=await call('/organizations',{method:'POST',data:{code:`S-${tag}`,name:'DEMO trường',organizationType:'UNIVERSITY'},expected:201});recipient=await call('/organizations',{method:'POST',session:b,data:{code:`R-${tag}`,name:'DEMO hội độc lập',organizationType:'TEAM'},expected:201});
   const invite=await call(`/organizations/${school.id}/invitations`,{method:'POST',data:{email:member.email},expected:201});await call(`/invitations/${invite.id}/respond`,{method:'POST',session:member,data:{accept:true}});
   internal=await doc(a,{owner_organization_id:school.id,is_internal:true});v1=await version(internal);await publish(v1);
   await call('/ai/evaluations/structured',{method:'POST',session:member,data:{regulation_version_id:v1.id},expected:403});
   await call(`/organizations/units/${school.id}/ai-scan`,{method:'POST',data:{regulation_version_id:v1.id},expected:403});
   await call(`/regulations/versions/${v1.id}/adopt`,{method:'POST',data:{organization_id:school.id},expected:201});
   assert.equal((await call('/ai/evaluations/structured',{method:'POST',session:member,data:{regulation_version_id:v1.id},expected:201})).conclusion,'NOT_MET');
   await call(`/regulations/versions/${v1.id}`,{session:outside,expected:404});await call(`/regulations/versions/${v1.id}/criteria`,{method:'POST',session:member,data:{},expected:403});
   await call(`/organizations/units/${school.id}/ai-scan`,{method:'POST',data:{regulation_version_id:v1.id,evaluation_date:'2031-01-01'},expected:400});
   const scan=await call(`/organizations/units/${school.id}/ai-scan`,{method:'POST',data:{regulation_version_id:v1.id,include_descendants:true}});assert.equal(scan.items.length,1);
  });
  await t.test('targeted pending/rejected shares do not distribute; acceptance does; revoke retains accepted pin',async()=>{
   offer=await call(`/regulations/versions/${v1.id}/shares`,{method:'POST',data:{recipient_organization_id:recipient.id},expected:201});
   await call('/ai/evaluations/structured',{method:'POST',session:b,data:{regulation_version_id:v1.id},expected:403});
   await call(`/regulations/shares/${offer.id}/respond`,{method:'POST',session:b,data:{accept:false}});assert.equal((await call('/regulations/shares',{session:b})).items[0].status,'REJECTED');
   offer=await call(`/regulations/versions/${v1.id}/shares`,{method:'POST',data:{recipient_organization_id:recipient.id},expected:201});await call(`/regulations/shares/${offer.id}/respond`,{method:'POST',session:b,data:{accept:true}});
   await call(`/regulations/shares/${offer.id}/revoke`,{method:'POST'});
   await call(`/organizations/units/${recipient.id}/ai-scan`,{method:'POST',session:b,data:{regulation_version_id:v1.id}});
  });
  await t.test('new publication notifies adopters without replacing their selected version',async()=>{
   v2=await version(internal,a,'v2');await publish(v2);
   assert.equal(Number((await client.query('SELECT regulation_version_id FROM app.regulation_adoptions WHERE organization_id=$1',[school.id])).rows[0].regulation_version_id),Number(v1.id));
   assert.ok((await client.query("SELECT id FROM app.notifications WHERE recipient_user_id=$1 AND notification_type='REGULATION_UPDATED'",[a.id])).rows.length);
   await call('/ai/evaluations/structured',{method:'POST',session:member,data:{regulation_version_id:v2.id},expected:403});
   const library=await call('/regulations/library',{session:member});assert.ok(library.items.some(c=>Number(c.regulation_version_id)===Number(v1.id)&&c.update_available));
   await call(`/regulations/versions/${v2.id}/adopt`,{method:'POST',data:{organization_id:school.id},expected:201});
   await call('/ai/evaluations/structured',{method:'POST',session:member,data:{regulation_version_id:v2.id},expected:201});
  });
  await t.test('public view requires explicit personal adoption for use and never adopts for an organization',async()=>{
   publicDoc=await doc(a,{owner_organization_id:school.id,is_public:true});publicV=await version(publicDoc);await publish(publicV);
   await call(`/regulations/versions/${publicV.id}`,{session:outside});await call('/ai/evaluations/structured',{method:'POST',session:outside,data:{regulation_version_id:publicV.id},expected:403});
   await call(`/regulations/versions/${publicV.id}/adopt`,{method:'POST',session:outside,data:{},expected:201});
   assert.equal((await client.query('SELECT id FROM app.regulation_adoptions WHERE regulation_id=$1 AND organization_id IS NOT NULL',[publicDoc.id])).rows.length,0);
   await call(`/regulations/documents/${publicDoc.id}/distribution`,{method:'PATCH',data:{is_public:false}});
   await call('/ai/evaluations/structured',{method:'POST',session:outside,data:{regulation_version_id:publicV.id},expected:201});
   await call('/ai/evaluations/structured',{method:'POST',session:outside,data:{regulation_version_id:publicV.id,evaluation_date:'2031-01-01'},expected:400});
  });
  await t.test('split create/share permissions and explicit assessment contexts remain independent',async()=>{
   await client.query("INSERT app.org_access_grants(organization_id,user_id,permission_code,granted_by_user_id) VALUES($1,$2,'REGULATIONS_CREATE',$3)",[school.id,outside.id,a.id]);
   await call('/regulations/documents',{method:'POST',session:outside,data:{code:randomUUID(),name:'Cannot publish visibility',owner_organization_id:school.id,is_public:true},expected:403});
   await call(`/regulations/documents/${publicDoc.id}/distribution`,{method:'PATCH',data:{is_public:true}});
   await call(`/regulations/versions/${publicV.id}/adopt`,{method:'POST',session:member,data:{},expected:201});
   await call(`/regulations/versions/${publicV.id}/adopt`,{method:'POST',data:{organization_id:school.id},expected:201});
   await call('/ai/evaluations/structured',{method:'POST',session:member,data:{regulation_version_id:publicV.id},expected:400});
   const contexts=(await call('/regulations/library',{session:member})).items.filter(c=>Number(c.regulation_version_id)===Number(publicV.id));assert.equal(contexts.length,2);
   for(const c of contexts){const run=await call('/ai/evaluations/structured',{method:'POST',session:member,data:{regulation_version_id:publicV.id,adoption_id:Number(c.adoption_id)},expected:201});assert.equal(Number(run.context.adoption_id),Number(c.adoption_id));assert.equal(run.context.context_type,c.context_type);}
   const discovered=await call('/ai/auto-discovery',{method:'POST',session:member,data:{}});assert.equal(discovered.items.filter(r=>Number(r.regulation_version_id)===Number(publicV.id)).length,2);assert.ok(discovered.items.every(r=>r.context.adoption_id));
  });
  await t.test('version notifications reach a parent manager whose update grant includes the adopted child',async()=>{
   const child=(await client.query("DECLARE @ids TABLE(id bigint);INSERT app.organizations(parent_id,code,name,organization_type,created_by_user_id) OUTPUT INSERTED.id INTO @ids VALUES($1,$2,N'DEMO child','CLASS',$3);SELECT id FROM @ids;",[school.id,'CHILD-'+tag,a.id])).rows[0];
   const d=await doc(a,{owner_organization_id:Number(child.id)}),old=await version(d);await publish(old);
   await call(`/regulations/versions/${old.id}/adopt`,{method:'POST',data:{organization_id:Number(child.id)},expected:201});
   assert.equal((await client.query('SELECT id FROM app.org_access_grants WHERE organization_id=$1',[child.id])).rows.length,0);
   const newer=await version(d,a,'v2');await publish(newer);
   const notices=(await client.query('SELECT id FROM app.notifications WHERE recipient_user_id=$1 AND deduplication_key=$2',[a.id,'regulation-version:'+newer.id])).rows;assert.equal(notices.length,1);
  });
  await t.test('global regulation manager creates organization rules without gaining another personal vault',async()=>{
   await client.query("INSERT app.global_role_grants(user_id,role_code) VALUES($1,'REGULATION_MANAGER')",[outside.id]);
   const managed=await doc(outside,{owner_organization_id:school.id,is_internal:true});assert.equal(managed.can_manage,true);assert.equal(Number(managed.owner_organization_id),Number(school.id));
   await call(`/regulations/documents/${privateDoc.id}`,{session:outside,expected:404});
  });
 }finally{await new Promise(r=>server.close(r));setPool(native);await client.query('ROLLBACK');await client.release();await native.end();setPool(null);for(const f of files)await discardSource(f);}
});
