import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import PizZip from 'pizzip';
import app from '../src/app.js';
import { Pool,getDbPoolConfig,setPool } from '../src/config/database.js';
import { discardSource } from '../src/modules/regulationSources.js';

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
   const preview=await call('/regulations/versions/'+privateV.id+'/source/preview');
   assert.match(preview.text,/DỮ LIỆU DEMO/);
   await call('/regulations/versions/'+privateV.id+'/source/preview',{session:outside,expected:403});
   assert.equal((await call('/regulations/documents/'+privateDoc.id)).versions[0].criterion_count,1);
   const extracted=await call(`/regulations/versions/${privateV.id}/source/extract`,{method:'POST'});assert.match(extracted.extractedText,/DỮ LIỆU DEMO/);
   await call(`/regulations/versions/${privateV.id}/publish`,{method:'POST',expected:400});
   await call(`/regulations/versions/${privateV.id}/source/review`,{method:'POST',data:{confirmed:true}});
   const c=(await call(`/regulations/versions/${privateV.id}`)).criteria[0];await call(`/regulations/criteria/${c.id}`,{method:'PATCH',data:{title:'Hai hoạt động theo nguồn'}});
   await call(`/regulations/versions/${privateV.id}/publish`,{method:'POST',expected:400});
   await call(`/regulations/versions/${privateV.id}/source/review`,{method:'POST',data:{confirmed:true}});await publish(privateV);
   await call(`/regulations/versions/${privateV.id}/source/extract`,{method:'POST',expected:400});
   const downloaded=await call(`/regulations/versions/${privateV.id}/source/download`,{raw:true});assert.equal(new PizZip(Buffer.from(await downloaded.arrayBuffer())).file('word/document.xml')!==null,true);
   await call('/ai/evaluations/structured',{method:'POST',session:outside,data:{regulation_version_id:privateV.id},expected:403});
   const run=await call('/ai/evaluations/structured',{method:'POST',data:{regulation_version_id:privateV.id},expected:201});
   const latest=await call('/ai/evaluations/structured/latest');
   const summary=latest.items.find(item=>Number(item.id)===Number(run.id));
   assert.equal(summary.history_count,1);
   assert.equal(summary.criterion_count,1);
   assert.equal(summary.met_count,0);
   const history=await call('/ai/evaluations/structured/history?version='+privateV.id);
   assert.deepEqual(history.items.map(item=>Number(item.id)),[Number(run.id)]);
   assert.equal((await call('/ai/evaluations/structured/history?version='+privateV.id,{session:outside})).total,0);
   assert.deepEqual((await call('/ai/evaluations/structured/'+run.id)).results[0].evidence_files,[]);

  });
  await t.test('create first draft atomically and toggle a published owner version without deleting it', async()=>{
   const code=randomUUID();
   const metadata={version_label:'v1.0',effective_from:'2026-01-01',source_title:'DEMO'};
   await call('/regulations/documents',{method:'POST',data:{code,name:'Bản thử lỗi ngày',first_version:{...metadata,effective_to:'2025-12-31'}},expected:400});
   assert.equal((await client.query('SELECT id FROM app.regulations WHERE code=$1',[code])).rows.length,0);
   const created=await call('/regulations/documents',{method:'POST',data:{code,name:'Bản thử tạo liền mạch',first_version:metadata},expected:201});
   assert.equal(created.versions.length,1);
   assert.equal(created.versions[0].publication_status,'DRAFT');
   const path='/regulations/versions/'+privateV.id;
   const shown=async()=> (await call('/regulations/library')).items.some(c=>Number(c.regulation_version_id)===Number(privateV.id));
   assert.equal(await shown(),true);
   await call(path+'/adopt',{method:'DELETE'});
   assert.equal(await shown(),false);
   assert.equal((await call(path)).publication_status,'PUBLISHED');
   await call('/ai/evaluations/structured',{method:'POST',data:{regulation_version_id:privateV.id},expected:403});
   await call(path+'/adopt',{method:'POST',data:{},expected:201});
   assert.equal(await shown(),true);
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
  await t.test('parent cannot discover an internal rule of its child through inherited management grants',async()=>{
   const child=await call('/organizations',{method:'POST',data:{code:'CHILD-'+tag,name:'Khoa kiểm thử',organizationType:'FACULTY',parentId:school.id,managerEmail:b.email},expected:201});
   const d=await doc(b,{owner_organization_id:child.id,is_internal:true}),old=await version(d,b);await publish(old,b);
   await call(`/regulations/versions/${old.id}/adopt`,{method:'POST',session:b,data:{organization_id:child.id},expected:201});
   await call(`/regulations/documents/${d.id}`,{expected:404});
   const newer=await version(d,b,'v2');await publish(newer,b);
   const notices=(await client.query('SELECT recipient_user_id FROM app.notifications WHERE deduplication_key=$1',['regulation-version:'+newer.id])).rows;
   assert.deepEqual(notices.map(n=>Number(n.recipient_user_id)),[Number(b.id)]);
  });
  await t.test('legacy global regulation manager cannot bypass the organization scope or view a personal vault',async()=>{
   await client.query("INSERT app.global_role_grants(user_id,role_code) VALUES($1,'REGULATION_MANAGER')",[outside.id]);
   await call('/regulations/documents',{method:'POST',session:outside,data:{code:randomUUID(),name:'Out of scope',owner_organization_id:school.id,is_internal:true},expected:403});
   await call(`/regulations/documents/${privateDoc.id}`,{session:outside,expected:404});
  });
  await t.test('personal rules support direct offers, organization acceptance and public adoption',async()=>{
   const share=await call(`/regulations/versions/${privateV.id}/shares`,{method:'POST',data:{recipient_email:outside.email},expected:201});
   await call(`/regulations/shares/${share.id}/respond`,{method:'POST',session:b,data:{accept:true},expected:403});
   await call(`/regulations/versions/${privateV.id}`,{session:outside});
   await call(`/regulations/shares/${share.id}/respond`,{method:'POST',session:outside,data:{accept:true}});
   await call('/ai/evaluations/structured',{method:'POST',session:outside,data:{regulation_version_id:privateV.id},expected:201});
   const personal=await doc(member),v=await version(personal,member);
   await publish(v,member);
   await call(`/regulations/versions/${v.id}/shares`,{method:'POST',session:member,data:{recipient_organization_id:recipient.id},expected:403});
   const orgShare=await call(`/regulations/versions/${v.id}/shares`,{method:'POST',session:member,data:{recipient_organization_id:school.id},expected:201});
   await call(`/regulations/shares/${orgShare.id}/respond`,{method:'POST',data:{accept:true}});
   await call(`/regulations/documents/${personal.id}/distribution`,{method:'PATCH',session:member,data:{is_public:true}});
   await call(`/regulations/versions/${v.id}/adopt`,{method:'POST',session:b,data:{},expected:201});
  });
  await t.test('applicants track join requests and the manager can approve membership',async()=>{
   const path=`/organizations/${school.id}/join-requests`;
   await call('/me/join-requests',{session:{},expected:401});
   const r=await call(path,{method:'POST',session:outside,data:{reason:'Kiểm thử gia nhập'},expected:201});
   await call(path,{method:'POST',session:outside,data:{},expected:409});
   await call(`${path}/${r.id}/respond`,{method:'POST',session:b,data:{accept:true},expected:403});
   await call(`${path}/${r.id}/respond`,{method:'POST',data:{accept:true}});
   assert.equal((await call('/me/join-requests',{session:outside}))[0].status,'ACCEPTED');
   assert.ok((await call('/me/profile',{session:outside})).memberships.some(m=>Number(m.organization_id)===Number(school.id)));
  });
  await t.test('parent and existing child can each initiate a link the other must approve',async()=>{
   for(const parentInitiates of [true,false]){
    const child=await call('/organizations',{method:'POST',session:b,data:{code:`LINK-${parentInitiates}-${tag}`,name:'Khoa độc lập',organizationType:'FACULTY'},expected:201});
    const request=await call(`/organizations/${child.id}/link-requests`,{method:'POST',session:parentInitiates?a:b,data:{targetParentId:school.id},expected:201});
    assert.equal(request.status,'PENDING');
    assert.equal((await call(`/organizations/${child.id}`)).parent_id,null);
    const response=await call(`/organization-link-requests/${request.id}/respond`,{method:'POST',session:parentInitiates?b:a,data:{accept:true}});
    assert.equal(response.status,'ACCEPTED');
    assert.equal(Number((await call(`/organizations/${child.id}`)).parent_id),Number(school.id));
   }
  });
 }finally{await new Promise(r=>server.close(r));setPool(native);await client.query('ROLLBACK');await client.release();await native.end();setPool(null);for(const f of files)await discardSource(f);}
});
