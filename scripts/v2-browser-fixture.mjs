// Local browser checks only. All writes share one transaction and are rolled back.
import http from 'node:http';
import app from '../backend/src/app.js';
import { Pool,getDbPoolConfig,setPool } from '../backend/src/config/database.js';
import { hashPassword } from '../backend/src/utils/crypto.js';
import { insertId } from '../backend/src/v2/shared.js';
const pool=new Pool(getDbPoolConfig()),client=await pool.connect();
await client.query('BEGIN');
const q=(sql,params)=>/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)?Promise.resolve({rows:[],rowCount:0}):client.query(sql,params);
setPool({query:q,connect:async()=>({query:q,release:async()=>{}})});
const user=await insertId(client,'users','email,password_hash','$1,$2',['browser-v2@example.test',await hashPassword('Browser-Test-2026')]);
await client.query("INSERT app.person_profiles(user_id,full_name,person_type) VALUES($1,N'Kiểm tra giao diện','STUDENT')",[user]);
await client.query("INSERT app.global_role_grants(user_id,role_code) VALUES($1,'SYSTEM_ADMIN'),($1,'REGULATION_MANAGER')",[user]);
if(process.env.V2_UI_NOTIFICATIONS==='1'){
 for(let index=1;index<=12;index++)await client.query("INSERT app.notifications(recipient_user_id,notification_type,title,body) VALUES($1,'ORGANIZATION',$2,$3)",[user,`Thông báo kiểm thử ${index}`,'Dữ liệu tạm để kiểm tra dropdown, sẽ rollback khi kết thúc.']);
}
const server=http.createServer((req,res)=>{
  if(req.method==='GET'&&req.url==='/__fixture/status'){
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({rollbackOnly:true}));return;
  }
  if(req.method==='POST'&&req.url==='/__fixture/rollback'){
    cleanup().then(()=>res.end('Rolled back browser fixture.')).catch(error=>{res.statusCode=500;res.end(error.message);});return;
  }
  app(req,res);
});
let closing=false;
async function cleanup(){
 if(closing)return;closing=true;server.close();setPool(null);await client.release();await pool.end();console.log('Browser fixture rolled back; business tables unchanged.');
}
process.on('SIGINT',()=>cleanup().finally(()=>process.exit()));
process.on('SIGTERM',()=>cleanup().finally(()=>process.exit()));
server.listen(5056,'127.0.0.1',()=>console.log('Rollback-only browser API: http://127.0.0.1:5056; account browser-v2@example.test / Browser-Test-2026'));
