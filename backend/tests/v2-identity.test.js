import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withTransaction } from '../src/utils/dbHelper.js';
import { closeDB } from '../src/config/database.js';
import { canAccessOrg, authorizeOrg, hasGlobalRole, orgScopeIds } from '../src/v2/access.js';

test('V2 permissions follow live grants, descendants, and current tree without granting member rights',async()=>{
  const rollback=new Error('fixture rollback');
  try {
    await withTransaction(async({query:db})=>{
      const key=crypto.randomUUID();
      const user=(await db(`INSERT INTO app.users(email) OUTPUT INSERTED.id VALUES($1)`,[`${key}@example.test`])).rows[0].id;
      const parent=(await db(`DECLARE @new TABLE(id bigint); INSERT INTO app.organizations(code,name,organization_type,created_by_user_id) OUTPUT INSERTED.id INTO @new VALUES($1,N'Parent','OTHER',$2); SELECT id FROM @new;`,[key,user])).rows[0].id;
      const child=(await db(`DECLARE @new TABLE(id bigint); INSERT INTO app.organizations(code,name,organization_type,parent_id,created_by_user_id) OUTPUT INSERTED.id INTO @new VALUES($1,N'Child','CLASS',$2,$3); SELECT id FROM @new;`,[`${key}-child`,parent,user])).rows[0].id;
      assert.equal(await canAccessOrg(user,parent,'MEMBERS_VIEW',db),false,'creator is not implicitly a manager');
      const grant=(await db(`INSERT INTO app.org_access_grants(organization_id,user_id,permission_code,include_descendants,granted_by_user_id) OUTPUT INSERTED.id VALUES($1,$2,'MEMBERS_VIEW',0,$2)`,[parent,user])).rows[0].id;
      assert.equal(await canAccessOrg(user,parent,'MEMBERS_VIEW',db),true);
      assert.equal(await canAccessOrg(user,child,'MEMBERS_VIEW',db),false);
      await assert.rejects(authorizeOrg(user,parent,'MEMBERS_VIEW',db,true),e=>e.statusCode===403);
      await db(`UPDATE app.org_access_grants SET include_descendants=1 WHERE id=$1`,[grant]);
      assert.equal(await canAccessOrg(user,child,'MEMBERS_VIEW',db),true);
      assert.equal(await canAccessOrg(user,child,'MEMBERS_MANAGE',db),false);
      assert.deepEqual((await orgScopeIds(user,'MEMBERS_VIEW',db)).map(Number).sort((a,b)=>a-b),[Number(parent),Number(child)].sort((a,b)=>a-b));
      await db(`UPDATE app.organizations SET parent_id=NULL WHERE id=$1`,[child]);
      assert.equal(await canAccessOrg(user,child,'MEMBERS_VIEW',db),false,'detached organizations immediately leave scope');
      await db(`UPDATE app.org_access_grants SET valid_to=DATEADD(millisecond,1,valid_from),valid_from=DATEADD(second,-2,valid_from) WHERE id=$1`,[grant]);
      // Make end unambiguously past instead of relying on timing resolution.
      await db(`UPDATE app.org_access_grants SET valid_to=DATEADD(second,-1,SYSUTCDATETIME()) WHERE id=$1`,[grant]);
      assert.equal(await canAccessOrg(user,parent,'MEMBERS_VIEW',db),false);
      await db(`INSERT INTO app.global_role_grants(user_id,role_code) VALUES($1,'REGULATION_MANAGER')`,[user]);
      assert.equal(await hasGlobalRole(user,'REGULATION_MANAGER',db),true);
      assert.equal(await canAccessOrg(user,parent,'MEMBERS_VIEW',db),false,'catalog management does not reveal members');
      await db(`INSERT INTO app.global_role_grants(user_id,role_code) VALUES($1,'SYSTEM_ADMIN')`,[user]);
      assert.equal(await canAccessOrg(user,parent,'MEMBERS_MANAGE',db),true);
      throw rollback;
    });
  } catch(e) { if(e!==rollback) throw e; }
});

test.after(async()=>{await closeDB();});
