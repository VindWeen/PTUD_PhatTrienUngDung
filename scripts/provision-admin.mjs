// Explicit operator action, never executed at startup or as a seed.
import { z } from '../backend/node_modules/zod/index.js';
import { query, withTransaction } from '../backend/src/utils/dbHelper.js';
import { closeDB } from '../backend/src/config/database.js';
import { hashPassword } from '../backend/src/utils/crypto.js';

if (!process.argv.includes('--apply')) {
  console.log('To provision the first V2 administrator, set PTUD_ADMIN_EMAIL, PTUD_ADMIN_NAME and PTUD_ADMIN_PASSWORD, then run with --apply. Existing account passwords are never changed.');
} else {
  try {
    const data=z.object({email:z.string().trim().email().max(254),name:z.string().trim().min(1).max(200),password:z.string().min(8).refine(value=>Buffer.byteLength(value)<=72)}).parse({email:process.env.PTUD_ADMIN_EMAIL,name:process.env.PTUD_ADMIN_NAME,password:process.env.PTUD_ADMIN_PASSWORD});
    const passwordHash=await hashPassword(data.password);
    await withTransaction(async({query:db})=>{
      let user=(await db('SELECT id,account_status FROM app.users WITH(UPDLOCK,HOLDLOCK) WHERE normalized_email=LOWER($1)',[data.email])).rows[0];
      if(user&&user.account_status!=='ACTIVE')throw new Error('Existing account is not active.');
      if(!user){user=(await db('INSERT app.users(email,password_hash) OUTPUT INSERTED.id VALUES($1,$2)',[data.email,passwordHash])).rows[0];await db('INSERT app.person_profiles(user_id,full_name) VALUES($1,$2)',[user.id,data.name]);}
      const exists=(await db("SELECT id FROM app.global_role_grants WHERE user_id=$1 AND role_code='SYSTEM_ADMIN' AND valid_from<=SYSUTCDATETIME() AND (valid_to IS NULL OR valid_to>SYSUTCDATETIME())",[user.id])).rows.length;
      if(!exists)await db("INSERT app.global_role_grants(user_id,role_code,granted_by_user_id) VALUES($1,'SYSTEM_ADMIN',$1)",[user.id]);
      await db("INSERT app.audit_events(actor_user_id,action_code,entity_type,entity_id,reason) VALUES($1,'ADMIN_PROVISIONED','users',$2,N'Explicit operator provisioning')",[user.id,String(user.id)]);
    });
    console.log('V2 administrator provisioned. No sample organizations, achievements or regulations were inserted.');
  } catch(error){console.error(error instanceof z.ZodError?'Invalid admin provisioning input.':error.message);process.exitCode=1;}
  finally{await closeDB();delete process.env.PTUD_ADMIN_PASSWORD;}
}
