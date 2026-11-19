import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import http from 'node:http';
import PizZip from 'pizzip';
import app from '../src/app.js';
import { Pool, getDbPoolConfig, setPool } from '../src/config/database.js';
import { discardFile } from '../src/modules/files.js';

test('V2 HTTP: personal vault, files, private/public CV, organization consent, calendar and revoked sessions',async(t)=>{
  const native=new Pool(getDbPoolConfig()),client=await native.connect();
  await client.query('BEGIN');
  const query=(sql,params)=>/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)?Promise.resolve({rows:[],rowCount:0}):client.query(sql,params);
  setPool({query,connect:async()=>({query,release:async()=>{}})});
  const server=http.createServer(app);server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}/api/v1`,tag=randomUUID(),createdFiles=[];
  const a={},b={};
  async function call(path,{method='GET',data,session=a,expected=200,raw=false,form}={}){
    const headers={};if(session.token)headers.Authorization=`Bearer ${session.token}`;if(session.cookie)headers.Cookie=session.cookie;
    if(data)headers['Content-Type']='application/json';
    const response=await fetch(base+path,{method,headers,body:form||(data?JSON.stringify(data):undefined),signal:AbortSignal.timeout(15000)});
    const cookie=response.headers.get('set-cookie');if(cookie)session.cookie=cookie.split(';')[0];
    if(raw){assert.equal(response.status,expected);return response;}
    const payload=await response.json();assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(payload)}`);
    if(payload.data?.accessToken)session.token=payload.data.accessToken;return payload.data;
  }
  try{
    let item,cv,org,invite,event;
    await t.test('register/login works without organization and uses live V2 profile',async()=>{
      const registered=await call('/auth/register',{method:'POST',data:{email:`${tag}@example.test`,password:'Testing-Password-42',fullName:'Người dùng tự do'},expected:201});
      a.id=registered.user.userId;assert.deepEqual(registered.user.memberships,[]);
      const other=await call('/auth/register',{method:'POST',data:{email:`${tag}-other@example.test`,password:'Testing-Password-42',fullName:'Người thứ hai'},session:b,expected:201});b.id=other.user.userId;
      const me=await call('/auth/me');assert.equal(me.userId,a.id);assert.ok(me.roles.includes('MEMBER'));
      await call('/auth/login',{method:'POST',data:{username:`${tag}@example.test`,password:'Testing-Password-42'}});
    });
    await t.test('personal achievement CRUD is isolated by owner',async()=>{
      item=await call('/achievements',{method:'POST',data:{title:'Chứng nhận hoạt động',achievedAt:'2026-11-15',attributes:{hours:12}},expected:201});
      assert.equal(item.title,'Chứng nhận hoạt động');assert.equal(item.attributes.hours,12);
      assert.equal((await call('/achievements')).total,1);
      await call(`/achievements/${item.id}`,{session:b,expected:404});
      await call(`/achievements/${item.id}`,{method:'PATCH',session:b,data:{title:'Không được sửa'},expected:404});
      item=await call(`/achievements/${item.id}`,{method:'PATCH',data:{description:'Đã lưu trực tiếp'}});assert.equal(item.description,'Đã lưu trực tiếp');
    });
    await t.test('real evidence upload/download checks ownership and explicit sharing',async()=>{
      const form=new FormData();form.append('file',new Blob(['%PDF-1.4\nTest evidence'],{type:'application/pdf'}),'minh-chung.pdf');
      const file=await call(`/achievements/${item.id}/evidences`,{method:'POST',form,expected:201});
      const metadata=(await client.query('SELECT storage_key FROM app.evidence_files WHERE id=$1',[file.id])).rows[0];createdFiles.push(metadata.storage_key);
      assert.equal((await call(`/achievements/${item.id}/evidences`)).length,1);
      const downloaded=await call(`/evidence-files/${file.id}/download`,{raw:true});assert.match(await downloaded.text(),/%PDF/);
      await call(`/evidence-files/${file.id}/download`,{session:b,expected:403});
      const share=await call(`/evidence-files/${file.id}/shares`,{method:'POST',data:{recipientUserId:b.id},expected:201});
      const shared=await call(`/evidence-files/${file.id}/download`,{session:b,raw:true});assert.match(await shared.text(),/%PDF/);
      await call(`/evidence-shares/${share.id}`,{method:'DELETE'});await call(`/evidence-files/${file.id}/download`,{session:b,expected:403});
    });
    await t.test('assessment dossier includes uploaded evidence and rejects another owner',async()=>{
      await client.query("INSERT app.global_role_grants(user_id,role_code) VALUES($1,'REGULATION_MANAGER')",[a.id]);
      const doc=await call('/regulations/documents',{method:'POST',data:{code:`zip-${tag}`,name:'Dossier rule'},expected:201});
      const version=await call(`/regulations/documents/${doc.id}/versions`,{method:'POST',data:{version_label:'v1',effective_from:'2020-01-01',source_title:'Test source'},expected:201});
      await call(`/regulations/versions/${version.id}/criteria`,{method:'POST',data:{code:'COUNT',title:'One activity',source_reference:'Article 1',rule:{type:'count',target:1}},expected:201});
      await call(`/regulations/versions/${version.id}/publish`,{method:'POST'});
      const run=await call('/ai/evaluations/structured',{method:'POST',data:{regulation_version_id:version.id,evaluation_date:'2026-11-15'},expected:201});
      const response=await call('/ai/export-dossier-zip',{method:'POST',data:{runId:run.id},raw:true});
      const zip=new PizZip(Buffer.from(await response.arrayBuffer()));
      assert.ok(zip.file('ket-qua-kham.json'));
      const evidence=zip.file(/minh-chung\.pdf$/);assert.equal(evidence.length,1);assert.match(evidence[0].asText(),/%PDF/);
      await call('/ai/export-dossier-zip',{method:'POST',data:{runId:run.id},session:b,expected:404});
    });
    await t.test('CV selection, generated slug and contact privacy work without seeds',async()=>{
      cv=await call('/me/cv',{method:'PUT',data:{slug:'',templateId:'Modern',isPublic:true,selectedAchievementIds:[item.id],headline:'Hồ sơ cá nhân',bio:'Giới thiệu'}});
      assert.match(cv.slug,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);assert.equal(cv.selectedAchievementIds.length,1);
      const publicCv=await call(`/public/cv/${cv.slug}`,{session:{}});assert.equal(publicCv.achievements.length,1);assert.equal(publicCv.contact.email,'');assert.equal(publicCv.contact.phone,'');
      const docx=await call('/me/cv/export-docx',{raw:true});assert.equal(Buffer.from(await docx.arrayBuffer()).subarray(0,2).toString(),'PK');
      await call(`/achievements/${item.id}`,{method:'DELETE'});
      assert.equal((await call(`/public/cv/${cv.slug}`,{session:{}})).achievements.length,0);
      await call(`/achievements/${item.id}/restore`,{method:'POST'});
      const empty=await call('/me/cv',{method:'PUT',data:{templateId:'Modern',isPublic:true,selectedAchievementIds:[]}});assert.equal(empty.selectedAchievementIds.length,0);
      assert.equal((await call(`/public/cv/${cv.slug}`,{session:{}})).achievements.length,0);
    });
    await t.test('organization invitations require recipient consent before membership',async()=>{
      org=await call('/organizations',{method:'POST',data:{code:`ORG-${tag}`,name:'Tổ chức kiểm thử',organizationType:'CLASS'},expected:201});
      const list=await call('/organizations');assert.ok(list.some(x=>x.id===org.id));
      invite=await call(`/organizations/${org.id}/invitations`,{method:'POST',data:{email:`${tag}-other@example.test`},expected:201});
      const before=await call(`/organizations/${org.id}/members`);assert.equal(before.length,0);
      await call(`/invitations/${invite.id}/respond`,{method:'POST',data:{accept:true},session:b});
      const after=await call(`/organizations/${org.id}/members`);assert.equal(after.length,1);
      await call(`/organizations/${org.id}/access`,{session:b,expected:403});
      await call(`/organizations/${org.id}/members/${after[0].id}`,{method:'DELETE'});assert.equal((await call(`/organizations/${org.id}/members`)).length,0);
      assert.equal((await call('/achievements')).total,1);
    });
    await t.test('calendar CRUD, real report totals and no approval routes',async()=>{
      event=await call('/me/calendar/events',{method:'POST',data:{title:'Làm mục tiêu',startsAt:'2026-11-16T08:00:00+07:00',endsAt:'2026-11-16T09:00:00+07:00',remindAt:'2026-11-16T07:30:00+07:00'},expected:201});
      assert.equal(event.startsAt,'2026-11-16T01:00:00.000Z');assert.equal(event.endsAt,'2026-11-16T02:00:00.000Z');assert.equal(event.remindAt,'2026-11-16T00:30:00.000Z');
      event=await call(`/me/calendar/events/${event.id}`,{method:'PATCH',data:{status:'COMPLETED',startsAt:'2026-11-16T10:00:00+07:00',endsAt:'2026-11-16T11:00:00+07:00'}});assert.equal(event.status,'COMPLETED');assert.equal(event.startsAt,'2026-11-16T03:00:00.000Z');assert.equal(event.endsAt,'2026-11-16T04:00:00.000Z');assert.equal(event.remindAt,'2026-11-16T00:30:00.000Z');
      await call(`/me/calendar/events/${event.id}`,{method:'DELETE'});
      assert.equal((await call('/reports')).summary.achievementCount,1);
      for(const path of [`/achievements/${item.id}/verify`,`/achievements/${item.id}/submit`,'/award-applications','/award-records','/council'])await call(path,{method:'POST',data:{},expected:404});
    });
    await t.test('password change revokes access sessions immediately',async()=>{
      await call('/auth/change-password',{method:'POST',data:{oldPassword:'Testing-Password-42',newPassword:'New-Password-42'}});
      await call('/auth/me',{expected:401});
      await call('/auth/login',{method:'POST',data:{username:`${tag}@example.test`,password:'New-Password-42'}});
      assert.equal((await call('/auth/me')).userId,a.id);
      const oldCookie=a.cookie;await call('/auth/refresh',{method:'POST'});
      await call('/auth/refresh',{method:'POST',session:{cookie:oldCookie},expected:401});
      await call('/auth/me',{expected:401});
    });
  }finally{
    await new Promise(resolve=>server.close(resolve));
    setPool(null);await client.release();await native.end();
    for(const key of createdFiles)await discardFile(key);
  }
});
