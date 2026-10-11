// Display permissions mirror the workflow; mutation endpoints still enforce authorization.
export function createPermissionResolver(user, roles, { representative, scope }) {
  const reps = new Map();
  const scopes = new Map();
  const sameUser = id => id != null && String(id) === String(user.userId);
  const cached = (cache, key, read) => {
    if (!cache.has(key)) cache.set(key, Promise.resolve().then(read));
    return cache.get(key);
  };
  return async achievement => {
    const personalOwner = sameUser(achievement.lecturer?.userId ?? achievement.lecturerUserId);
    const unitId = achievement.organizationUnitId;
    const unitOwner = achievement.subjectType === 'UNIT' && unitId != null
      && Boolean(await cached(reps, String(unitId), () => representative(user.userId, unitId)));
    const owner = personalOwner || unitOwner;
    const self = personalOwner || sameUser(achievement.createdBy) || sameUser(achievement.submittedBy);
    const manager = roles.includes('MANAGER') && Boolean(await cached(scopes,
      String(achievement.contextUnitId), () => scope(user.userId, achievement.contextUnitId, 'MANAGER')));
    const editable = ['DRAFT', 'NEED_CORRECTION'].includes(achievement.status);
    const canMutate = roles.some(r => ['LECTURER', 'UNIT_REPRESENTATIVE', 'ADMIN'].includes(r));
    const actions = {
      isSelf: self,
      edit: canMutate && editable && (owner || roles.includes('ADMIN')),
      manageEvidence: owner && editable,
      submit: canMutate && owner && editable,
      cancel: canMutate && owner && ['DRAFT', 'NEED_CORRECTION', 'SUBMITTED'].includes(achievement.status),
      review: manager && !self && achievement.status === 'SUBMITTED',
      revoke: manager && achievement.status === 'VERIFIED',
      replace: canMutate && owner && ['REJECTED', 'CANCELLED', 'REVOKED'].includes(achievement.status),
      remove: canMutate && (owner || roles.includes('ADMIN')) && achievement.status === 'DRAFT'
        && !(achievement.latestRevisionNo || achievement.submissions?.length),
    };
    return { ...achievement, actions };
  };
}
