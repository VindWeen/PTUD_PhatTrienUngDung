import test from 'node:test';
import assert from 'node:assert/strict';
import { setPool } from '../src/config/database.js';
import { assignmentSchema, representativeSchema, catalogDefinitions } from '../src/modules/admin/adminSchemas.js';
import { deactivateCatalog, updateUser, revoke, mutate } from '../src/modules/admin/adminRepository.js';
import { isUnitInUserScope } from '../src/modules/auth/authRepository.js';
import { authenticate } from '../src/middlewares/authenticate.js';
import { requireRoles } from '../src/middlewares/requireRoles.js';
import { generateAccessToken } from '../src/utils/crypto.js';

test('reject invalid assignment periods, unsafe IDs and catalog dates', () => {
  const base = { userId: 1, roleId: 3, validFrom: '2026-10-02T00:00:00Z', validTo: '2026-10-01T00:00:00Z' };
  assert.equal(assignmentSchema.safeParse(base).success,false);
  assert.equal(assignmentSchema.safeParse({ ...base, userId: '9007199254740993', validTo: null }).success,false);
  assert.equal(representativeSchema.safeParse({ userId:1,unitId:1,validFrom:base.validFrom,validTo:base.validFrom }).success,false);
  assert.equal(catalogDefinitions['academic-years'].schema.safeParse({ code:'2026',name:'Test',startDate:'2026-10-02',endDate:'2026-09-01' }).success,false);
  assert.equal(catalogDefinitions['award-types'].schema.safeParse({ code:'CSTĐ_CS',name:'Danh mục đã chốt',category:'TITLE',level:'UNIVERSITY' }).success,true);
});

test('deactivate keeps referenced catalog and audits in same transaction; failure rolls back', async () => {
  const statements = [];
  const client = { query: async (sql) => { statements.push(sql); return { rows: [{ id:9,is_active:false }],rowCount:1 }; }, release() {} };
  setPool({ connect: async () => client });
  await deactivateCatalog(3,'award-types',9);
  assert.match(statements[1],/UPDATE app.award_types SET is_active=FALSE/);
  assert.ok(statements.some(s => s.includes('INSERT INTO app.audit_logs')));
  assert.equal(statements.at(-1),'COMMIT');
  assert.ok(!statements.some(s => /DELETE FROM/.test(s)));
  await assert.rejects(() => mutate(3,'test',async () => { throw new Error('failure'); }));
  assert.equal(statements.at(-1),'ROLLBACK');
});

test('account deactivation revokes refresh tokens; cancelled future scope retains validity', async () => {
  const statements = [];
  const client = { query: async sql => { statements.push(sql); return { rows:[{ id:1,status:'INACTIVE' }],rowCount:1 }; },release() {} };
  setPool({ connect: async () => client });
  await updateUser(3,1,{ email:'a@example.invalid',displayName:'A',status:'INACTIVE',version:1 });
  assert.ok(statements.some(s => /UPDATE app.refresh_tokens SET revoked_at/.test(s)));
  await revoke(3,'scopes',1);
  assert.ok(statements.some(s => /UPDATE app.user_unit_scopes SET revoked_at/.test(s)));
  assert.ok(!statements.some(s => /DELETE FROM|SET valid_to/.test(s)));
});

test('scope re-queries current DB state each time and guards role, account, unit and expiry', async () => {
  let revoked = false;
  setPool({ query: async sql => {
    assert.match(sql,/s.revoked_at IS NULL/);
    assert.match(sql,/ur.revoked_at IS NULL/);
    assert.match(sql,/u.status = 'ACTIVE'/);
    assert.match(sql,/root.is_active = TRUE/);
    assert.match(sql,/s.valid_to > NOW\(\)/);
    assert.match(sql,/h.include_descendants = TRUE/);
    return { rows: revoked ? [] : [{ HasScope:1 }] };
  } });
  assert.equal(await isUnitInUserScope(2,2,'MANAGER'),true);
  revoked = true;
  assert.equal(await isUnitInUserScope(2,2,'MANAGER'),false);
});

test('existing access token denied immediately after account lock; Admin cannot claim Manager from JWT', async () => {
  const token = generateAccessToken({ userId:3,roles:['ADMIN','MANAGER'] });
  setPool({ query: async () => ({ rows:[{ Status:'LOCKED' }] }) });
  let failure;
  await authenticate({ headers:{ authorization:`Bearer ${token}` } },{},e => { failure=e; });
  assert.equal(failure.code,'UNAUTHORIZED');
  setPool({ query: async () => ({ rows:[{ Code:'ADMIN' }] }) });
  await requireRoles('MANAGER')({ user:{ userId:3,roles:['MANAGER'] } },{},e => { failure=e; });
  assert.equal(failure.code,'FORBIDDEN');
});
