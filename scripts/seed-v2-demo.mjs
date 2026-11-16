// Explicit fixture authoring; never imported by application startup.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const args=process.argv.slice(2),database=args.find(x=>x.startsWith('--database='))?.slice(11);
const allowed=/^--(?:database=.+|apply|validate|verify|cleanup|reactivate)$/;
if(!database||!/^[A-Za-z0-9_-]{1,128}$/.test(database)||args.some(x=>!allowed.test(x))) {
 console.error('Usage: node scripts/seed-v2-demo.mjs --database=EXPLICIT_DB [--apply|--validate|--verify|--cleanup|--reactivate]');process.exit(1);
}
const modes=['--apply','--validate','--verify','--cleanup','--reactivate'].filter(x=>args.includes(x));
if(modes.length>1)throw new Error('Choose one operation. Omit operation for a dry-run plan.');
process.env.DB_NAME=database;
const ROOT=fileURLToPath(new URL('../',import.meta.url)),NAMESPACE='DEMO-V2-20261115',DAY='2026-11-15';
const definitions=[
 ['admin','OTHER','Quản trị hệ thống; không được đọc quy chế cá nhân của người khác'],
 ['reg-manager','STAFF','Quản lý quy chế tổ chức toàn hệ thống'],
 ['school-manager','STAFF','Quản lý Trường, đầy đủ quyền cây con'],
 ['faculty-a','LECTURER','Quản lý Khoa A'],['faculty-b','LECTURER','Quản lý Khoa B'],['faculty-c','LECTURER','Quản lý Khoa C'],
 ['viewer','STAFF','Chỉ đọc kết quả Trường; không chạy khám'],['runner','STAFF','Chạy và xem khám Trường; không quản lý quy chế'],
 ['sv-complete','STUDENT','Hồ sơ đủ điều kiện'],['sv-gap','STUDENT','Thiếu 2 giờ → KPI → bổ sung → khám lại đạt'],
 ['sv-unknown','STUDENT','Thiếu thuộc tính giờ hoạt động'],['sv-time','STUDENT','Hoạt động ngoài khoảng xét'],
 ['sv-excluded','STUDENT','Đủ định lượng nhưng vướng điều kiện loại trừ'],['sv-empty','STUDENT','Hồ sơ rỗng có chủ đích'],
 ['lecturer','LECTURER','Không thuộc đối tượng quy chế sinh viên'],['staff','STAFF','Nhân viên trong Khoa C'],
 ['outsider','OTHER','Không thuộc tổ chức; tự tạo quy chế riêng'],['multi','STUDENT','Thành viên hai tổ chức, ghim hai phiên bản'],
 ['former','STUDENT','Đã rời Khoa A'],['invitee','STUDENT','Chưa chấp nhận lời mời'],
 ['other-school','STUDENT','Thành viên Trường khác'],['union-manager','STAFF','Quản lý tổ chức Đoàn/Hội độc lập'],
 ['group-member','STUDENT','Thành viên nhóm độc lập'],['expired','STAFF','Quyền chạy khám đã hết hạn'],
];
const plan={namespace:NAMESPACE,database,demo_date:DAY,accounts:definitions.map(([key,type,purpose])=>({key,email:`${key}@demo-v2.example.test`,person_type:type,purpose})),organizations:14,
 scenarios:['private','internal hierarchy','sibling isolation','pending/accepted/rejected/revoked share','public personal/org adoption','deliberate version update','draft/future/expired','MET','NOT_MET','INSUFFICIENT_DATA','NOT_APPLICABLE','exclusion','history stale','gap KPI journey','empty profile','expired access']};
if(!modes.length){console.log(JSON.stringify({dry_run:true,...plan},null,2));process.exit(0);}

const {Pool,getDbPoolConfig}=await import('../backend/src/config/database.js');
const {insertId}=await import('../backend/src/v2/shared.js');
const {hashPassword}=await import('../backend/src/utils/crypto.js');
const {evaluateVersion}=await import('../backend/src/v2/intelligenceEvaluator.js');
const {canReadVersion,canUseVersion,canManageRegulation,listAccessiblePinnedContexts}=await import('../backend/src/v2/regulationAccess.js');
const {canAccessOrg}=await import('../backend/src/v2/access.js');
const {storageRoot,filePath,validateFile}=await import('../backend/src/v2/files.js');
const {regulationStorageRoot,sourcePath,validateSource,extractSourceText}=await import('../backend/src/v2/regulationSources.js');
const PizZip=createRequire(new URL('../backend/package.json',import.meta.url))('pizzip');
const pool=new Pool(getDbPoolConfig()),client=await pool.connect(),db=client.query.bind(client);
let transaction=false;const written=[];
const json=JSON.stringify,sha=b=>createHash('sha256').update(b).digest(),hash=value=>sha(json(value)).toString('hex');
async function ins(table,values){
 const cols=Object.keys(values),params=Object.values(values),markers=cols.map((_,i)=>`$${i+1}`).join(',');
 if(['person_profiles','cv_achievements','kpi_achievements'].includes(table)){await db(`INSERT app.${table} (${cols.join(',')}) VALUES(${markers})`,params);return null;}
 return insertId(client,table,cols.join(','),markers,params);
}
async function document(text){
 const zip=new PizZip(),xml=v=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 zip.file('word/document.xml',`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${text.split('\n').map(s=>`<w:p><w:r><w:t xml:space="preserve">${xml(s)}</w:t></w:r></w:p>`).join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`);
 return zip.generate({type:'nodebuffer',compression:'DEFLATE'});
}
async function writeFixture(text,source=false){
 const buffer=await document(`DỮ LIỆU DEMO — KHÔNG PHẢI VĂN BẢN/CHỨNG CHỈ THẬT\n${NAMESPACE}\n${text}`);
 const file={buffer,originalname:'du-lieu-demo.docx'},meta=source?validateSource(file):validateFile(file);
 const root=source?regulationStorageRoot:storageRoot,full=source?sourcePath(meta.key):filePath(meta.key);
 await fs.mkdir(root,{recursive:true});await fs.writeFile(full,buffer,{flag:'wx'});written.push(full);
 return {...meta,text:await extractSourceText(buffer,meta.mime)};
}
async function manifest(){const r=(await db("SELECT TOP(1) details_json FROM app.audit_events WHERE action_code IN ('V2_DEMO_SEEDED','V2_DEMO_UPGRADED') AND entity_type='DEMO_FIXTURE' AND entity_id=$1 ORDER BY id DESC",[NAMESPACE])).rows[0];return r?JSON.parse(r.details_json):null;}
async function readInput(subject){const profile=(await db('SELECT user_id,person_type,attributes_json FROM app.person_profiles WHERE user_id=$1',[subject])).rows[0]??null;const achievements=(await db('SELECT id,achievement_type_id,title,description,achieved_at,period_start,period_end,issuer,level_code,attributes_json,updated_at FROM app.achievements WHERE owner_user_id=$1 AND deleted_at IS NULL ORDER BY id',[subject])).rows.map(a=>({...a,attributes:JSON.parse(a.attributes_json)}));return {profile,achievements};}
async function assess(m,key,versionId,expected,label,evaluationDay=DAY,selectedContext=null){
 const subject=m.users[key],input=await readInput(subject),v=(await db('SELECT * FROM app.regulation_versions WHERE id=$1',[versionId])).rows[0];
 const criteria=(await db('SELECT * FROM app.criteria WHERE regulation_version_id=$1 ORDER BY sort_order,id',[versionId])).rows;
 const result=evaluateVersion(v,[],criteria,input.profile,input.achievements,evaluationDay);assert.equal(result.conclusion,expected,`${key}/${label}`);
 const available=(await listAccessiblePinnedContexts(subject,db)).filter(x=>Number(x.regulation_version_id)===Number(versionId));
 const chosen=selectedContext??available[0];assert.ok(chosen,`Seeded assessment needs an accessible context: ${key}/${label}`);
 const context={adoption_id:chosen.adoption_id??null,context_type:chosen.context_type,organization_id:chosen.organization_id??null,member_organization_id:chosen.member_organization_id??null};
 const run=await ins('assessment_runs',{subject_user_id:subject,initiated_by_user_id:subject,regulation_version_id:versionId,evaluation_date:evaluationDay,evaluator_version:'personal-vault-rules/1',input_snapshot_json:json({...input,input_hash:hash(input),context,regulation_version:{...v,criteria,groups:[]}})});
 const results=[];
 for(const r of result.results){
  const id=await ins('criterion_results',{run_id:run,subject_user_id:subject,regulation_version_id:versionId,criterion_id:r.criterion_id,conclusion:r.conclusion,actual_value:r.actual_value,target_value:r.target_value,measure_unit:r.measure_unit,missing_details_json:json(r.missing),criterion_snapshot_json:json(r.criterion),explanation:'DỮ LIỆU DEMO: đối chiếu hồ sơ tự khai, không phải quyết định công nhận.'});
  results.push({id,...r});
  for(const achievement of r.matches)await ins('result_evidence',{criterion_result_id:id,subject_user_id:subject,achievement_id:achievement,achievement_snapshot_json:json(input.achievements.find(a=>Number(a.id)===Number(achievement)))});
 }
 await db("UPDATE app.assessment_runs SET status='COMPLETED',conclusion=$2,completion_percent=$3,explanation=$4,completed_at=SYSUTCDATETIME() WHERE id=$1",[run,result.conclusion,result.completion_percent,'DỮ LIỆU DEMO; chỉ phản ánh dữ liệu tự khai.']);
 m.assessments.push({user:key,label,id:run,version_id:versionId,evaluation_date:evaluationDay,expected,context});return {id:run,results};
}
async function pythonCommand(){
 const candidates=[process.env.V2_DEMO_PYTHON,path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),'python3','python'].filter(Boolean);
 for(const executable of candidates){const probe=spawnSync(executable,['-c','import reportlab, PIL, pypdf'],{encoding:'utf8',windowsHide:true});if(probe.status===0)return executable;}
 throw new Error('PNG/PDF demo generation requires Python with reportlab, pillow, pypdf. Set V2_DEMO_PYTHON to its executable.');
}
async function upgradeRevision2(m){
 if(m.revision>=2)return false;
 const python=await pythonCommand(),pngKey=`${randomUUID()}.png`,pdfKey=`${randomUUID()}.pdf`;
 const png=filePath(pngKey),pdf=filePath(pdfKey);await fs.mkdir(storageRoot,{recursive:true});written.push(png,pdf);
 const generator=String.raw`
import json,sys,os
from PIL import Image,ImageDraw,ImageFont
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader
p=json.load(sys.stdin)
candidates=[os.environ.get('V2_DEMO_FONT',''),r'C:\Windows\Fonts\arial.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
font=next((x for x in candidates if x and os.path.isfile(x)),None)
if not font: raise RuntimeError('Set V2_DEMO_FONT to a Unicode TrueType font')
title='DỮ LIỆU DEMO'
lines=['MINH CHỨNG HOẠT ĐỘNG GIẢ LẬP','Tài khoản demo: sv-gap','Nội dung: bổ sung 2 giờ hoạt động cộng đồng','Ngày hoạt động: 12/11/2026','Không phải chứng nhận thật. Không có giá trị pháp lý.','Namespace: DEMO-V2-20261115']
im=Image.new('RGB',(1400,900),'#f7faf9');d=ImageDraw.Draw(im)
d.rectangle((0,0,1400,155),fill='#153c32')
d.text((80,48),title,font=ImageFont.truetype(font,58),fill='white')
for i,line in enumerate(lines):d.text((80,220+i*85),line,font=ImageFont.truetype(font,32),fill='#153c32')
im.save(p['png'],format='PNG',optimize=False)
pdfmetrics.registerFont(TTFont('DemoUnicode',font))
c=canvas.Canvas(p['pdf'],pagesize=A4,invariant=1)
c.setTitle('DU LIEU DEMO - Minh chung hoat dong gia lap')
c.setFillColorRGB(0.08,0.23,0.19);c.rect(0,690,595,152,fill=1,stroke=0)
c.setFillColorRGB(1,1,1);c.setFont('DemoUnicode',30);c.drawString(45,752,title)
c.setFillColorRGB(0.08,0.23,0.19);c.setFont('DemoUnicode',12)
for i,line in enumerate(lines):c.drawString(45,640-i*52,line)
c.setStrokeColorRGB(0.65,0.75,0.7);c.line(45,250,550,250)
c.setFont('DemoUnicode',10);c.drawString(45,225,'Tệp mô phỏng phục vụ kiểm thử. Không mô phỏng chữ ký hoặc con dấu.')
c.showPage();c.save()
r=PdfReader(p['pdf']);assert len(r.pages)==1;assert 'DỮ LIỆU DEMO' in r.pages[0].extract_text()
with Image.open(p['png']) as check:check.load();assert check.size==(1400,900)
`;
 const result=spawnSync(python,['-c',generator],{input:json({png,pdf}),encoding:'utf8',windowsHide:true});if(result.status!==0)throw new Error(`Demo PDF/PNG generation failed: ${result.stderr}`);
 m.revision2={evidence:[],context_runs:[]};
 for(const [key,full,mime] of [[pngKey,png,'image/png'],[pdfKey,pdf,'application/pdf']]){
  const buffer=await fs.readFile(full),metadata=validateFile({buffer,originalname:`du-lieu-demo.${key.split('.').at(-1)}`});
  const id=await ins('evidence_files',{achievement_id:m.journey.supplement,owner_user_id:m.users['sv-gap'],storage_key:key,original_filename:metadata.name,mime_type:mime,byte_size:buffer.length,sha256:sha(buffer)});
  m.files.push({kind:'evidence',format:key.endsWith('.png')?'PNG':'PDF',key,sha256:sha(buffer).toString('hex'),achievement_id:m.journey.supplement});m.revision2.evidence.push(id);
 }
 for(const [user,versionKey,type,label] of [['multi','public_v2','PERSONAL','explicit-personal-v2'],['multi','public_v1','ORGANIZATION','explicit-organization-v1'],['sv-gap','school_v1','ORGANIZATION','context-after-supplement']]){
  const context=(await listAccessiblePinnedContexts(m.users[user],db)).find(c=>Number(c.regulation_version_id)===Number(m.versions[versionKey])&&c.context_type===type);assert.ok(context,`Missing ${label} context`);
  const run=await assess(m,user,m.versions[versionKey],'MET',label,DAY,context);m.revision2.context_runs.push(run.id);
 }
 m.revision=2;return true;
}
async function upgradeRevision3(m){
 if(m.revision>=3)return false;
 const sourcesDir=path.join(ROOT,'database/sqlserver/v2/sources');
 const registry=JSON.parse(await fs.readFile(path.join(sourcesDir,'source-register.json'),'utf8'));
 const entry=registry.entries.find(e=>e.id==='lhu-nien-giam-2025');assert.ok(entry,'Registered school source required');
 const buffer=await fs.readFile(path.join(sourcesDir,entry.file));assert.equal(sha(buffer).toString('hex'),entry.sha256);assert.equal(buffer.length,entry.byteSize);
 const probe=spawnSync(await pythonCommand(),['-c',"import sys;from pypdf import PdfReader;r=PdfReader(sys.argv[1]);assert len(r.pages)>0",path.join(sourcesDir,entry.file)],{encoding:'utf8',windowsHide:true});assert.equal(probe.status,0,`Readable school PDF: ${probe.stderr}`);
 const metadata=validateSource({buffer,originalname:entry.file}),full=sourcePath(metadata.key);await fs.mkdir(regulationStorageRoot,{recursive:true});await fs.writeFile(full,buffer,{flag:'wx'});written.push(full);
 let text=null,error=null;try{text=await extractSourceText(buffer,metadata.mime);}catch(e){error=`Cần OCR/đọc thủ công PDF gốc: ${e.message}`;}
 const key='official-lhu-reference-2025',reg=await ins('regulations',{code:`${NAMESPACE}-${key}`,name:'[THAM CHIẾU LỊCH SỬ 2025] Niên giám sinh viên — Đại học Lạc Hồng',description:entry.coverage,created_by_user_id:m.users['school-manager'],owner_type:'ORGANIZATION',owner_organization_id:m.organizations.school,is_internal:false,is_public:true});
 m.regulations[key]=reg;m.public_regulations.push(key);
 const coverage={automated:[],manual:['Đọc niên giám 2025 và đối chiếu khóa/ngành, văn bản hiện hành trước khi công nhận'],unsupported:[entry.coverage],source_register_id:entry.id,legal_status:entry.status};
 const v=await ins('regulation_versions',{regulation_id:reg,version_label:'reference-only-2025',effective_from:'2025-01-01',effective_to:'2025-12-31',source_title:'Niên giám sinh viên 2025 — chỉ tham khảo lịch sử',source_url:entry.url,applicability_json:json({person_types:['STUDENT']}),source_kind:'OFFICIAL',issuing_authority:entry.issuer,collected_at:entry.collectedAt,coverage_json:json(coverage),created_by_user_id:m.users['school-manager']});
 await ins('regulation_source_files',{regulation_version_id:v,owner_user_id:m.users['school-manager'],storage_key:metadata.key,original_filename:entry.file,mime_type:metadata.mime,byte_size:buffer.length,sha256:sha(buffer),source_url:entry.url,collected_at:entry.collectedAt,issuing_authority:entry.issuer,is_demo:false,extracted_text:text,extraction_status:text?'EXTRACTED':'FAILED',extraction_error:error});
 await ins('criteria',{regulation_version_id:v,code:'LHU_REFERENCE_ONLY',title:'Đọc và đối chiếu thủ công niên giám 2025; chưa tự động kết luận đủ điều kiện',rule_json:json({type:'count',target:0}),source_reference:'Toàn văn niên giám sinh viên 2025 — tham khảo lịch sử, không khẳng định hiệu lực hiện hành',coverage_status:'UNSUPPORTED',sort_order:0,provenance_json:json({source_id:entry.id,url:entry.url,sha256:entry.sha256,issuer:entry.issuer,coverage:entry.coverage})});
 await db("UPDATE app.regulation_versions SET publication_status='PUBLISHED',published_at=SYSUTCDATETIME(),published_by_user_id=$2 WHERE id=$1",[v,m.users['school-manager']]);
 await ins('regulation_adoptions',{regulation_id:reg,regulation_version_id:v,user_id:m.users.multi,source_type:'PUBLIC',adopted_by_user_id:m.users.multi});
 m.files.push({kind:'source',official:true,key:metadata.key,sha256:entry.sha256,version_id:v});m.official_sources.push({...entry,version_id:v});m.versions[entry.id]=v;
 const run=await assess(m,'multi',v,'INSUFFICIENT_DATA','official-lhu-reference-only','2025-11-01');
 m.revision3={school_reference_version:v,reference_run:run.id,extracted_text:Boolean(text)};m.revision=3;return true;
}
async function historicalIntegrity(versionId,runIds){
 const version=(await db('SELECT * FROM app.regulation_versions WHERE id=$1',[versionId])).rows;
 const sources=(await db('SELECT * FROM app.regulation_source_files WHERE regulation_version_id=$1 ORDER BY id',[versionId])).rows;
 const criteria=(await db('SELECT * FROM app.criteria WHERE regulation_version_id=$1 ORDER BY id',[versionId])).rows;
 const runs=[];for(const id of runIds)runs.push((await db('SELECT * FROM app.assessment_runs WHERE id=$1',[id])).rows[0]);
 return hash({version,sources,criteria,runs});
}
async function upgradeRevision4(m){
 if(m.revision>=4)return false;
 const sourcesDir=path.join(ROOT,'database/sqlserver/v2/sources'),registry=JSON.parse(await fs.readFile(path.join(sourcesDir,'source-register.json'),'utf8'));
 const entry=registry.entries.find(e=>e.id==='moet-08-2021'),replacement=registry.entries.find(e=>e.id===entry.replacedBy);
 assert.equal(entry.assessmentTo,'2026-07-06');assert.equal(replacement.importToPrivateStorage,false);
 const previous=m.versions['moet-08-2021'],runIds=m.assessments.map(r=>r.id),preserved=await historicalIntegrity(previous,runIds);
 const reg=m.regulations['official-gov-reference'],buffer=await fs.readFile(path.join(sourcesDir,entry.file));assert.equal(sha(buffer).toString('hex'),entry.sha256);assert.equal(buffer.length,entry.byteSize);
 const metadata=validateSource({buffer,originalname:entry.file}),full=sourcePath(metadata.key);await fs.writeFile(full,buffer,{flag:'wx'});written.push(full);
 const oldSource=(await db('SELECT * FROM app.regulation_source_files WHERE regulation_version_id=$1',[previous])).rows[0];
 const provenance={source_id:entry.id,url:entry.url,sha256:entry.sha256,issuer:entry.issuer,coverage:entry.coverage,correction:registry.entries.find(e=>e.id===entry.correctionId),replacement,verification_urls:entry.verificationUrls,reviewed_by:'explicit demo seed revision 4 source audit'};
 const v=await ins('regulation_versions',{regulation_id:reg,version_label:'historical-until-2026-07-06',effective_from:entry.effectiveFrom,effective_to:entry.assessmentTo,source_title:'[LỊCH SỬ] Thông tư 08/2021 — đã thay thế từ 07/07/2026',source_url:entry.url,applicability_json:json({person_types:['STUDENT']}),source_kind:'OFFICIAL',issuing_authority:entry.issuer,collected_at:entry.collectedAt,coverage_json:json({automated:[],manual:['Đối chiếu quy định lịch sử, khóa tuyển sinh và điều khoản chuyển tiếp'],unsupported:[entry.coverage],source_register_id:entry.id,legal_status:entry.status,correction_id:entry.correctionId,replacement}),created_by_user_id:m.users['school-manager']});
 await ins('regulation_source_files',{regulation_version_id:v,owner_user_id:m.users['school-manager'],storage_key:metadata.key,original_filename:entry.file,mime_type:metadata.mime,byte_size:buffer.length,sha256:sha(buffer),source_url:entry.url,collected_at:entry.collectedAt,issuing_authority:entry.issuer,is_demo:false,extracted_text:oldSource.extracted_text,extraction_status:oldSource.extraction_status,extraction_error:oldSource.extraction_error});
 await ins('criteria',{regulation_version_id:v,code:'HISTORICAL_REFERENCE_ONLY',title:'Tham khảo lịch sử đến 06/07/2026; chưa hỗ trợ kết luận tốt nghiệp',rule_json:json({type:'count',target:0}),coverage_status:'UNSUPPORTED',source_reference:'Thông tư 08/2021, đính chính 2024; Điều 2 Thông tư 56/2026 thay thế từ 07/07/2026',sort_order:0,provenance_json:json(provenance)});
 await db("UPDATE app.regulation_versions SET publication_status='PUBLISHED',published_at=SYSUTCDATETIME(),published_by_user_id=$2 WHERE id=$1",[v,m.users['school-manager']]);
 const adoption=(await db('SELECT id,regulation_version_id FROM app.regulation_adoptions WHERE regulation_id=$1 AND user_id=$2',[reg,m.users.multi])).rows[0];assert.equal(Number(adoption.regulation_version_id),previous);
 await db('UPDATE app.regulation_adoptions SET regulation_version_id=$2,adopted_by_user_id=$3,updated_at=SYSUTCDATETIME() WHERE id=$1',[adoption.id,v,m.users.multi]);
 await db('UPDATE app.regulations SET is_public=0,name=$2,description=$3 WHERE id=$1',[reg,'[LỊCH SỬ ĐÃ THAY THẾ 07/07/2026] Thông tư 08/2021/TT-BGDĐT',entry.coverage]);m.public_regulations=m.public_regulations.filter(k=>k!=='official-gov-reference');
 m.files.push({kind:'source',official:true,key:metadata.key,sha256:entry.sha256,version_id:v});m.official_sources.push({...entry,version_id:v});m.versions['moet-08-2021-historical']=v;
 const run=await assess(m,'multi',v,'INSUFFICIENT_DATA','official-gov-bounded-historical','2025-11-15');
 m.revision4={previous_version:previous,bounded_version:v,adoption_id:Number(adoption.id),historical_run:run.id,preserved_run_ids:runIds,preserved_sha256:preserved,replacement_reference:replacement};m.revision=4;
 assert.equal(await historicalIntegrity(previous,runIds),preserved,'All pre-upgrade official metadata and assessment histories remain immutable');return true;
}
async function verify(m){
 assert.equal(m.database,database);assert.equal(Object.keys(m.users).length,24);assert.equal(Object.keys(m.organizations).length,14);
 const findings=[];async function check(label,value){assert.ok(value,label);findings.push(label);}
 for(const row of m.assessments){const r=(await db('SELECT conclusion,input_snapshot_json,regulation_version_id FROM app.assessment_runs WHERE id=$1',[row.id])).rows[0];await check(`assessment ${row.user}/${row.label}: ${row.expected}`,r?.conclusion===row.expected&&Number(r.regulation_version_id)===row.version_id);const snap=JSON.parse(r.input_snapshot_json);await check(`snapshot ${row.id}`,Boolean(snap.input_hash&&snap.regulation_version&&Array.isArray(snap.achievements)));if(row.context)await check(`explicit pinned context ${row.id}`,json(snap.context)===json(row.context)&&Boolean(snap.context.context_type));}
 for(const f of m.files){const full=f.kind==='source'?sourcePath(f.key):filePath(f.key),b=await fs.readFile(full);await check(`file SHA256 ${f.key}`,sha(b).toString('hex')===f.sha256);if(f.official){await check(`official PDF signature ${f.key}`,b.subarray(0,5).toString()==='%PDF-');}else if(f.format){
  const probe=spawnSync(await pythonCommand(),['-c',f.format==='PNG'?"import sys;from PIL import Image;im=Image.open(sys.argv[1]);im.load();assert im.size==(1400,900);assert im.getpixel((1,1))!=im.getpixel((1,899))":"import sys;from pypdf import PdfReader;r=PdfReader(sys.argv[1]);assert len(r.pages)==1;assert 'DỮ LIỆU DEMO' in r.pages[0].extract_text()",full],{encoding:'utf8',windowsHide:true});await check(`real ${f.format} decoding ${f.key}`,probe.status===0);
 }else{const text=await extractSourceText(b,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');await check(`openable demo label ${f.key}`,text.includes('DỮ LIỆU DEMO'));}}
 await check('owner reads personal',await canReadVersion(m.users.outsider,m.versions.personal,db));
 for(const u of ['admin','sv-complete','school-manager'])await check(`${u} cannot read personal`,!await canReadVersion(m.users[u],m.versions.personal,db));
 await check('school tree inherits v1',await canUseVersion(m.users['sv-complete'],m.versions.school_v1,db));
 await check('school v2 is not automatically used',!await canUseVersion(m.users['sv-complete'],m.versions.school_v2,db));
 await check('sibling private rule hidden',!await canReadVersion(m.users['faculty-b'],m.versions.faculty_a,db));
 await check('membership does not manage rule',!await canManageRegulation(m.users['sv-complete'],m.regulations.school,db));
 await check('pending share not inherited',!await canUseVersion(m.users['group-member'],m.versions.shared,db));
 await check('accepted share inherited',await canUseVersion(m.users['union-manager'],m.versions.shared,db));
 await check('rejected share not inherited',!await canUseVersion(m.users['other-school'],m.versions.shared,db));
 await check('personal public adoption does not apply to org',!await canUseVersion(m.users['other-school'],m.versions.public_v2,db));
 await check('former member no inheritance',!await canUseVersion(m.users.former,m.versions.school_v1,db));
 await check('pending membership no inheritance',!await canUseVersion(m.users.invitee,m.versions.school_v1,db));
 await check('empty account has zero achievements',Number((await db('SELECT COUNT(*) AS n FROM app.achievements WHERE owner_user_id=$1',[m.users['sv-empty']])).rows[0].n)===0);
 const before=(await db('SELECT input_snapshot_json FROM app.assessment_runs WHERE id=$1',[m.journey.before])).rows[0];
 await check('journey old history stale after supplementary achievement',JSON.parse(before.input_snapshot_json).input_hash!==hash(await readInput(m.users['sv-gap'])));
 const after=(await db('SELECT input_snapshot_json FROM app.assessment_runs WHERE id=$1',[m.journey.after])).rows[0];
 await check('journey latest history current',JSON.parse(after.input_snapshot_json).input_hash===hash(await readInput(m.users['sv-gap'])));
 await check('gap KPI linked to exact owned result',(await db('SELECT id FROM app.kpi_goals WHERE id=$1 AND source_result_id=$2 AND owner_user_id=$3',[m.journey.goal,m.journey.result,m.users['sv-gap']])).rows.length===1);
 await check('viewer cannot run assessments',!await canAccessOrg(m.users.viewer,m.organizations.school,'ASSESSMENTS_RUN',db));
 await check('runner can run assessments',await canAccessOrg(m.users.runner,m.organizations.school,'ASSESSMENTS_RUN',db));
 await check('expired grant cannot run assessments',!await canAccessOrg(m.users.expired,m.organizations.school,'ASSESSMENTS_RUN',db));
 for(const [key,status,from,to] of [['draft','DRAFT','2026-01-01','2026-12-31'],['future','PUBLISHED','2027-01-01','2027-12-31'],['expired','PUBLISHED','2025-01-01','2025-12-31']]){const row=(await db('SELECT publication_status,effective_from,effective_to FROM app.regulation_versions WHERE id=$1',[m.versions[key]])).rows[0];await check(`${key} timing fixture`,row.publication_status===status&&row.effective_from===from&&row.effective_to===to);}
 if(m.official_sources)for(const source of m.official_sources){const row=(await db('SELECT v.source_kind,v.issuing_authority,s.sha256 FROM app.regulation_versions v JOIN app.regulation_source_files s ON s.regulation_version_id=v.id WHERE v.id=$1',[source.version_id])).rows[0];await check(`verified origin ${source.id}`,row.source_kind==='OFFICIAL'&&row.issuing_authority===source.issuer&&row.sha256.toString('hex')===source.sha256);}
 if(m.revision>=3){
  const v=m.revision3.school_reference_version,entry=m.official_sources.find(s=>s.id==='lhu-nien-giam-2025');
  const row=(await db('SELECT v.*,r.owner_organization_id,s.source_url AS file_url,s.issuing_authority AS file_issuer,s.extracted_text,s.extraction_status FROM app.regulation_versions v JOIN app.regulations r ON r.id=v.regulation_id JOIN app.regulation_source_files s ON s.regulation_version_id=v.id WHERE v.id=$1',[v])).rows[0];
  const coverage=JSON.parse(row.coverage_json),criteria=(await db('SELECT coverage_status FROM app.criteria WHERE regulation_version_id=$1',[v])).rows;
  await check('school original issuer separated from demo owner',row.issuing_authority==='Trường Đại học Lạc Hồng'&&row.file_issuer===row.issuing_authority&&Number(row.owner_organization_id)===m.organizations.school);
  await check('school reference source URL linked',row.source_url===entry.url&&row.file_url===entry.url);
  await check('school source historical scope only',row.effective_from==='2025-01-01'&&row.effective_to==='2025-12-31'&&coverage.legal_status==='REFERENCE_ONLY_2025');
  await check('school source has no automated eligibility',criteria.length===1&&criteria[0].coverage_status==='UNSUPPORTED'&&coverage.automated.length===0&&coverage.manual.length>0);
  await check('school source extraction stored honestly',m.revision3.extracted_text?row.extraction_status==='EXTRACTED'&&Boolean(row.extracted_text):row.extraction_status==='FAILED');
  const f=m.files.find(f=>f.version_id===v),probe=spawnSync(await pythonCommand(),['-c',"import sys;from pypdf import PdfReader;r=PdfReader(sys.argv[1]);assert len(r.pages)>0",sourcePath(f.key)],{encoding:'utf8',windowsHide:true});await check('school original PDF opens with pypdf',probe.status===0);
 }
 if(m.revision>=4){
  const r=m.revision4,row=(await db('SELECT v.effective_from,v.effective_to,v.coverage_json,r.is_public,r.name FROM app.regulation_versions v JOIN app.regulations r ON r.id=v.regulation_id WHERE v.id=$1',[r.bounded_version])).rows[0],coverage=JSON.parse(row.coverage_json);
  await check('08 historical scope ends before replacement',row.effective_from==='2021-05-03'&&row.effective_to==='2026-07-06'&&DAY>row.effective_to);
  await check('08 replaced document removed from public discovery',!row.is_public&&row.name.includes('07/07/2026')&&!m.public_regulations.includes('official-gov-reference'));
  const pin=(await db('SELECT regulation_version_id FROM app.regulation_adoptions WHERE id=$1',[r.adoption_id])).rows[0];await check('operator explicitly moved historical personal pin',Number(pin.regulation_version_id)===r.bounded_version);
  await check('multi uses bounded historical pin',await canUseVersion(m.users.multi,r.bounded_version,db));
  await check('multi cannot reuse former unbounded pin',!await canUseVersion(m.users.multi,r.previous_version,db));
  await check('08 preserved published source and every old run hash',await historicalIntegrity(r.previous_version,r.preserved_run_ids)===r.preserved_sha256);
  await check('08 replacement and correction provenance retained',coverage.replacement.id==='moet-56-2026'&&coverage.replacement.effectiveFrom==='2026-07-07'&&coverage.correction_id==='moet-08-2021-correction'&&coverage.automated.length===0);
  await check('oversized replacement is research only',r.replacement_reference.importToPrivateStorage===false&&r.replacement_reference.byteSize>10*1024*1024&&!m.official_sources.some(s=>s.id==='moet-56-2026'));
  await check('oversized replacement not imported in demo source rows',Number((await db('SELECT COUNT(*) AS n FROM app.regulation_source_files s JOIN app.users u ON u.id=s.owner_user_id WHERE u.email LIKE $1 AND s.sha256=$2',['%@demo-v2.example.test',Buffer.from(r.replacement_reference.sha256,'hex')])).rows[0].n)===0);
 }
 const counts={accounts:0,organizations:0,regulations:0,versions:0,achievements:0,source_files:0,evidence_files:0,assessments:0,goals:0,cvs:0};
 counts.accounts=Number((await db('SELECT COUNT(*) AS n FROM app.users WHERE email LIKE $1',['%@demo-v2.example.test'])).rows[0].n);
 counts.organizations=Number((await db('SELECT COUNT(*) AS n FROM app.organizations WHERE code LIKE $1',[`${NAMESPACE}-%`])).rows[0].n);
 counts.regulations=Number((await db('SELECT COUNT(*) AS n FROM app.regulations WHERE code LIKE $1',[`${NAMESPACE}-%`])).rows[0].n);
 for(const [name,table,field] of [['versions','regulation_versions','created_by_user_id'],['achievements','achievements','owner_user_id'],['source_files','regulation_source_files','owner_user_id'],['evidence_files','evidence_files','owner_user_id'],['assessments','assessment_runs','subject_user_id'],['goals','kpi_goals','owner_user_id'],['cvs','cvs','owner_user_id']])counts[name]=Number((await db(`SELECT COUNT(*) AS n FROM app.${table} t JOIN app.users u ON u.id=t.${field} WHERE u.email LIKE $1`,['%@demo-v2.example.test'])).rows[0].n);
 return {verified:true,database,revision:m.revision??1,demo_date:DAY,checks:findings.length,counts,findings};
}

try {
 assert.equal((await db('SELECT DB_NAME() AS name')).rows[0].name,database,'Explicit target mismatch');
 const migration=(await db("SELECT name FROM app._schema_migrations WHERE name='004_distribution_integrity.sql'")).rows;assert.equal(migration.length,1,'Apply current V2 migrations first.');
 const existing=await manifest();
 if(modes[0]==='--verify'){assert.ok(existing,'No demo fixture registered for this database.');console.log(json(await verify(existing)));}
 else if(modes[0]==='--cleanup'||modes[0]==='--reactivate'){
  assert.ok(existing,'No scoped demo fixture to update.');await db('BEGIN');transaction=true;
  const cleanup=modes[0]==='--cleanup';
  for(const [key,id] of Object.entries(existing.users)){
   const row=(await db('SELECT email FROM app.users WHERE id=$1',[id])).rows[0];assert.equal(row?.email,`${key}@demo-v2.example.test`,'Manifest ownership mismatch');
   await db('UPDATE app.users SET account_status=$2 WHERE id=$1',[id,cleanup?'DISABLED':'ACTIVE']);
  }
  for(const id of Object.values(existing.organizations))await db('UPDATE app.organizations SET status=$2 WHERE id=$1 AND code LIKE $3',[id,cleanup?'ARCHIVED':'ACTIVE',`${NAMESPACE}-%`]);
  for(const [key,id] of Object.entries(existing.regulations))await db('UPDATE app.regulations SET is_public=$2 WHERE id=$1 AND code LIKE $3',[id,!cleanup&&(existing.public_regulations??['public']).includes(key)?1:0,`${NAMESPACE}-%`]);
  for(const cv of existing.cvs)await db('UPDATE app.cvs SET publication_status=$2,published_at=CASE WHEN $2=\'PUBLIC\' THEN SYSUTCDATETIME() ELSE NULL END WHERE id=$1 AND owner_user_id=$3',[cv.id,!cleanup&&cv.public?'PUBLIC':'PRIVATE',existing.users[cv.user]]);
  await ins('audit_events',{actor_user_id:existing.users.admin,action_code:cleanup?'V2_DEMO_DEACTIVATED':'V2_DEMO_REACTIVATED',entity_type:'DEMO_FIXTURE',entity_id:NAMESPACE,details_json:json({database,logical_cleanup:true})});
  await db('COMMIT');transaction=false;console.log(json({database,namespace:NAMESPACE,operation:modes[0],immutable_history_preserved:true}));
 }
 else if(existing){
  let current=existing,upgraded=false;
  if((existing.revision??1)<4){
   await db('BEGIN');transaction=true;
   await db("DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=$1,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000; IF @r<0 THROW 51030,'Could not lock demo seed upgrade.',1;",[NAMESPACE]);
   current=await manifest();const revision2=await upgradeRevision2(current),revision3=await upgradeRevision3(current),revision4=await upgradeRevision4(current);upgraded=revision2||revision3||revision4;const report=await verify(current);
   if(upgraded)await ins('audit_events',{actor_user_id:current.users.admin,action_code:'V2_DEMO_UPGRADED',entity_type:'DEMO_FIXTURE',entity_id:NAMESPACE,details_json:json(current)});
   if(modes[0]==='--validate'){console.log(json({already_seeded:true,upgraded,rollback_only:true,...report}));}
   else{await db('COMMIT');transaction=false;const output=path.join(ROOT,'backend/storage/demo-v2',`${database}.manifest.json`);await fs.writeFile(output,json(current));console.log(json({already_seeded:true,upgraded,...report}));}
  }else console.log(json({already_seeded:true,...await verify(current)}));
 }
 else {
  await db('BEGIN');transaction=true;
  await db("DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=$1,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000; IF @r<0 THROW 51030,'Could not lock demo seed.',1;",[NAMESPACE]);
  assert.equal(await manifest(),null,'Concurrent seed completed; rerun to verify existing fixture.');
  assert.equal((await db("SELECT id FROM app.users WHERE email LIKE '%@demo-v2.example.test'")).rows.length,0,'Reserved demo emails already exist without seed manifest; refusing to modify them.');
  const m={...plan,users:{},organizations:{},regulations:{},versions:{},assessments:[],files:[],cvs:[],journey:{},public_regulations:[],official_sources:[]};
  const password=process.env.V2_DEMO_PASSWORD||'Demo-V2-2026!',password_hash=await hashPassword(password);
  for(const [key,type,purpose] of definitions){const uid=await ins('users',{email:`${key}@demo-v2.example.test`,password_hash,email_verified_at:'2026-01-01'});m.users[key]=uid;await ins('person_profiles',{user_id:uid,full_name:`[DEMO] ${key}`,person_type:type,headline:purpose,attributes_json:json({demo_namespace:NAMESPACE,purpose})});}
  for(const [key,role] of [['admin','SYSTEM_ADMIN'],['reg-manager','REGULATION_MANAGER']])await ins('global_role_grants',{user_id:m.users[key],role_code:role,valid_from:'2026-01-01',granted_by_user_id:m.users.admin});
  async function org(key,type,parent=null){const id=await ins('organizations',{code:`${NAMESPACE}-${key}`,name:`[DEMO] ${key}`,organization_type:type,parent_id:parent,created_by_user_id:m.users['school-manager']});m.organizations[key]=id;return id;}
  const school=await org('school','UNIVERSITY');for(const letter of ['a','b','c']){const f=await org(`faculty-${letter}`,'FACULTY',school);for(const n of [1,2])await org(`class-${letter}${n}`,'CLASS',f);}
  await org('other-school','UNIVERSITY');await org('union','OTHER');await org('group','TEAM');await org('external-team','TEAM');
  async function membership(key,orgKey,status='ACTIVE'){
   const uid=m.users[key],oid=m.organizations[orgKey],pending=status==='PENDING';
   const invitation=await ins('membership_invitations',{organization_id:oid,invitee_user_id:uid,invited_by_user_id:m.users['school-manager'],status:pending?'PENDING':'ACCEPTED',created_at:'2025-01-01',expires_at:'2099-01-01',responded_at:pending?null:'2025-01-02',responded_by_user_id:pending?null:uid});
   if(!pending)await ins('memberships',{organization_id:oid,user_id:uid,invitation_id:invitation,valid_from:'2025-01-02',valid_to:status==='FORMER'?'2026-01-01':null});
  }
  const memberships={'school-manager':'school','faculty-a':'faculty-a','faculty-b':'faculty-b','faculty-c':'faculty-c',viewer:'school',runner:'school','sv-complete':'class-a1','sv-gap':'class-a1','sv-unknown':'class-a2','sv-time':'class-b1','sv-excluded':'class-b1','sv-empty':'class-b2',lecturer:'faculty-b',staff:'faculty-c',multi:'class-c1','other-school':'other-school','union-manager':'union','group-member':'group',expired:'school'};
  for(const [key,where] of Object.entries(memberships))await membership(key,where);await membership('multi','other-school');await membership('former','class-a1','FORMER');await membership('invitee','class-a2','PENDING');
  const allPermissions=['MEMBERS_VIEW','ASSESSMENTS_VIEW','ASSESSMENTS_RUN','MEMBERS_NOTIFY','MEMBERS_MANAGE','STRUCTURE_MANAGE','ACCESS_MANAGE','REGULATIONS_CREATE','REGULATIONS_MANAGE','REGULATIONS_PUBLISH','REGULATIONS_SHARE','REGULATIONS_ADOPT','REGULATIONS_UPDATE'];
  async function grants(key,where,permissions,expired=false){for(const permission_code of permissions)await ins('org_access_grants',{organization_id:m.organizations[where],user_id:m.users[key],permission_code,include_descendants:true,granted_by_user_id:m.users.admin,valid_from:'2025-01-01',valid_to:expired?'2026-01-01':null});}
  await grants('school-manager','school',allPermissions);for(const l of ['a','b','c'])await grants(`faculty-${l}`,`faculty-${l}`,allPermissions);
  await grants('viewer','school',['MEMBERS_VIEW','ASSESSMENTS_VIEW']);await grants('runner','school',['ASSESSMENTS_VIEW','ASSESSMENTS_RUN']);await grants('union-manager','union',allPermissions);await grants('expired','school',['ASSESSMENTS_VIEW','ASSESSMENTS_RUN'],true);
  const type=await ins('achievement_types',{code:`${NAMESPACE}-ACTIVITY`,name:'[DEMO] Thành tích đa dạng',attribute_schema_json:json({demo:true,properties:{category:{type:'string'},hours:{type:'number'}}})});
  async function achievement(key,category,attributes={},date='2026-10-01',evidence=true,deleted=false){
   const id=await ins('achievements',{owner_user_id:m.users[key],achievement_type_id:type,title:`[DỮ LIỆU DEMO] ${category} — ${key}`,description:'Minh họa nghiệp vụ, không phải thành tích hay chứng nhận thật.',achieved_at:date,issuer:'[DEMO] Đơn vị cấp mô phỏng',level_code:'DEMO',attributes_json:json({category,...attributes})});
   if(deleted)await db('UPDATE app.achievements SET deleted_at=SYSUTCDATETIME() WHERE id=$1',[id]);
   if(evidence){const f=await writeFixture(`Minh chứng giả lập cho ${key}: ${category}.\nNgày thành tích: ${date}. Không có giá trị chứng nhận.`);await ins('evidence_files',{achievement_id:id,owner_user_id:m.users[key],storage_key:f.key,original_filename:f.name,mime_type:f.mime,byte_size:f.size,sha256:f.hash});m.files.push({kind:'evidence',key:f.key,sha256:f.hash.toString('hex'),achievement_id:id});}return id;
  }
  for(const [key] of definitions){if(key==='sv-empty')continue;
   const hours=key==='sv-gap'?4:6,attrs=key==='sv-unknown'?{}:{hours};
   await achievement(key,'activity',attrs,key==='sv-time'?'2024-10-01':'2026-10-01');
   await achievement(key,'activity',attrs,key==='sv-time'?'2024-11-01':'2026-10-15',false);
   await achievement(key,'language',{score:6.5},'2025-06-01',false);
   if(['sv-complete','sv-gap','sv-excluded','multi'].includes(key)){await achievement(key,'research',{papers:1},'2026-09-01',false);await achievement(key,'award',{rank:2},'2026-04-01',false);await achievement(key,'professional',{score:85},'2023-01-01',false);}
   if(key==='sv-excluded')await achievement(key,'discipline',{severity:'HIGH'},'2026-02-01',false);
  }
  await achievement('sv-complete','activity',{hours:99},'2026-10-01',true,true);
  const standard=[{code:'ACTIVITIES',title:'Ít nhất hai hoạt động trong năm xét',rule:{type:'count',target:2,from:'2026-01-01',to:'2026-12-31',filters:[{field:'attributes.category',operator:'eq',value:'activity'}]}},{code:'HOURS',title:'Ít nhất mười giờ hoạt động trong năm xét',rule:{type:'sum',field:'attributes.hours',target:10,from:'2026-01-01',to:'2026-12-31',measure_unit:'giờ',filters:[{field:'attributes.category',operator:'eq',value:'activity'}]}},{code:'EXCLUSION',title:'Không có kỷ luật mức cao',is_exclusion:true,rule:{type:'boolean',target:1,filters:[{field:'attributes.category',operator:'eq',value:'discipline'}]}}];
  async function regulation(key,ownerOrg=null,options={}){const id=await ins('regulations',{code:`${NAMESPACE}-${key}`,name:`[DỮ LIỆU DEMO] ${key}`,description:'Quy chế tự đặt để kiểm thử; không mạo nhận là văn bản chính thức.',created_by_user_id:m.users[ownerOrg?'school-manager':'outsider'],owner_type:ownerOrg?'ORGANIZATION':'PERSONAL',owner_user_id:ownerOrg?null:m.users.outsider,owner_organization_id:ownerOrg?m.organizations[ownerOrg]:null,is_internal:Boolean(options.internal),is_public:Boolean(options.public)});m.regulations[key]=id;if(options.public)m.public_regulations.push(key);return id;}
  async function version(key,reg,label='v1',options={}){
   const criteria=options.criteria??standard,sourceText=`Quy chế giả lập ${key}; phiên bản ${label}.\nĐối tượng: sinh viên.\n${criteria.map((c,i)=>`Điều ${i+1}: ${c.title}.`).join('\n')}\nPhần đánh giá thủ công: chưa cấu hình công nhận chính thức.\nPhần chưa hỗ trợ: xác thực chứng chỉ từ đơn vị cấp.`;
   const v=await ins('regulation_versions',{regulation_id:reg,version_label:label,effective_from:options.from??'2026-01-01',effective_to:options.to??'2026-12-31',source_title:`[DỮ LIỆU DEMO] Quy chế ${key}`,applicability_json:json({person_types:['STUDENT']}),created_by_user_id:m.users['school-manager'],source_kind:'DEMO',issuing_authority:'Tổ biên soạn dữ liệu demo — không phải cơ quan ban hành thật',collected_at:'2026-11-15',coverage_json:json({automated:criteria.map(c=>c.title),manual:['Công nhận chính thức do người có thẩm quyền'],unsupported:['Xác thực chứng chỉ từ đơn vị cấp']})});
   const f=await writeFixture(sourceText,true);await ins('regulation_source_files',{regulation_version_id:v,owner_user_id:m.users['school-manager'],storage_key:f.key,original_filename:f.name,mime_type:f.mime,byte_size:f.size,sha256:f.hash,issuing_authority:'DỮ LIỆU DEMO',is_demo:true,collected_at:'2026-11-15',extracted_text:f.text,extraction_status:'EXTRACTED'});m.files.push({kind:'source',key:f.key,sha256:f.hash.toString('hex'),version_id:v});
   for(const [i,c] of criteria.entries())await ins('criteria',{regulation_version_id:v,code:c.code,title:c.title,rule_json:json(c.rule),source_reference:`Điều ${i+1} — văn bản giả lập ${key}`,is_exclusion:Boolean(c.is_exclusion),sort_order:i,provenance_json:json({kind:'DEMO',source_file_sha256:f.hash.toString('hex'),article:`Điều ${i+1}`,reviewed_by:'demo-author'})});
   if(!options.draft)await db("UPDATE app.regulation_versions SET publication_status='PUBLISHED',published_at=SYSUTCDATETIME(),published_by_user_id=$2 WHERE id=$1",[v,m.users['school-manager']]);m.versions[key]=v;return v;
  }
  async function adopt(reg,v,orgKey=null,userKey=null,source='PUBLIC',share=null){return ins('regulation_adoptions',{regulation_id:reg,regulation_version_id:v,organization_id:orgKey?m.organizations[orgKey]:null,user_id:userKey?m.users[userKey]:null,source_type:source,share_id:share,adopted_by_user_id:m.users['school-manager']});}
  const schoolReg=await regulation('school','school',{internal:true}),sv1=await version('school_v1',schoolReg);await adopt(schoolReg,sv1,'school',null,'OWNED');await version('school_v2',schoolReg,'v2',{criteria:standard.map(c=>c.code==='HOURS'?{...c,rule:{...c.rule,target:12}}:c)});
  const facultyReg=await regulation('faculty_a','faculty-a',{internal:true});await adopt(facultyReg,await version('faculty_a',facultyReg),'faculty-a',null,'OWNED');
  const personalReg=await regulation('personal');await version('personal',personalReg,'v1',{criteria:[{code:'PERSONAL',title:'Tự đặt: ít nhất một thành tích',rule:{type:'count',target:1}}]});
  const pub=await regulation('public','school',{public:true}),pub1=await version('public_v1',pub),pub2=await version('public_v2',pub,'v2');await adopt(pub,pub1,'other-school');await adopt(pub,pub2,null,'multi');await adopt(pub,pub1,null,'outsider');
  const shared=await regulation('shared','school'),sharedV=await version('shared',shared);m.shares={};
  for(const [where,status] of [['group','PENDING'],['union','ACCEPTED'],['other-school','REJECTED'],['external-team','REVOKED']]){
   const id=await ins('regulation_shares',{regulation_id:shared,regulation_version_id:sharedV,recipient_organization_id:m.organizations[where],status,shared_by_user_id:m.users['school-manager'],created_at:'2026-01-01',responded_at:['ACCEPTED','REJECTED'].includes(status)?'2026-01-02':null,responded_by_user_id:['ACCEPTED','REJECTED'].includes(status)?m.users['union-manager']:null,revoked_at:status==='REVOKED'?'2026-01-03':null});m.shares[where]=id;if(status==='ACCEPTED')await adopt(shared,sharedV,where,null,'SHARE',id);
  }
  const timing=await regulation('timing','school',{public:true});await version('future',timing,'future',{from:'2027-01-01',to:'2027-12-31'});await version('expired',timing,'expired',{from:'2025-01-01',to:'2025-12-31'});await version('draft',timing,'draft',{draft:true});
  // Official originals retain their original issuer. The demo organization owns
  // only this explicitly partial configuration, never the underlying document.
  const sourcesDir=path.join(ROOT,'database/sqlserver/v2/sources');
  const registry=JSON.parse(await fs.readFile(path.join(sourcesDir,'source-register.json'),'utf8'));
  async function official(entry,reg,label,criteria,publish=true){
   assert.notEqual(entry.importToPrivateStorage,false,'Research-only registry entries must not enter private source storage');const buffer=await fs.readFile(path.join(sourcesDir,entry.file));assert.equal(sha(buffer).toString('hex'),entry.sha256,`Registered source checksum ${entry.id}`);assert.equal(buffer.length,entry.byteSize);
   const metadata=validateSource({buffer,originalname:entry.file}),full=sourcePath(metadata.key);await fs.mkdir(regulationStorageRoot,{recursive:true});await fs.writeFile(full,buffer,{flag:'wx'});written.push(full);
   let text=null,error=null;try{text=await fs.readFile(path.join(sourcesDir,`${entry.file}.txt`),'utf8');}catch{error='PDF scan: chưa có văn bản trích xuất tin cậy; nguồn chỉ tham chiếu, yêu cầu đọc PDF gốc.';}
   const v=await ins('regulation_versions',{regulation_id:reg,version_label:label,effective_from:entry.assessmentFrom??entry.effectiveFrom??'2021-05-03',effective_to:entry.assessmentTo??null,source_title:entry.file,source_url:entry.url,applicability_json:json({person_types:['STUDENT']}),source_kind:'OFFICIAL',issuing_authority:entry.issuer,collected_at:entry.collectedAt,coverage_json:json({automated:criteria.filter(c=>!c.coverage_status).map(c=>c.title),manual:[],unsupported:[entry.coverage],source_register_id:entry.id,correction_id:entry.correctionId??null,legal_status:entry.status}),created_by_user_id:m.users['school-manager'],ai_reviewed_at:'2026-11-15',ai_reviewed_by_user_id:m.users['school-manager']});
   await ins('regulation_source_files',{regulation_version_id:v,owner_user_id:m.users['school-manager'],storage_key:metadata.key,original_filename:entry.file,mime_type:metadata.mime,byte_size:buffer.length,sha256:sha(buffer),source_url:entry.url,collected_at:entry.collectedAt,issuing_authority:entry.issuer,is_demo:false,extracted_text:text,extraction_status:text?'EXTRACTED':'FAILED',extraction_error:error});
   m.files.push({kind:'source',official:true,key:metadata.key,sha256:entry.sha256,version_id:v});m.official_sources.push({...entry,version_id:v});m.versions[entry.id]=v;
   for(const [i,c] of criteria.entries())await ins('criteria',{regulation_version_id:v,code:c.code,title:c.title,rule_json:json(c.rule),source_reference:c.reference,sort_order:i,coverage_status:c.coverage_status??'AUTOMATED',provenance_json:json({source_id:entry.id,url:entry.url,sha256:entry.sha256,collected_at:entry.collectedAt,issuer:entry.issuer,coverage:entry.coverage,correction:entry.correctionId?registry.entries.find(e=>e.id===entry.correctionId):null,reviewed_by:'demo configuration author'})});
   if(publish)await db("UPDATE app.regulation_versions SET publication_status='PUBLISHED',published_at=SYSUTCDATETIME(),published_by_user_id=$2 WHERE id=$1",[v,m.users['school-manager']]);return v;
  }
  const reference=await regulation('official-gov-reference','school',{public:true});await db('UPDATE app.regulations SET name=$2,description=$3 WHERE id=$1',[reference,'[LỊCH SỬ] Thông tư 08/2021/TT-BGDĐT',registry.entries.find(e=>e.id==='moet-08-2021').coverage]);
  const unsupported=[{code:'REFERENCE_ONLY',title:'Chỉ tham chiếu văn bản; chưa hỗ trợ kết luận tốt nghiệp',coverage_status:'UNSUPPORTED',reference:'Toàn văn Thông tư 08/2021/TT-BGDĐT và đính chính năm 2024 — chỉ tham khảo',rule:{type:'count',target:0}}];
  const gov=await official(registry.entries.find(e=>e.id==='moet-08-2021'),reference,'reference-2021',unsupported);await adopt(reference,gov,null,'multi');
  await official(registry.entries.find(e=>e.id==='moet-08-2021-correction'),reference,'correction-reference-2024',unsupported,false);
  const uehEntry=registry.entries.find(e=>e.id==='ueh-2025'),uehReg=await regulation('official-ueh-historical','school',{public:true});await db('UPDATE app.regulations SET name=$2,description=$3 WHERE id=$1',[uehReg,'[CẤU HÌNH MỘT PHẦN, 2025] UEH — nhánh hai khóa kỹ năng I.5.2',uehEntry.coverage]);
  const historicalRule={type:'count',target:2,from:uehEntry.achievementFrom,to:uehEntry.achievementTo,measure_unit:'khóa học',filters:[{field:'attributes.category',operator:'eq',value:'SOCIAL_PRACTICAL_SKILL'},...['completed','reputable_provider','live_interaction','participation_checked'].map(field=>({field:`attributes.${field}`,operator:'eq',value:true}))]};
  const historical=await official(uehEntry,uehReg,'historical-2025-partial',[{code:'SKILLS_TWO_COURSES',title:'Nhánh thay thế: hoàn thành hai khóa kỹ năng thực hành xã hội phù hợp Phụ lục IV–V',reference:'I.5.2; Phụ lục IV (yêu cầu khóa trực tuyến); Phụ lục V (nhóm kỹ năng). Chỉ một nhánh, không phải toàn bộ danh hiệu.',rule:historicalRule}]);await adopt(uehReg,historical,null,'multi');
  for(const date of ['2025-06-01','2025-09-01'])await achievement('multi','SOCIAL_PRACTICAL_SKILL',{completed:true,reputable_provider:true,live_interaction:true,participation_checked:true},date,false);
  await assess(m,'multi',historical,'MET','official-ueh-partial-historical','2025-11-01');
  await assess(m,'multi',gov,'INSUFFICIENT_DATA','official-gov-reference-only','2025-11-15');
  for(const [key,expected] of [['sv-complete','MET'],['sv-gap','NOT_MET'],['sv-unknown','INSUFFICIENT_DATA'],['sv-time','NOT_MET'],['sv-excluded','NOT_MET'],['sv-empty','NOT_MET'],['lecturer','NOT_APPLICABLE']]){
   const run=await assess(m,key,sv1,expected,'initial');if(key==='sv-gap'){
    const gap=run.results.find(r=>r.criterion.code==='HOURS');assert.equal(gap.missing.remaining,2);
    const goal=await ins('kpi_goals',{owner_user_id:m.users[key],source_result_id:gap.id,title:'[DEMO] Bổ sung hai giờ hoạt động',description:'Tạo từ phần thiếu trước khi bổ sung hồ sơ.',target_value:2,measure_unit:'giờ',status:'IN_PROGRESS',start_date:'2026-11-01',due_date:'2026-11-30'});
    await ins('kpi_tasks',{goal_id:goal,title:'[DEMO] Đăng ký hoạt động cộng đồng',status:'DONE',completed_at:'2026-11-10'});await ins('kpi_tasks',{goal_id:goal,title:'[DEMO] Lưu minh chứng hoạt động',status:'TODO',due_date:'2026-11-30'});
    const supplement=await achievement(key,'activity',{hours:2},'2026-11-12');await ins('kpi_achievements',{goal_id:goal,achievement_id:supplement,owner_user_id:m.users[key],contribution_value:2});await ins('kpi_progress',{goal_id:goal,owner_user_id:m.users[key],current_value:2,note:'[DEMO] Đã bổ sung thành tích và minh chứng.'});
    const after=await assess(m,key,sv1,'MET','after-supplement');m.journey={before:run.id,after:after.id,goal,result:gap.id,supplement};
   }
  }
  const manualGoal=await ins('kpi_goals',{owner_user_id:m.users['sv-complete'],title:'[DEMO] Mục tiêu ngoại ngữ tự đặt',target_value:7,measure_unit:'điểm',due_date:'2026-10-01',status:'IN_PROGRESS'});await ins('kpi_progress',{goal_id:manualGoal,owner_user_id:m.users['sv-complete'],current_value:6.5,note:'[DEMO] Mục tiêu quá hạn tại mốc demo.'});
  for(const key of ['sv-gap','sv-complete']){await ins('calendar_events',{owner_user_id:m.users[key],goal_id:key==='sv-gap'?m.journey.goal:manualGoal,title:'[DEMO] Hạn hoàn thành mục tiêu',starts_at:'2026-11-30T09:00:00Z',ends_at:'2026-11-30T10:00:00Z',remind_at:'2026-11-29T09:00:00Z'});await ins('notifications',{recipient_user_id:m.users[key],notification_type:'REGULATION_UPDATED',title:'[DEMO] Quy chế có phiên bản mới',body:'Đang dùng v1; v2 đã công bố. Không tự động đổi phiên bản.',payload_json:json({regulation_id:schoolReg,current_version_id:sv1,new_version_id:m.versions.school_v2}),deduplication_key:`${NAMESPACE}:${key}:v2`});}
  const template=await ins('cv_templates',{code:`${NAMESPACE}-CV`,name:'[DEMO] CV cơ bản',renderer_key:'classic',config_schema_json:'{}'});
  for(const [key,isPublic] of [['sv-gap',false],['sv-complete',true]]){const cv=await ins('cvs',{owner_user_id:m.users[key],template_id:template,title:`[DỮ LIỆU DEMO] CV ${key}`,public_slug:`demo-v2-${key}`,publication_status:isPublic?'PUBLIC':'PRIVATE',published_at:isPublic?new Date().toISOString():null,introduction:'DỮ LIỆU DEMO — không phải hồ sơ người thật.',content_json:'{}'});const selected=(await db('SELECT TOP(3) id FROM app.achievements WHERE owner_user_id=$1 AND deleted_at IS NULL ORDER BY id',[m.users[key]])).rows;for(const [i,a] of selected.entries())await ins('cv_achievements',{cv_id:cv,achievement_id:a.id,owner_user_id:m.users[key],sort_order:i});m.cvs.push({user:key,id:cv,public:isPublic});}
  await upgradeRevision2(m);
  await upgradeRevision3(m);
  await upgradeRevision4(m);
  const report=await verify(m);await ins('audit_events',{actor_user_id:m.users.admin,action_code:'V2_DEMO_SEEDED',entity_type:'DEMO_FIXTURE',entity_id:NAMESPACE,details_json:json(m)});
  if(modes[0]==='--validate')console.log(json({...report,rollback_only:true,files_removed_on_exit:written.length}));
  else {
   await db('COMMIT');transaction=false;
   const output=path.join(ROOT,'backend/storage/demo-v2',`${database}.manifest.json`);await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,json(m));
   console.log(json({...report,manifest:output,password_source:process.env.V2_DEMO_PASSWORD?'V2_DEMO_PASSWORD':'documented demo default'}));
  }
 }
} finally {
 if(transaction){try{await db('ROLLBACK');}catch{}for(const full of written)await fs.unlink(full).catch(()=>{});}
 await client.release();await pool.end();
}
