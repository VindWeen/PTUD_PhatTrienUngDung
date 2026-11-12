import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { connectDB, getPool, getDbPoolConfig, setPool } from '../../backend/src/config/database.js';
import { transactionPool } from '../../database/scripts/seedScenario.js';
import application from '../../backend/src/modules/awards/applicationService.js';
import awards from '../../backend/src/modules/awards/awardService.js';
import storage from '../../backend/src/modules/evidences/storage/localStorageAdapter.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export async function prepareShowcase(){
 if(getDbPoolConfig().database!=='PTUD_LHU_Demo')throw new Error('Demo only');
 const q=getPool().query.bind(getPool());
 const existing=(await q("SELECT application_id,purpose,status FROM app.award_applications WHERE purpose LIKE 'DEMO-MAIN%' OR purpose LIKE 'DEMO-READY%'")).rows;
 if(existing.length)return {existing};
 const people=Object.fromEntries((await q("SELECT u.username,u.user_id,l.lecturer_id FROM app.users u LEFT JOIN app.lecturers l ON l.user_id=u.user_id WHERE u.username IN ('an.nv','bich.tt','hoidong.truong','records.demo')")).rows.map(u=>[u.username,{userId:Number(u.user_id),lecturerId:Number(u.lecturer_id)}]));
 const an=people['an.nv'],manager=people['bich.tt'],council=people['hoidong.truong'],officer=people['records.demo'];
 const source=(await q("SELECT TOP (1) achievement_id FROM app.achievements WHERE lecturer_id=$1 AND status='VERIFIED' AND title LIKE 'DEMO-%' ORDER BY recognition_year DESC",[an.lecturerId])).rows[0];
 const cycle=(await q("SELECT TOP (1) award_period_id FROM app.award_periods WHERE code LIKE 'SCN-OPEN-%' ORDER BY award_period_id DESC")).rows[0];
 const type=(await q("SELECT award_type_id FROM app.award_types WHERE code=N'CSTĐ_CS'")).rows[0];
 const result={};
 for(const key of ['DEMO-MAIN','DEMO-READY']){
  let r=await application.create({lecturerId:an.lecturerId,cycleId:Number(cycle.award_period_id),targetAwardTypeId:Number(type.award_type_id),purpose:`${key} | Hồ sơ Nguyễn Văn An - trình diễn luồng xét thưởng [Mô phỏng]`,achievementIds:[Number(source.achievement_id)]},an);
  const id=Number(r.application_id);
  r=await application.transition(id,{version:Number(r.version)},an,'submit');
  r=await application.transition(id,{version:Number(r.version),reason:'Đơn vị đã kiểm tra hồ sơ và minh chứng, chuyển Hội đồng xem xét.'},manager,'forward');
  r=await application.review(id,{version:Number(r.version),reviewerId:council.userId,reason:'Phân công thẩm định hồ sơ trình diễn của An.'},council,'assign');
  if(key==='DEMO-READY')r=await application.review(id,{version:Number(r.version),reason:'Thống nhất đề nghị sau khi đối chiếu hồ sơ trong môi trường mô phỏng.'},council,'recommend');
  result[key]={id,status:r.status};
  if(key==='DEMO-READY'){
   const d=await awards.createDecision({decisionNumber:'DEMO-LIEN-KET-AN',decisionDate:new Date().toISOString().slice(0,10),issuer:'Đơn vị mô phỏng PTUD',title:'Quyết định ghi nhận từ hồ sơ An đã xét [Mô phỏng]'},officer);
   let award=await awards.createFromApplication(id,{applicationVersion:Number(r.version),decisionId:Number(d.decision_id),recognitionYear:new Date().getUTCFullYear()},officer);
   const bytes=fs.readFileSync(path.join(root,'docs/testing/scenario/fixtures/decision-demo.pdf'));
   await awards.upload(Number(d.decision_id),{buffer:bytes,size:bytes.length,originalname:'quyet-dinh-mau-mo-phong.pdf',mimetype:'application/pdf'},officer);
   award=await awards.transition(Number(award.record_id),{version:Number(award.version)},officer,'RECORDED');
   result.linkedAward={id:Number(award.record_id),decisionId:Number(d.decision_id),applicationId:id,status:award.status};
  }
 }
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const pool=await connectDB();let c,committed=false;const files=[],save=storage.saveFile.bind(storage);
 try{c=await pool.connect();await c.query('BEGIN');setPool(transactionPool(c));storage.saveFile=async(k,b)=>{files.push(k);return save(k,b);};const result=await prepareShowcase();await c.query('COMMIT');committed=true;
 const target=path.join(root,'output/rich-demo/showcase.json');fs.writeFileSync(target,JSON.stringify(result,null,2));console.log(result);
 }catch(e){if(c&&!committed)await c.query('ROLLBACK');if(!committed)for(const key of files)await storage.deleteFile(key);throw e;}finally{storage.saveFile=save;setPool(null);c?.release();await pool.end();}
}
