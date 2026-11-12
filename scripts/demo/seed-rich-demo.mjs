// Add a coherent three-year demo dataset without resetting existing SCN fixtures.
// Run: node --env-file=backend/.env.demo scripts/demo/seed-rich-demo.mjs --apply
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { connectDB, getDbPoolConfig, setPool } from '../../backend/src/config/database.js';
import { transactionPool } from '../../database/scripts/seedScenario.js';
import bcrypt from '../../backend/node_modules/bcryptjs/index.js';
import achievementService from '../../backend/src/modules/achievements/achievementService.js';
import evidenceService from '../../backend/src/modules/evidences/evidenceService.js';
import applicationService from '../../backend/src/modules/awards/applicationService.js';
import awardService from '../../backend/src/modules/awards/awardService.js';
import * as kpi from '../../backend/src/modules/kpi/kpiService.js';
import * as regulation from '../../backend/src/modules/regulations/regulationService.js';
import ai from '../../backend/src/modules/ai/aiService.js';
import storage from '../../backend/src/modules/evidences/storage/localStorageAdapter.js';
import { emptyDraft, cvSchema, buildPublicCv } from '../../backend/src/modules/cv/cvSchemas.js';
import profileService from '../../backend/src/modules/profiles/profileService.js';
import { runBackup } from '../backup.mjs';
import { alignRichHistory } from './align-rich-history.mjs';
import { indexConfirmedChunks } from '../../backend/src/modules/ai/rag/ragRetrievalService.js';
import { explainEvaluationResult } from '../../backend/src/modules/ai/rag/ragExplanationService.js';
import { prepareShowcase } from './prepare-rich-showcase.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const year = Number(today.slice(0, 4));
const out = path.join(root, 'output/rich-demo');
const expectedStorage = path.join(root, 'backend/storage/demo') + path.sep;
if (getDbPoolConfig().database !== 'PTUD_LHU_Demo' || !path.resolve(process.env.STORAGE_DIR || '').startsWith(expectedStorage)) throw new Error('Only PTUD_LHU_Demo and its isolated storage are allowed.');
if (!process.argv.includes('--apply')) { console.log('Preview: adds 3 years of accounts, achievements, KPI, award workflows, regulations, assessments and CVs. Existing SCN data retained. Use --apply.'); process.exit(0); }
const pool = await connectDB();
let client, committed = false;
const addedFiles = [], originalSave = storage.saveFile.bind(storage);
const manifest = { version: 1, database: 'PTUD_LHU_Demo', createdAt: new Date().toISOString(), simulationOnly: true, accounts: [], achievements: [], applications: [], awards: [], kpi: [], criteria: [], evaluations: [], cvs: [] };
try {
  if ((await pool.query("SELECT COUNT(*) n FROM app.users WHERE username='mai.cntt'")).rows[0].n) throw new Error('Rich dataset already exists; restore its baseline to rehearse, or restore the pre-rich backup to rebuild.');
  const backup = await runBackup({ outDir: path.join(root, 'backups', 'before_rich_' + Date.now()), storageDir: process.env.STORAGE_DIR, serverBackupDir: path.join(root, 'backups/demo-server'), writersStopped: true });
  if (!backup.success) throw new Error('Complete backup required');
  manifest.backupDirectory = backup.backupDir || backup.outDir;
  client = await pool.connect(); await client.query('BEGIN');
  const shared = transactionPool(client); setPool(shared);
  const q = shared.query;
  storage.saveFile = async (key, bytes) => { addedFiles.push(storage.resolveSafePath(key)); return originalSave(key, bytes); };
  const roles = Object.fromEntries((await q('SELECT code,role_id FROM app.roles')).rows.map(r => [r.code, Number(r.role_id)]));
  const units = Object.fromEntries((await q('SELECT code,unit_id FROM app.organization_units')).rows.map(r => [r.code, Number(r.unit_id)]));
  async function unit(code, name, parent, type) {
    if (!units[code]) units[code] = Number((await q('DECLARE @ids TABLE(unit_id bigint); INSERT INTO app.organization_units(code,name,parent_id,type,description) OUTPUT INSERTED.unit_id INTO @ids VALUES($1,$2,$3,$4,$5); SELECT unit_id FROM @ids;', [code, name, parent ? units[parent] : null, type, 'Cơ cấu mô phỏng phục vụ demo; không khẳng định cơ cấu chính thức của LHU.'])).rows[0].unit_id);
  }
  await unit('LHU_DEMO', 'Trường Đại học Lạc Hồng - môi trường mô phỏng', null, 'UNIVERSITY');
  await q('UPDATE app.organization_units SET parent_id=$1 WHERE code IN (\'FIT\',\'PHARM\')', [units.LHU_DEMO]);
  for (const row of [
    ['ECON','Khoa Kinh tế','LHU_DEMO','FACULTY'], ['ENG','Khoa Kỹ thuật','LHU_DEMO','FACULTY'],
    ['LANG','Khoa Ngôn ngữ','LHU_DEMO','FACULTY'], ['HR','Phòng Tổ chức - Hành chính','LHU_DEMO','OFFICE'],
    ['SCI','Phòng Nghiên cứu khoa học','LHU_DEMO','OFFICE'], ['QA','Trung tâm Đảm bảo chất lượng','LHU_DEMO','CENTER'],
    ['FIT_NET','Bộ môn Mạng và An toàn thông tin','FIT','DEPARTMENT'],
    ['PHARM_CL','Bộ môn Dược lâm sàng','PHARM','DEPARTMENT'], ['PHARM_CHEM','Bộ môn Hóa dược','PHARM','DEPARTMENT'],
    ['ECON_ACC','Bộ môn Kế toán','ECON','DEPARTMENT'], ['ECON_BUS','Bộ môn Quản trị kinh doanh','ECON','DEPARTMENT'],
    ['ENG_AUTO','Bộ môn Tự động hóa','ENG','DEPARTMENT'], ['LANG_EN','Bộ môn Tiếng Anh','LANG','DEPARTMENT'],
  ]) await unit(...row);
  const passwordHash = await bcrypt.hash('demo1234', 10);
  const people = {};
  for (const r of (await q('SELECT u.user_id,u.username,u.display_name,l.lecturer_id FROM app.users u LEFT JOIN app.lecturers l ON l.user_id=u.user_id')).rows) people[r.username] = { userId: Number(r.user_id), lecturerId: r.lecturer_id ? Number(r.lecturer_id) : null, name: r.display_name };
  const admin = { ...people['duc.pm'], roles: ['ADMIN'] };
  async function account(username, name, roleCodes, unitCode, scopeCode = null) {
    const userId = Number((await q('INSERT INTO app.users(username,email,password_hash,display_name) OUTPUT INSERTED.user_id VALUES($1,$2,$3,$4)', [username, username + '@example.invalid', passwordHash, name])).rows[0].user_id);
    for (const role of roleCodes) {
      await q("INSERT INTO app.user_roles(user_id,role_id,valid_from) VALUES($1,$2,'2023-01-01')", [userId, roles[role]]);
      if (['MANAGER','COUNCIL','RECORDS_OFFICER'].includes(role)) await q("INSERT INTO app.user_unit_scopes(user_id,role_id,unit_id,include_descendants,valid_from) VALUES($1,$2,$3,1,'2023-01-01')", [userId, roles[role], units[scopeCode || unitCode]]);
    }
    let lecturerId = null;
    if (roleCodes.includes('LECTURER')) {
      lecturerId = Number((await q("INSERT INTO app.lecturers(user_id,employee_code,full_name,email,title,degree) OUTPUT INSERTED.lecturer_id VALUES($1,$2,$3,$4,N'Giảng viên',N'Thạc sĩ')", [userId, 'DEMO-' + username.toUpperCase(), name, username + '@example.invalid'])).rows[0].lecturer_id);
      await q("INSERT INTO app.lecturer_assignments(lecturer_id,unit_id,is_primary,valid_from,assigned_by) VALUES($1,$2,1,'2023-01-01',$3)", [lecturerId, units[unitCode], admin.userId]);
    }
    if (roleCodes.includes('UNIT_REPRESENTATIVE')) await q("INSERT INTO app.unit_representatives(user_id,unit_id,valid_from,assigned_by) VALUES($1,$2,'2023-01-01',$3)", [userId, units[unitCode], admin.userId]);
    const p = { userId, lecturerId, name, unitCode, roles: roleCodes };
    people[username] = p; manifest.accounts.push({ username, name, roles: roleCodes, unit: unitCode, scope: scopeCode, password: 'demo1234' }); return p;
  }
  const globalCouncil = await account('hoidong.truong','Phạm Thu Hà',['COUNCIL'],'LHU_DEMO');
  const globalOfficer = await account('thidua.truong','Đặng Minh Thư',['RECORDS_OFFICER'],'LHU_DEMO');
  const managers = { FIT: people['bich.tt'] };
  for (const [code, username, name] of [['PHARM','quanly.duoc','Lê Hoàng Phúc'],['ECON','quanly.kinhte','Trần Ngọc Hân'],['ENG','quanly.kythuat','Võ Minh Đức'],['LANG','quanly.ngonngu','Nguyễn Thảo Vy']]) managers[code] = await account(username,name,['MANAGER','LECTURER'],code);
  const names = ['Trần Ngọc Mai','Lê Minh Huy','Phạm Thảo Nguyên','Võ Quốc Bảo','Đặng Thu Trang','Nguyễn Hoàng Nam','Bùi Khánh Linh','Trần Gia Hưng','Lê Thanh Trúc','Phạm Anh Khoa','Nguyễn Bảo Châu','Võ Tuấn Kiệt','Đỗ Phương Anh','Huỳnh Minh Tâm','Trần Ngọc Ánh','Nguyễn Đức Hải','Lê Quỳnh Như','Phạm Quốc Thịnh','Võ Thanh Hà','Bùi Minh Quân','Đặng Ngọc Yến','Trần Hải Đăng','Lê Thảo Nhi','Nguyễn Gia Phúc'];
  const groupUnits = ['FIT_SE','FIT_CS','FIT_NET','PHARM_CL','PHARM_CHEM','ECON_ACC','ECON_BUS','ENG_AUTO','LANG_EN'];
  const lecturers = [];
  for (let i=0;i<names.length;i++) {
    const uc = groupUnits[i % groupUnits.length];
    const username = i === 0 ? 'mai.cntt' : i === 1 ? 'huy.cntt' : `giangvien.${String(i+1).padStart(2,'0')}`;
    lecturers.push(await account(username,names[i],i >= 12 && i <= 17 ? ['LECTURER','UNIT_REPRESENTATIVE'] : ['LECTURER'],uc));
  }
  people['an.nv'].unitCode = 'FIT_SE'; people['cuong.lh'].unitCode = 'FIT_CS';
  lecturers.unshift(people['an.nv'], people['cuong.lh']);
  const typeRows = (await q('SELECT * FROM app.achievement_types WHERE is_active=1')).rows;
  const types = Object.fromEntries(typeRows.map(r => [r.code, Number(r.achievement_type_id)]));
  const awardRows = (await q('SELECT * FROM app.award_types WHERE is_active=1')).rows;
  const awardTypes = Object.fromEntries(awardRows.map(r => [r.code, Number(r.award_type_id)]));
  const bytes = fs.readFileSync(path.join(root,'docs/testing/scenario/fixtures/evidence-demo.pdf'));
  const decisionBytes = fs.readFileSync(path.join(root,'docs/testing/scenario/fixtures/decision-demo.pdf'));
  const file = (buffer,name) => ({ buffer, size: buffer.length, originalname: name, mimetype: 'application/pdf' });
  const topics = ['Ứng dụng học máy trong dự báo kết quả học tập','Xây dựng học liệu số cho học phần chuyên ngành','Nghiên cứu tối ưu quy trình xử lý dữ liệu','Hướng dẫn sinh viên nghiên cứu khoa học','Đổi mới phương pháp đánh giá học phần','Giải pháp hỗ trợ quản lý công việc tại đơn vị','Nghiên cứu ứng dụng phục vụ cộng đồng','Phát triển công cụ hỗ trợ giảng dạy'];
  const managerFor = p => managers[p.unitCode.split('_')[0]];
  const verifiedByPerson = new Map();
  async function achievement(p,index,state,typeId,yr,collectiveUnit=null) {
    let a = await achievementService.createAchievement(p,{ subjectType: collectiveUnit ? 'UNIT' : 'LECTURER', ...(collectiveUnit ? {organizationUnitId:units[collectiveUnit]} : {}), achievementTypeId:typeId,
      title:`DEMO-${yr}-${p.userId}-${index} | ${topics[index % topics.length]} [Mô phỏng]`,
      description:`${p.name} tham gia ${topics[index % topics.length].toLowerCase()}. Kết quả được tổng hợp trong năm ${yr}. Đây là hồ sơ giả lập; PDF đính kèm là tệp mẫu dùng kiểm tra lưu trữ và tải xuống, không chứng minh công trình thật.`,
      recognitionYear:yr,startDate:`${yr}-02-01`,endDate:`${yr}-06-30`,contributionRole:collectiveUnit ? 'Đơn vị chủ trì' : index%2 ? 'Đồng tác giả' : 'Chủ trì thực hiện' });
    const id = a.achievementId;
    await evidenceService.createEvidence({achievementId:id,body:{title:`Tệp mẫu cho ${p.name} - ${yr} (mô phỏng)`},file:file(bytes,`minh-chung-${id}-mo-phong.pdf`),user:p});
    const manager = managerFor(p);
    if (state !== 'DRAFT') a = await achievementService.submitAchievement(p,id,{version:a.version});
    if (['VERIFIED','REVOKED'].includes(state)) a = await achievementService.verifyAchievement(manager,id,{version:a.version,note:'Đã kiểm tra hồ sơ và tệp mẫu trong môi trường demo.'});
    if (state === 'NEED_CORRECTION') a = await achievementService.requestCorrection(manager,id,{version:a.version,reason:'Cần bổ sung vai trò đóng góp và thời điểm nghiệm thu vào bản minh chứng.'});
    if (state === 'REJECTED') a = await achievementService.rejectAchievement(manager,id,{version:a.version,reason:'Nội dung tài liệu không khớp kỳ ghi nhận, chưa chấp nhận kê khai này.'});
    if (state === 'CANCELLED') a = await achievementService.cancelAchievement(p,id,{version:a.version,reason:'Chủ hồ sơ rút do kê khai trùng hoạt động.'});
    if (state === 'REVOKED') a = await achievementService.revokeAchievement(manager,id,{version:a.version,reason:'Thu hồi sau rà soát thông tin tác giả trong ca mô phỏng.'});
    // Historical dates describe a plausible past workflow; services still create every transition.
    const stamp = `${yr}-07-${String(10+index%15).padStart(2,'0')}T09:00:00`;
    await q('UPDATE app.achievements SET created_at=DATEADD(day,-20,CONVERT(datetime2,$2)),updated_at=CONVERT(datetime2,$2) WHERE achievement_id=$1',[id,stamp]);
    manifest.achievements.push({id,owner:p.name,userId:p.userId,year:yr,status:a.status,typeId,collectiveUnit});
    if (state==='VERIFIED' && !collectiveUnit) { if(!verifiedByPerson.has(p.userId))verifiedByPerson.set(p.userId,[]); verifiedByPerson.get(p.userId).push(a); }
    return a;
  }
  for (const [pi,p] of lecturers.entries()) {
    for (let j=0;j<8;j++) {
      const state = j<3 ? 'VERIFIED' : ['DRAFT','SUBMITTED','NEED_CORRECTION','REJECTED','CANCELLED'][j-3];
      // Teaching sources for An are all verified: allows a clean, decisive criterion despite research drafts.
      const tid = j<3 ? types.TEACHING_CURRICULUM : types.RESEARCH_JOURNAL_Q1;
      await achievement(p,j,state,tid,year-2+Math.min(j,2));
    }
    if (pi%6===0) await achievement(p,9,'REVOKED',types.RESEARCH_PATENT,year-1);
    if (pi%5===0) console.log(`Achievements: ${pi+1}/${lecturers.length} people`);
  }
  const collectiveSources = [];
  for (const p of lecturers.filter(p=>p.roles?.includes('UNIT_REPRESENTATIVE'))) {
    collectiveSources.push({p,a:await achievement(p,20,'VERIFIED',types.RESEARCH_PATENT,year,p.unitCode)});
    await achievement(p,21,'SUBMITTED',types.RESEARCH_PATENT,year,p.unitCode);
  }
  // KPI: status is DRAFT/ACCEPTED in this app; progress and overdue are derived from result/date.
  for (const p of lecturers) for(let j=0;j<5;j++) {
    const yr = j<2 ? year-1 : year;
    let g = await kpi.create(p,{subjectType:'LECTURER',code:`DEMO-K${p.userId}-${j}`,title:['Hoàn thành học liệu học phần','Công bố kết quả nghiên cứu','Hướng dẫn đề tài sinh viên','Chuẩn bị giáo trình mới','Xây dựng học liệu học kỳ tới'][j],measureUnit:'sản phẩm',periodStart:`${yr}-01-01`,periodEnd:j===2 ? `${year}-09-30` : `${yr}-12-31`,target:4,plan:'Chia công việc theo quý; cập nhật kết quả và bổ sung minh chứng sau mỗi mốc.',sourceNote:'Kế hoạch cá nhân mô phỏng, không phải chỉ tiêu do LHU giao.'});
    if(j!==4)g=await kpi.mutateGoal(p,Number(g.goal_id),'accept',{version:Number(g.version)});
    const actual = [4,2,1,3,null][j];
    if(actual!==null)await kpi.result(p,Number(g.goal_id),'create',{actual,sourceNote:'Kết quả tự kê khai mô phỏng.',evidenceNote:'Kết quả mục tiêu chưa thay thế bước thẩm định thành tích.'});
    manifest.kpi.push({id:Number(g.goal_id),userId:p.userId,status:g.status,actual,target:4,periodEnd:j===2?`${year}-09-30`:`${yr}-12-31`});
  }
  const cycles={};
  for(let yr=year-2;yr<=year;yr++) {
    cycles[yr]=await applicationService.createCycle({code:`DEMO-TD-${yr}`,name:`Đợt tổng kết thi đua ${yr} [Mô phỏng]`,startDate:`${yr}-01-01`,endDate:`${yr}-12-31`},globalOfficer);
  }
  const applicationStates=['DRAFT','SUBMITTED','COUNCIL_PENDING','UNDER_REVIEW','NEED_CORRECTION','RECOMMENDED','NOT_RECOMMENDED'];
  async function makeApplication(p,a,state,idx,collectiveUnit=null) {
    let r=await applicationService.create({...(collectiveUnit?{organizationUnitId:units[collectiveUnit]}:{lecturerId:p.lecturerId}),cycleId:Number(cycles[year].award_period_id),targetAwardTypeId:collectiveUnit?awardTypes['TAP_THE_LĐXS']:awardRows.filter(r=>r.applicable_subject_type!=='UNIT')[idx%3].award_type_id,purpose:`DEMO-P${idx} | Đề nghị ghi nhận đóng góp của ${p.name} [Mô phỏng]`,achievementIds:[a.achievementId]},p);
    const id=Number(r.application_id),manager=managerFor(p);
    if(state!=='DRAFT')r=await applicationService.transition(id,{version:Number(r.version)},p,'submit');
    if(!['DRAFT','SUBMITTED'].includes(state))r=await applicationService.transition(id,{version:Number(r.version),reason:'Đơn vị đã đối chiếu nguồn thành tích và chuyển Hội đồng.'},manager,'forward');
    if(['UNDER_REVIEW','NEED_CORRECTION','RECOMMENDED','NOT_RECOMMENDED'].includes(state))r=await applicationService.review(id,{version:Number(r.version),reviewerId:globalCouncil.userId,reason:'Phân công xem xét hồ sơ theo nhóm chuyên môn.'},globalCouncil,'assign');
    const action={NEED_CORRECTION:'request-correction',RECOMMENDED:'recommend',NOT_RECOMMENDED:'not-recommend'}[state];
    if(action)r=await applicationService.review(id,{version:Number(r.version),reason:state==='RECOMMENDED'?'Hồ sơ đã được đối chiếu, thống nhất đề nghị trong ca mô phỏng.':state==='NOT_RECOMMENDED'?'Chưa đáp ứng yêu cầu của đợt xét theo ý kiến Hội đồng mô phỏng.':'Cần giải trình thêm phạm vi đóng góp trước khi kết luận.'},globalCouncil,action);
    manifest.applications.push({id,userId:p.userId,state:r.status,sourceId:a.achievementId,collectiveUnit});return r;
  }
  let serial=0;
  for (const p of lecturers) for(let j=0;j<2;j++) await makeApplication(p,verifiedByPerson.get(p.userId)[j],applicationStates[serial%7],++serial);
  for(const {p,a} of collectiveSources)await makeApplication(p,a,'COUNCIL_PENDING',++serial,p.unitCode);
  // Awards use each recipient's own achievement, not a shared unrelated source.
  for(const [i,p] of lecturers.entries()) {
    const count=i<6?2:1;
    for(let j=0;j<count;j++) {
      const yr=year-(i+j)%3, number=`DEMO-QD-${yr}-${i+1}-${j+1}`;
      const d=await awardService.createDecision({decisionNumber:number,decisionDate:`${yr}-08-15`,issuer:'Hội đồng thi đua - môi trường mô phỏng',title:`Ghi nhận đóng góp ${p.name} [Mô phỏng, không có giá trị thực tế]`},globalOfficer);
      let r=await awardService.createRecord({lecturerId:p.lecturerId,awardTypeId:awardRows.filter(r=>r.applicable_subject_type!=='UNIT')[(i+j)%3].award_type_id,decisionId:Number(d.decision_id),recognitionYear:yr,achievementIds:[verifiedByPerson.get(p.userId)[(i+j)%3].achievementId]},globalOfficer);
      await awardService.upload(Number(d.decision_id),file(decisionBytes,`${number}-mau-mo-phong.pdf`),globalOfficer);
      if(i%9!==8)r=await awardService.transition(Number(r.record_id),{version:Number(r.version)},globalOfficer,'RECORDED');
      if(i%11===10)r=await awardService.transition(Number(r.record_id),{version:Number(r.version),reason:'Thu hồi bản ghi do sai loại thưởng trong ca mô phỏng.'},globalOfficer,'REVOKED');
      manifest.awards.push({id:Number(r.record_id),decisionId:Number(d.decision_id),userId:p.userId,status:r.status,year:yr});
    }
  }
  for(const {p,a} of collectiveSources) {
    const d=await awardService.createDecision({decisionNumber:`DEMO-TT-${p.userId}`,decisionDate:`${year}-08-15`,issuer:'Đơn vị mô phỏng',title:'Khen thưởng tập thể [Mô phỏng]'},globalOfficer);
    let r=await awardService.createRecord({organizationUnitId:units[p.unitCode],awardTypeId:awardTypes['TAP_THE_LĐXS'],decisionId:Number(d.decision_id),recognitionYear:year,achievementIds:[a.achievementId]},globalOfficer);
    await awardService.upload(Number(d.decision_id),file(decisionBytes,'quyet-dinh-tap-the-mau.pdf'),globalOfficer);
    r=await awardService.transition(Number(r.record_id),{version:Number(r.version)},globalOfficer,'RECORDED');
    manifest.awards.push({id:Number(r.record_id),status:r.status,unit:p.unitCode,year});
  }
  // Real legal-source metadata only: no invented extracted legal criteria or local approval.
  const sources=[
    ['06/2022/QH15','Luật Thi đua, khen thưởng','LAW','Quốc hội','2024-01-01','https://vanban.chinhphu.vn/?docid=206170&pageid=27160'],
    ['98/2023/ND-CP','Quy định chi tiết thi hành một số điều của Luật Thi đua, khen thưởng','GUIDELINE','Chính phủ','2024-01-01','https://chinhphu.vn/?classid=1&docid=209421&orggroupid=2&pageid=27160'],
    ['01/2024/TT-BNV','Biện pháp thi hành Luật Thi đua, khen thưởng và Nghị định 98/2023','CIRCULAR','Bộ Nội vụ','2024-04-15','https://vanban.chinhphu.vn/?classid=1&docid=209795&pageid=27160'],
    ['152/2025/ND-CP','Phân cấp, phân quyền trong lĩnh vực thi đua, khen thưởng','GUIDELINE','Chính phủ','2025-07-01','https://congbao.chinhphu.vn/tai-ve-van-ban-so-152-2025-nd-cp-45160-56921'],
  ];
  for(const [code,title,documentType,issuingAuthority,effectiveFrom,sourceUrl] of sources) {
    const d=await regulation.createDocument({documentCode:code,title,documentType,issuingAuthority,description:'Danh mục nguồn tham khảo có thật. Chưa nhập toàn văn, chưa xác nhận phạm vi/hiệu lực áp dụng tại trường; không dùng tự động kết luận.'},admin);
    await regulation.createVersion(Number(d.document_id),{versionNumber:'Danh mục tham khảo',effectiveFrom,sourceUrl,isOfficial:true,lhuApplicationStatus:'INTERNAL_CRITERIA_UNCONFIRMED',contentForHash:JSON.stringify({code,title,sourceUrl,metadataOnly:true})},admin);
  }
  const d=await regulation.createDocument({documentCode:'DEMO-QUY-CHE-NOI-BO',title:'Bộ tiêu chí thực hành xét hồ sơ [MÔ PHỎNG - không phải quy chế LHU]',documentType:'UNIVERSITY_REGULATION',issuingAuthority:'Nhóm phát triển - môi trường demo',description:'Bản giả lập để minh họa cấu hình nguồn và kết quả đối chiếu. Trạng thái xác nhận chỉ mô phỏng thao tác trong DB demo.'},admin);
  const old=await regulation.createVersion(Number(d.document_id),{versionNumber:'2024-demo',effectiveFrom:`${year-2}-01-01`,effectiveTo:`${year-1}-12-31`,isOfficial:false,lhuApplicationStatus:'SIMULATION_ONLY',contentForHash:'Bản thực hành cũ; không có hiệu lực thật.'},admin);
  const v=await regulation.createVersion(Number(d.document_id),{versionNumber:'2026-demo',effectiveFrom:`${year}-01-01`,supersedesVersionId:Number(old.version_id),isOfficial:false,lhuApplicationStatus:'INTERNAL_CRITERIA_UNCONFIRMED',contentForHash:'Bộ tiêu chí thực hành: 2 hoặc 5 giáo trình nghiệm thu có minh chứng; không phải quy chế LHU.'},admin);
  await regulation.addChunks(Number(v.version_id),[{articleNo:'Mục thực hành',clauseNo:'1',pageNo:1,content:'Bộ tiêu chí thực hành xét hồ sơ: đối chiếu số giáo trình đã nghiệm thu có minh chứng. Ngưỡng cơ bản là 2 sản phẩm; ngưỡng nâng cao là 5 sản phẩm. Nội dung hoàn toàn giả lập, không phải tiêu chuẩn khen thưởng chính thức của LHU.'}],admin);
  await regulation.confirmVersion(Number(v.version_id),{isConfirmed:true,lhuApplicationStatus:'CONFIRMED_LHU_POLICY',confirmationNotes:'CHỈ MÔ PHỎNG thao tác xác nhận trong PTUD_LHU_Demo. Không phải phê duyệt thực tế của trường. Nguồn có isOfficial=false; provider vẫn mock.'},admin);
  for(const [code,name,threshold,sourceRules,confirmed] of [
    ['DEMO-CO-BAN','Thực hành: ít nhất 2 giáo trình đã nghiệm thu [Mô phỏng]',2,{sourceType:'ACHIEVEMENT',achievementTypeIds:[types.TEACHING_CURRICULUM]},true],
    ['DEMO-NANG-CAO','Thực hành: ít nhất 5 giáo trình đã nghiệm thu [Mô phỏng]',5,{sourceType:'ACHIEVEMENT',achievementTypeIds:[types.TEACHING_CURRICULUM]},true],
    ['DEMO-CAN-BO-SUNG','Thực hành: nghiên cứu cần hoàn thiện minh chứng [Mô phỏng]',2,{sourceType:'ACHIEVEMENT',achievementTypeIds:[types.RESEARCH_JOURNAL_Q1]},true],
    ['DEMO-DANG-SOAN','Dự thảo: đóng góp chuyên môn [Chưa xác nhận]',3,{sourceType:'ACHIEVEMENT',achievementTypeIds:[types.RESEARCH_PATENT]},false],
  ]) {
    const c=await regulation.createCriteriaVersion(Number(v.version_id),{criterionCode:code,name,targetType:'INDIVIDUAL',minThreshold:threshold,unitMetric:'sản phẩm',sourceRules,legalReferences:'Mục thực hành, khoản 1, trang 1 (nguồn giả lập)',notes:'Tiêu chí giả lập phục vụ demo, không áp dụng xét thưởng thực tế.'},admin);
    if(confirmed)await regulation.confirmCriterion(Number(c.criteria_version_id),{isConfirmed:true,expectedSourceRulesRevision:Number(c.source_rules_revision),notes:'Xác nhận cấu hình của ca thực hành trong DB demo.'},admin);
    manifest.criteria.push({id:Number(c.criteria_version_id),code,threshold,confirmed});
  }
  await indexConfirmedChunks();
  for(const p of lecturers.slice(0,8))for(const c of manifest.criteria.filter(c=>c.confirmed)) {
    const run=await ai.evaluateStructured({subjectType:'LECTURER',subjectId:p.lecturerId,criteriaVersionIds:[c.id],forcedProvider:'mock',asOfDate:today},p);
    manifest.evaluations.push({runId:run.runId,userId:p.userId,criterion:c.code,overallConclusion:run.overallConclusion,metric:run.criterionResults[0].thresholdMetric});
    await explainEvaluationResult({criterionResult:run.criterionResults[0],asOfDate:today,forcedProvider:'mock',runId:run.runId});
  }
  for(const p of lecturers.slice(0,8)) {
    const profile=await profileService.getOwnProfile(p.userId);
    const achievements=verifiedByPerson.get(p.userId).map(a=>({achievementId:a.achievementId,title:a.title,recognitionYear:a.recognitionYear}));
    const draft={...emptyDraft,template:'modern',headline:'Giảng viên | Nghiên cứu và phát triển học liệu số',summary:'Tôi quan tâm đến việc đưa công nghệ vào giảng dạy và giải quyết những công việc thực tế. Tôi mong muốn tạo ra học liệu dễ tiếp cận, đồng hành cùng sinh viên và phát triển các ứng dụng có ích. Hồ sơ này sử dụng dữ liệu mô phỏng phục vụ trình diễn.',showEmail:true,workHistoryIds:profile.workHistory.map(h=>Number(h.assignmentId)),achievementIds:achievements.map(a=>Number(a.achievementId)),education:[{institution:'Cơ sở đào tạo mô phỏng',qualification:'Thạc sĩ chuyên ngành',period:'2020 - 2022'}],specialties:'Học liệu số; ứng dụng công nghệ trong giáo dục',skills:'Phát triển ứng dụng; phân tích dữ liệu; làm việc nhóm; hướng dẫn sinh viên',certificates:'Bồi dưỡng phương pháp giảng dạy đại học (mô phỏng)',projects:'Hệ thống quản lý hồ sơ thành tích: xây dựng quy trình và hỗ trợ tổng hợp minh chứng.',experiences:[{organization:'Đơn vị đào tạo mô phỏng',position:'Giảng viên',period:'2023 - nay',description:'Giảng dạy, phát triển học liệu và hướng dẫn các nhóm sinh viên thực hiện dự án.'}]};
    cvSchema.parse(draft);const {version,...saved}=draft;
    const publicId=crypto.randomBytes(16).toString('hex');
    const published=p===lecturers[0]?buildPublicCv(saved,profile,achievements):null;
    await q('DELETE FROM app.lecturer_cvs WHERE lecturer_id=$1',[p.lecturerId]);
    await q('INSERT INTO app.lecturer_cvs(lecturer_id,public_id,draft,published,published_draft,published_at) VALUES($1,$2,$3,$4,$5,$6)',[p.lecturerId,publicId,JSON.stringify(saved),published?JSON.stringify(published):null,published?JSON.stringify(saved):null,published?new Date():null]);
    manifest.cvs.push({userId:p.userId,name:p.name,publicId,published:Boolean(published)});
  }
  for(const [i,p] of lecturers.entries())for(let j=0;j<3;j++)await q('INSERT INTO app.personal_calendar_events(user_id,title,description,location,category,starts_at,ends_at,completed) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[p.userId,['Hoàn thiện minh chứng học phần','Họp rà soát hồ sơ thi đua','Hướng dẫn nhóm nghiên cứu sinh viên'][j],'Lịch cá nhân mô phỏng.','Phòng làm việc / trực tuyến','task',`${year}-11-${String(10+j*5).padStart(2,'0')}T09:00:00`,`${year}-11-${String(10+j*5).padStart(2,'0')}T10:00:00`,j===0]);
  manifest.showcase = await prepareShowcase();
  await alignRichHistory(q);
  // Prove all newly referenced files exist and their metadata match before commit.
  for(const r of (await q('SELECT storage_key,file_size,sha256_hash FROM app.evidence_files UNION ALL SELECT storage_key,file_size,sha256_hash FROM app.award_decision_files')).rows) {
    const b=fs.readFileSync(storage.resolveSafePath(r.storage_key));
    if(b.length!==Number(r.file_size)||crypto.createHash('sha256').update(b).digest('hex')!==r.sha256_hash)throw new Error('Private file mismatch: '+r.storage_key);
  }
  const metrics=manifest.evaluations.filter(e=>e.userId===people['an.nv'].userId);
  if(metrics[0].metric.isSatisfied!==true || metrics[1].metric.isSatisfied!==false || metrics[2].metric.isSatisfied!=='UNCONFIRMED')throw new Error('An assessment scenarios did not produce expected pass/fail/review');
  await client.query('COMMIT');committed=true;
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
  console.log(JSON.stringify({success:true,added:Object.fromEntries(['accounts','achievements','applications','awards','kpi','evaluations','cvs'].map(k=>[k,manifest[k].length])),anAssessmentMetrics:metrics.map(e=>({criterion:e.criterion,...e.metric})),manifest:'output/rich-demo/manifest.json'},null,2));
} catch(e) {
  if(client&&!committed)await client.query('ROLLBACK');
  if(!committed)for(const f of addedFiles)if(f.startsWith(expectedStorage)&&fs.existsSync(f))fs.unlinkSync(f);
  console.error(e);process.exitCode=1;
} finally { storage.saveFile=originalSave;setPool(null);client?.release();await pool.end(); }


