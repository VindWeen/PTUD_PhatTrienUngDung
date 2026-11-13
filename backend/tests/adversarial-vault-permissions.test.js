import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createPermissionResolver } from '../src/modules/achievements/achievementPermissions.js';
import { createAchievementService } from '../src/modules/achievements/achievementService.js';
import achievementRoutes from '../src/modules/achievements/achievementRoutes.js';
import { setPool } from '../src/config/database.js';
import { generateAccessToken } from '../src/utils/crypto.js';
import { ForbiddenError, ConflictError } from '../src/utils/errors.js';

// Setup Mock DB Pool helper for isolation
function setupMockDb(options = {}) {
  const { roles = ['MEMBER', 'LECTURER'], user = { UserId: 1001, Status: 'ACTIVE' }, onQuery } = options;
  setPool({
    query: async (sqlText, params = []) => {
      if (onQuery) {
        const customRes = onQuery(sqlText, params);
        if (customRes !== undefined) return customRes;
      }
      if (sqlText.includes('FROM app.users')) {
        return { rows: [user], rowCount: 1 };
      }
      if (sqlText.includes('FROM app.user_roles')) {
        return {
          rows: roles.map((r, idx) => ({ RoleId: idx + 1, Code: r, Name: r })),
          rowCount: roles.length,
        };
      }
      if (sqlText.includes('FROM app.audit_logs')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  });
}

test.afterEach(() => {
  setPool(null);
});

// =========================================================================
// SECTION 1: Achievement Vault Permissions & State Integrity (Adversarial)
// =========================================================================

test('Adversarial 1.1: Non-owner cannot edit someone else\'s ACTIVE personal achievement', async () => {
  // Case A: Permission Resolver check
  const nonOwnerUser = { userId: 9999, username: 'attacker' };
  const roles = ['MEMBER', 'LECTURER'];
  const resolver = createPermissionResolver(nonOwnerUser, roles, {
    representative: async () => false,
    scope: async () => false,
  });

  const victimActiveAchievement = {
    achievementId: 888,
    subjectType: 'LECTURER',
    lecturer: { userId: 1001 },
    lecturerUserId: 1001,
    status: 'ACTIVE',
    createdBy: 1001,
    version: 1,
  };

  const resolved = await resolver(victimActiveAchievement);
  assert.equal(resolved.actions.isSelf, false);
  assert.equal(resolved.actions.edit, false, 'Non-owner must NOT have edit permission on ACTIVE achievement');
  assert.equal(resolved.actions.remove, false, 'Non-owner must NOT have remove permission on ACTIVE achievement');

  // Case B: Service-level enforcement (updateAchievement throws ForbiddenError)
  setupMockDb({ roles: ['MEMBER', 'LECTURER'] });
  const mockRepo = {
    findAchievementById: async (id) => ({
      achievementId: id,
      subjectType: 'LECTURER',
      lecturer: { userId: 1001 },
      status: 'ACTIVE',
      version: 1,
    }),
    updateAchievement: async () => {
      assert.fail('updateAchievement should NOT be called by non-owner');
    },
  };

  const service = createAchievementService(mockRepo);
  await assert.rejects(
    async () => {
      await service.updateAchievement(nonOwnerUser, 888, { title: 'Hacked Title', version: 1 });
    },
    (err) => {
      assert.ok(err instanceof ForbiddenError, 'Should throw ForbiddenError');
      assert.match(err.message, /Chỉ chủ hồ sơ giảng viên mới được phép chỉnh sửa/);
      return true;
    }
  );
});

test('Adversarial 1.2: Non-owner cannot delete someone else\'s ACTIVE personal achievement', async () => {
  const nonOwnerUser = { userId: 9999, username: 'attacker' };
  setupMockDb({ roles: ['MEMBER', 'LECTURER'] });

  const mockRepo = {
    findAchievementById: async (id) => ({
      achievementId: id,
      subjectType: 'LECTURER',
      lecturer: { userId: 1001 },
      status: 'ACTIVE',
      version: 1,
      submissions: [],
    }),
    deleteAchievement: async () => {
      assert.fail('deleteAchievement should NOT be called by non-owner');
    },
  };

  const service = createAchievementService(mockRepo);
  await assert.rejects(
    async () => {
      await service.deleteAchievement(nonOwnerUser, 888);
    },
    (err) => {
      assert.ok(err instanceof ForbiddenError, 'Should throw ForbiddenError');
      assert.match(err.message, /Chỉ người tạo hoặc chủ sở hữu hồ sơ mới được quyền xóa/);
      return true;
    }
  );
});

test('Adversarial 1.3: Unit leads (DEPARTMENT_HEAD / FACULTY_LEAD) cannot edit or delete personal ACTIVE achievements of members', async () => {
  const deptHeadUser = { userId: 2002, username: 'head.khoa' };
  setupMockDb({ roles: ['DEPARTMENT_HEAD', 'FACULTY_LEAD'] });

  const mockRepo = {
    findAchievementById: async (id) => ({
      achievementId: id,
      subjectType: 'LECTURER',
      lecturer: { userId: 1001 }, // personal achievement of member 1001
      status: 'ACTIVE',
      version: 1,
    }),
    updateAchievement: async () => assert.fail('Unit head must not update personal vault'),
    deleteAchievement: async () => assert.fail('Unit head must not delete personal vault'),
  };

  const service = createAchievementService(mockRepo);

  // Edit attempt
  await assert.rejects(
    async () => {
      await service.updateAchievement(deptHeadUser, 888, { title: 'Head Attempt', version: 1 });
    },
    (err) => {
      assert.ok(err instanceof ForbiddenError);
      return true;
    }
  );

  // Delete attempt
  await assert.rejects(
    async () => {
      await service.deleteAchievement(deptHeadUser, 888);
    },
    (err) => {
      assert.ok(err instanceof ForbiddenError);
      return true;
    }
  );
});

test('Adversarial 1.4: Non-representative user cannot edit or delete ACTIVE unit achievements', async () => {
  const regularUser = { userId: 3003, username: 'reg.member' };
  setupMockDb({ roles: ['MEMBER'] });

  const mockRepo = {
    findAchievementById: async (id) => ({
      achievementId: id,
      subjectType: 'UNIT',
      organizationUnitId: 50,
      status: 'ACTIVE',
      version: 1,
    }),
    findActiveRepresentative: async (userId, unitId) => null, // not representative
    updateAchievement: async () => assert.fail('Non-rep must not update unit achievement'),
    deleteAchievement: async () => assert.fail('Non-rep must not delete unit achievement'),
  };

  const service = createAchievementService(mockRepo);

  // Edit attempt
  await assert.rejects(
    async () => {
      await service.updateAchievement(regularUser, 777, { title: 'Unit Hack', version: 1 });
    },
    (err) => {
      assert.ok(err instanceof ForbiddenError);
      assert.match(err.message, /đại diện đơn vị/);
      return true;
    }
  );

  // Delete attempt
  await assert.rejects(
    async () => {
      await service.deleteAchievement(regularUser, 777);
    },
    (err) => {
      assert.ok(err instanceof ForbiddenError);
      assert.match(err.message, /đại diện đơn vị/);
      return true;
    }
  );
});

test('Adversarial 1.5: Owner CAN edit and delete their own ACTIVE achievement', async () => {
  const ownerUser = { userId: 1001, username: 'owner.user' };
  setupMockDb({ roles: ['MEMBER', 'LECTURER'] });

  let updateCalled = false;
  let deleteCalled = false;

  const mockRepo = {
    findAchievementById: async (id) => ({
      achievementId: id,
      subjectType: 'LECTURER',
      lecturer: { userId: 1001 },
      title: 'Original Title',
      status: 'ACTIVE',
      version: 1,
      submissions: [],
    }),
    updateAchievement: async (id, version, safeUpdates) => {
      updateCalled = true;
      assert.equal(id, 888);
      assert.equal(version, 1);
      assert.equal(safeUpdates.title, 'Updated By Owner');
      return true;
    },
    deleteAchievement: async (id, userId, version) => {
      deleteCalled = true;
      assert.equal(id, 888);
      assert.equal(userId, 1001);
      assert.equal(version, 1);
      return true;
    },
  };

  const service = createAchievementService(mockRepo);

  // 1. Owner updates ACTIVE achievement
  const updatedResult = await service.updateAchievement(ownerUser, 888, {
    title: 'Updated By Owner',
    version: 1,
  });
  assert.equal(updateCalled, true, 'Owner must be able to update their own ACTIVE achievement');
  assert.ok(updatedResult);

  // 2. Owner deletes ACTIVE achievement
  const deleteResult = await service.deleteAchievement(ownerUser, 888);
  assert.equal(deleteCalled, true, 'Owner must be able to delete their own ACTIVE achievement');
  assert.match(deleteResult.message, /thùng rác/);
});

test('Adversarial 1.6: ADMIN CAN edit and delete any user\'s ACTIVE achievement', async () => {
  const adminUser = { userId: 1, username: 'admin' };
  setupMockDb({ roles: ['ADMIN'] });

  let updateCalled = false;
  let deleteCalled = false;

  const mockRepo = {
    findAchievementById: async (id) => ({
      achievementId: id,
      subjectType: 'LECTURER',
      lecturer: { userId: 9999 }, // belongs to someone else
      title: 'Target Title',
      status: 'ACTIVE',
      version: 2,
      submissions: [],
    }),
    updateAchievement: async () => {
      updateCalled = true;
      return true;
    },
    deleteAchievement: async () => {
      deleteCalled = true;
      return true;
    },
  };

  const service = createAchievementService(mockRepo);

  await service.updateAchievement(adminUser, 555, { title: 'Admin Patch', version: 2 });
  assert.equal(updateCalled, true, 'ADMIN should be permitted to update');

  await service.deleteAchievement(adminUser, 555);
  assert.equal(deleteCalled, true, 'ADMIN should be permitted to delete');
});

test('Adversarial 1.7: Soft-deleted ACTIVE achievement locks out mutations until restored', async () => {
  const ownerUser = { userId: 1001, username: 'owner.user' };
  const resolver = createPermissionResolver(ownerUser, ['MEMBER'], {
    representative: async () => false,
    scope: async () => false,
  });

  const softDeletedAchievement = {
    achievementId: 888,
    subjectType: 'LECTURER',
    lecturer: { userId: 1001 },
    status: 'ACTIVE',
    deletedAt: '2026-11-12T10:00:00Z',
  };

  const resolved = await resolver(softDeletedAchievement);
  assert.equal(resolved.actions.edit, false, 'Soft-deleted achievement must not be editable');
  assert.equal(resolved.actions.remove, false, 'Soft-deleted achievement must not be removable again');
  assert.equal(resolved.actions.manageEvidence, false);
  assert.equal(resolved.actions.restore, true, 'Soft-deleted achievement should allow restore');
});

// =========================================================================
// SECTION 2: Decommissioned Endpoints Return HTTP 410 Gone with decommissioned: true
// =========================================================================

test('Adversarial 1.8: All 8 decommissioned endpoints return HTTP 410 Gone with decommissioned: true and trigger 0 DB mutations', async () => {
  const decommissionedActions = [
    'submit',
    'verify',
    'request-correction',
    'reject',
    'cancel',
    'revoke',
    'resubmit',
    'replace',
  ];

  let dbMutationAttempts = 0;
  setupMockDb({
    user: { UserId: 1001, Status: 'ACTIVE', PasswordChangedAt: null },
    roles: ['ADMIN', 'MEMBER'],
    onQuery: (sql) => {
      const upper = sql.toUpperCase();
      if (upper.includes('UPDATE APP.ACHIEVEMENTS') || upper.includes('INSERT INTO APP.ACHIEVEMENT_STATUS_HISTORIES')) {
        dbMutationAttempts++;
      }
      return undefined;
    },
  });

  const token = generateAccessToken({
    userId: 1001,
    username: 'test.user',
    roles: ['ADMIN'],
  });

  const app = express();
  app.use(express.json());
  app.use('/api/v1', achievementRoutes);

  // Global error handler
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message });
  });

  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1/achievements/42`;

  try {
    for (const action of decommissionedActions) {
      const url = `${baseUrl}/${action}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note: 'Adversarial transition trigger' }),
      });

      assert.equal(res.status, 410, `Endpoint /achievements/:id/${action} must return HTTP 410 Gone`);
      const body = await res.json();
      assert.equal(body.success, false, `Response for ${action} must have success: false`);
      assert.equal(body.decommissioned, true, `Response for ${action} must have decommissioned: true`);
      assert.match(
        body.message,
        new RegExp(`\\[${action}\\] đã được bãi bỏ`),
        `Response message for ${action} must inform user of decommission`
      );
    }

    assert.equal(
      dbMutationAttempts,
      0,
      'Zero database mutations or state transitions must occur when decommissioned endpoints are called'
    );
  } finally {
    server.close();
  }
});
