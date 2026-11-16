import test from 'node:test';
import assert from 'node:assert/strict';
import { initialManagerPermissions } from '../src/v2/identityRoutes.js';
import { permissions } from '../src/v2/access.js';

function scopeDb(descendantPermissions=[]) {
  return async(sql,args=[])=>{
    if(sql.includes('app.global_role_grants')) return {rows:[]};
    assert.equal(args[0],20);
    assert.equal(args[1],10);
    assert.equal(args[3],1,'delegating a child requires a descendant grant at its parent');
    return {rows:descendantPermissions.includes(args[2])?[{id:1}]:[]};
  };
}
test('creating a child with only exact-parent structure permission cannot mint manager privileges',async()=>{
  await assert.rejects(initialManagerPermissions(10,20,undefined,scopeDb()),e=>e.statusCode===403);
  await assert.rejects(initialManagerPermissions(10,20,[{permissionCode:'ACCESS_MANAGE',includeDescendants:true}],scopeDb()),e=>e.statusCode===403);
});
test('child manager defaults derive only current descendant permissions',async()=>{
  const grants=await initialManagerPermissions(10,20,undefined,scopeDb(['STRUCTURE_MANAGE','ACCESS_MANAGE']));
  assert.deepEqual(grants,[{permissionCode:'STRUCTURE_MANAGE',includeDescendants:true},{permissionCode:'ACCESS_MANAGE',includeDescendants:true}]);
  assert.equal(grants.some(g=>g.permissionCode==='ASSESSMENTS_VIEW'),false);
});
test('explicit child grants cannot exceed authority and preserve the requested scope',async()=>{
  const db=scopeDb(['ACCESS_MANAGE']);
  await assert.rejects(initialManagerPermissions(10,20,[{permissionCode:'ACCESS_MANAGE',includeDescendants:false},{permissionCode:'ASSESSMENTS_VIEW',includeDescendants:false}],db),e=>e.statusCode===403);
  assert.deepEqual(await initialManagerPermissions(10,20,[{permissionCode:'ACCESS_MANAGE',includeDescendants:false}],db),[{permissionCode:'ACCESS_MANAGE',includeDescendants:false}]);
});
test('an independent root establishes full ownership without consulting a parent scope',async()=>{
  const grants=await initialManagerPermissions(10,null,undefined,()=>{throw new Error('no parent lookup');});
  assert.deepEqual(grants.map(g=>g.permissionCode),permissions);
  assert.equal(grants.every(g=>g.includeDescendants),true);
});
