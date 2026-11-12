export const scopedRoleCodes = ['MANAGER', 'RECORDS_OFFICER', 'COUNCIL'];
export const permissionKeys = { 'user-roles': 'user_role_id', scopes: 'user_unit_scope_id', representatives: 'unit_representative_id' };
export const localDateTime = value => {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export const liveAssignment = (row, now = Date.now()) => !row.revoked_at && (!row.valid_to || new Date(row.valid_to).getTime() > now);
export function editableAssignment(row) {
  return { original: row, validFrom: localDateTime(row.valid_from), validTo: row.valid_to ? localDateTime(row.valid_to) : '', unitId: row.unit_id, includeDescendants: Boolean(row.include_descendants) };
}
export function serializedPeriod(row) {
  const exact = (field, databaseField) => {
    const value = row[field];
    if (!value) return null;
    const original = row.original?.[databaseField] || row.inheritedPeriod?.[databaseField];
    return new Date(original && localDateTime(original) === value ? original : value).toISOString();
  };
  return { validFrom: exact('validFrom', 'valid_from'), validTo: exact('validTo', 'valid_to') };
}
export function permissionChanges(userId, snapshot, states) {
  const additions = [], revocations = [];
  const add = (resource, values) => additions.push({ resource, values: { userId: Number(userId), ...values } });
  const revoke = (resource, original) => {
    if (original) revocations.push({ resource, id: Number(original[permissionKeys[resource]]) });
  };
  for (const state of states) {
    const representative = state.code === 'UNIT_REPRESENTATIVE';
    for (const [resource, assignments] of [['user-roles', state.grants], [representative ? 'representatives' : 'scopes', state.units]]) {
      for (const row of assignments) {
        const enabled = state.enabled && !row.removed;
        const old = row.original;
        const changed = old && (row.validFrom !== localDateTime(old.valid_from)
          || row.validTo !== (old.valid_to ? localDateTime(old.valid_to) : '')
          || (resource === 'scopes' && row.includeDescendants !== Boolean(old.include_descendants)));
        if (old && (!enabled || changed)) revoke(resource, old);
        if (!enabled || (old && !changed)) continue;
        const values = serializedPeriod(row);
        if (resource !== 'representatives') values.roleId = Number(state.roleId);
        if (resource !== 'user-roles') values.unitId = Number(row.unitId);
        if (resource === 'scopes') values.includeDescendants = row.includeDescendants;
        if (resource === 'user-roles' && state.code === 'LECTURER') {
          if (state.employeeCode?.trim()) values.employeeCode = state.employeeCode.trim();
          if (state.workUnitId) values.unitId = Number(state.workUnitId);
        }
        add(resource, values);
      }
    }
  }
  return { revision: snapshot.revision, additions, revocations };
}
