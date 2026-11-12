import test from 'node:test';
import assert from 'node:assert/strict';
import { setPool } from '../src/config/database.js';
import { getPermissions, savePermissions } from '../src/modules/admin/adminRepository.js';
import { permissionsSchema } from '../src/modules/admin/adminSchemas.js';
import { editableAssignment, permissionChanges, serializedPeriod } from '../../frontend/src/services/adminPermissions.js';

const from = '2026-01-01T00:00:00.000Z', to = '2099-12-31T00:00:00.000Z';
const role = { user_role_id: 1, user_id: 7, role_id: 2, valid_from: from, valid_to: null, revoked_at: null };
const scope = { user_unit_scope_id: 1, user_id: 7, role_id: 2, unit_id: 10, valid_from: from, valid_to: null, include_descendants: false, revoked_at: null };
const result = rows => ({ rows, rowCount: rows.length });
function database(initial = {}, failAudit = false) {
  let data = { 'user-roles': [], scopes: [], representatives: [], ...structuredClone(initial) }, backup;
  const statements = [];
  const names = { user_roles: 'user-roles', user_unit_scopes: 'scopes', unit_representatives: 'representatives' };
  const keys = { 'user-roles': 'user_role_id', scopes: 'user_unit_scope_id', representatives: 'unit_representative_id' };
  const client = { release() {}, query: async (sql, args = []) => {
    statements.push(sql);
    if (sql === 'BEGIN') { backup = structuredClone(data); return result([]); }
    if (sql === 'ROLLBACK') { data = backup; return result([]); }
    if (sql.includes('FROM app.users')) return result([{ user_id: 7, status: 'ACTIVE' }]);
    if (sql.includes('FROM app.lecturers')) return result([]);
    if (sql.includes("SELECT role_id FROM app.roles")) return result([{ role_id: 3 }]);
    if (sql.includes('SELECT code FROM app.roles')) return result([{ code: args[0] === 3 ? 'UNIT_REPRESENTATIVE' : 'MANAGER' }]);
    if (sql.includes('FROM app.organization_units')) return result([{ unit_id: args[0] }]);
    for (const [table, resource] of Object.entries(names)) {
      if (sql.startsWith(`SELECT * FROM app.${table} `)) return result(structuredClone(data[resource]));
      if (sql.startsWith(`UPDATE app.${table} SET revoked_at`)) {
        data[resource].find(row => row[keys[resource]] === args[0]).revoked_at = new Date().toISOString();
        return result([]);
      }
    }
    if (sql.startsWith('SELECT 1 FROM app.user_roles')) return result(data['user-roles'].filter(row => !row.revoked_at && row.user_id === args[0] && row.role_id === args[1]));
    if (sql.includes('SELECT 1 FROM app.user_roles ur JOIN')) return result(data['user-roles'].filter(row => !row.revoked_at && row.role_id === 3));
    if (sql.includes('INSERT INTO app.user_roles')) {
      const row = { user_role_id: data['user-roles'].length + 1, user_id: args[0], role_id: args[1], valid_from: args[2], valid_to: args[3], revoked_at: null };
      data['user-roles'].push(row); return result([{ ...row, id: row.user_role_id }]);
    }
    if (sql.includes('INSERT INTO app.user_unit_scopes')) {
      const row = { user_unit_scope_id: data.scopes.length + 1, user_id: args[0], role_id: args[1], unit_id: args[2], include_descendants: args[3], valid_from: args[4], valid_to: args[5], revoked_at: null };
      data.scopes.push(row); return result([{ ...row, id: row.user_unit_scope_id }]);
    }
    if (failAudit && sql.includes('INSERT INTO app.audit_logs')) throw Error('synthetic audit failure');
    return result([]);
  } };
  setPool({ connect: async () => client });
  return { statements, data: () => data };
}
test.afterEach(() => setPool(null));

test('editor preserves untouched periods exactly, including seconds and future grants', () => {
  const original = { ...role, valid_from: '2028-01-01T04:12:59.123Z' };
  const state = { roleId: 2, code: 'MANAGER', enabled: true, grants: [editableAssignment(original)], units: [editableAssignment(scope)] };
  assert.deepEqual(permissionChanges(7, { revision: 'a'.repeat(64) }, [state]), { revision: 'a'.repeat(64), additions: [], revocations: [] });
  state.enabled = false;
  const changes = permissionChanges(7, { revision: 'a'.repeat(64) }, [state]);
  assert.deepEqual(changes.revocations.map(row => row.resource), ['user-roles', 'scopes']);
  assert.equal(changes.additions.length, 0);
});

test('changing scope descendants replaces only that scope and keeps role unchanged', () => {
  const row = editableAssignment(scope); row.includeDescendants = true;
  const changes = permissionChanges(7, { revision: 'a'.repeat(64) }, [{ roleId: 2, code: 'MANAGER', enabled: true, grants: [editableAssignment(role)], units: [row] }]);
  assert.deepEqual(changes.revocations, [{ resource: 'scopes', id: 1 }]);
  assert.equal(changes.additions.length, 1);
  assert.equal(changes.additions[0].values.includeDescendants, true);
});

test('editing one period field preserves exact untouched timestamp and scopes inherit role boundaries', () => {
  const preciseRole = { ...role, valid_from: '2028-01-01T04:12:59.123Z', valid_to: '2029-01-01T04:12:59.456Z' };
  const grant = editableAssignment(preciseRole);
  grant.validFrom = grant.validFrom.replace('2028', '2027');
  assert.equal(serializedPeriod(grant).validTo, preciseRole.valid_to);
  const source = editableAssignment(preciseRole);
  const newScope = { validFrom: source.validFrom, validTo: source.validTo, unitId: 10, includeDescendants: false,
    inheritedPeriod: { valid_from: preciseRole.valid_from, valid_to: preciseRole.valid_to } };
  const changes = permissionChanges(7, { revision: 'a'.repeat(64) }, [{ roleId: 2, code: 'MANAGER', enabled: true, grants: [source], units: [newScope] }]);
  assert.equal(changes.additions[0].values.validFrom, preciseRole.valid_from);
  assert.equal(changes.additions[0].values.validTo, preciseRole.valid_to);
  const oldScope = editableAssignment({ ...scope, valid_from: preciseRole.valid_from, valid_to: preciseRole.valid_to });
  oldScope.includeDescendants = true;
  assert.deepEqual(serializedPeriod(oldScope), { validFrom: preciseRole.valid_from, validTo: preciseRole.valid_to });
});

test('bulk schema rejects representatives without end dates and invalid role periods', () => {
  const base = { revision: 'a'.repeat(64), revocations: [] };
  assert.equal(permissionsSchema.safeParse({ ...base, additions: [{ resource: 'representatives', values: { userId: 7, unitId: 10, validFrom: from, validTo: null } }] }).success, false);
  assert.equal(permissionsSchema.safeParse({ ...base, additions: [{ resource: 'user-roles', values: { userId: 7, roleId: 2, validFrom: to, validTo: from } }] }).success, false);
});

test('bulk saves dependent scopes after role in one audited transaction', async () => {
  const db = database();
  const snapshot = await getPermissions(7); db.statements.length = 0;
  const values = { revision: snapshot.revision, revocations: [], additions: [
    { resource: 'scopes', values: { userId: 7, roleId: 2, unitId: 10, validFrom: from, validTo: null, includeDescendants: true } },
    { resource: 'user-roles', values: { userId: 7, roleId: 2, validFrom: from, validTo: null } },
  ] };
  const saved = await savePermissions(1, 7, values);
  assert.equal(saved.added, 2);
  assert.equal(db.data().scopes.length, 1);
  assert.equal(db.statements.filter(sql => sql === 'BEGIN').length, 1);
  assert.equal(db.statements.filter(sql => sql.includes('INSERT INTO app.audit_logs')).length, 1);
  assert.equal(db.statements.at(-1), 'COMMIT');
});

test('a stale editor and cross-user revocation cannot overwrite permissions', async () => {
  const db = database({ 'user-roles': [role] });
  const snapshot = await getPermissions(7);
  await assert.rejects(savePermissions(1, 7, { revision: 'b'.repeat(64), additions: [], revocations: [] }), /Quyền đã thay đổi/);
  await assert.rejects(savePermissions(1, 7, { revision: snapshot.revision, additions: [], revocations: [{ resource: 'user-roles', id: 99 }] }), /không thuộc tài khoản/);
  assert.equal(db.data()['user-roles'][0].revoked_at, null);
  assert.equal(db.statements.at(-1), 'ROLLBACK');
});

test('late validation failure rolls back role revocation if a dependent scope remains', async () => {
  const db = database({ 'user-roles': [role], scopes: [scope] });
  const snapshot = await getPermissions(7);
  await assert.rejects(savePermissions(1, 7, { revision: snapshot.revision, additions: [], revocations: [{ resource: 'user-roles', id: 1 }] }), /phạm vi phụ thuộc/);
  assert.equal(db.data()['user-roles'][0].revoked_at, null);
  assert.equal(db.statements.at(-1), 'ROLLBACK');
});

test('audit failure rolls back all new grants and scopes', async () => {
  const db = database({}, true);
  const snapshot = await getPermissions(7);
  await assert.rejects(savePermissions(1, 7, { revision: snapshot.revision, revocations: [], additions: [{ resource: 'user-roles', values: { userId: 7, roleId: 2, validFrom: from, validTo: null } }] }), /synthetic audit failure/);
  assert.equal(db.data()['user-roles'].length, 0);
  assert.equal(db.statements.at(-1), 'ROLLBACK');
});
