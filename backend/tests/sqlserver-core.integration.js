import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import express from 'express';
import { connectDB, closeDB, setPool } from '../src/config/database.js';
import * as auth from '../src/modules/auth/authRepository.js';
import { register } from '../src/modules/auth/registrationService.js';
import * as admin from '../src/modules/admin/adminRepository.js';
import * as profiles from '../src/modules/profiles/profileRepository.js';
import * as organizations from '../src/modules/organizations/organizationRepository.js';
import achievements from '../src/modules/achievements/achievementRepository.js';
import { AchievementService } from '../src/modules/achievements/achievementService.js';
import evidences from '../src/modules/evidences/evidenceRepository.js';
import { calendarService } from '../src/modules/calendar/calendarService.js';
import * as selections from '../src/modules/selections/selectionService.js';
import * as notifications from '../src/modules/notifications/notificationService.js';
import { getAuditLogs } from '../src/modules/audit/auditService.js';
import cvRoutes from '../src/modules/cv/cvRoutes.js';
import { emptyDraft } from '../src/modules/cv/cvSchemas.js';
import { generateAccessToken } from '../src/utils/crypto.js';

async function verifyCvHttp(owner, achievementId) {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', cvRoutes);
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const token = generateAccessToken({ userId: owner.userId, email: owner.email, passwordChangedAt: null });
  const request = async (method, path, payload, expected = 200) => {
    const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
    const json = await response.json();
    assert.equal(response.status, expected, JSON.stringify(json));
    return json.data;
  };
  try {
    const draft = { ...emptyDraft, headline: 'Native SQL CV', achievementIds: [achievementId] };
    const saved = await request('PUT', '/me/cv', draft);
    assert.equal(saved.version, 1);
    await request('PUT', '/me/cv', draft, 409);
    assert.equal((await request('GET', '/me/cv')).draft.version, 1);
    const published = await request('POST', '/me/cv/publish', { version: saved.version });
    assert.equal((await request('GET', `/cv/${published.publicId}`)).achievements.length, 1);
    const edited = await request('PUT', '/me/cv', { ...draft, version: published.version, headline: 'native SQL CV' });
    assert.equal((await request('GET', '/me/cv')).unpublishedChanges, true);
    const rotated = await request('POST', '/me/cv/rotate-link', { version: edited.version });
    await request('GET', `/cv/${published.publicId}`, null, 404);
    await request('GET', `/cv/${rotated.publicId}`);
    await request('POST', '/me/cv/unpublish', { version: rotated.version });
    await request('GET', `/cv/${rotated.publicId}`, null, 404);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

// Execute real native SQL through the production adapter, while keeping every
// fixture and service transaction inside one outer transaction that always rolls back.
async function rollbackFixture(pool, work) {
  const client = await pool.connect();
  await client.query('BEGIN');
  let pending = Promise.resolve();
  const run = (text, params = []) => {
    if (/^(BEGIN|COMMIT|ROLLBACK)(?: TRANSACTION)?$/i.test(text.trim())) return Promise.resolve({ rows: [], rowCount: 0 });
    const result = pending.then(() => client.query(text, params)).catch(error => {
      error.integrationSql = text; // Native SQL only; never expose bound secret values.
      throw error;
    });
    pending = result.catch(() => {});
    return result;
  };
  const sharedClient = { query: run, release: async () => {} };
  const sharedPool = { query: run, ready: async () => sharedPool, connect: async () => sharedClient };
  setPool(sharedPool);
  try { return await work(sharedClient); }
  finally {
    await pending;
    await client.query('ROLLBACK');
    await client.release();
    setPool(pool);
  }
}

test('SQL Server native auth, repositories, snapshots, triggers and rollback', { timeout: 120000 }, async t => {
  const pool = await connectDB();
  const marker = `sqltest_${randomUUID().replaceAll('-', '').slice(0, 18)}`;
  try {
    const an = await auth.findUserByUsernameOrEmail('an.nv');
    assert.ok(an?.UserId, 'migrated an.nv account exists');
    assert.equal((await auth.findUserById(an.UserId)).Username, 'an.nv');
    assert.ok((await auth.getActiveRoles(an.UserId)).some(r => r.Code === 'LECTURER'));
    const profile = await auth.getLecturerProfile(an.UserId);
    assert.ok(profile?.lecturerId);
    await auth.getActiveScopes(an.UserId);
    assert.equal(typeof await auth.isUnitInUserScope(an.UserId, profile.primaryUnit.unitId, 'MANAGER'), 'boolean');
    await profiles.findLecturerById(profile.lecturerId);
    await profiles.findLecturerByUserId(an.UserId);
    await profiles.getWorkHistory(profile.lecturerId);
    await profiles.getTitlesAndHonors(profile.lecturerId);
    await profiles.getProfileStats(profile.lecturerId);
    await organizations.listUnits();
    await organizations.findUnit(profile.primaryUnit.unitId);
    await organizations.getCurrentRepresentative(profile.primaryUnit.unitId);
    await organizations.getUnitStats(profile.primaryUnit.unitId);
    await organizations.getDependencyCounts(profile.primaryUnit.unitId);
    await achievements.listActiveTypes();
    assert.ok((await achievements.listDescendantUnitIds([profile.primaryUnit.unitId])).includes(Number(profile.primaryUnit.unitId)));
    await achievements.listAchievements({ filters: { contextUnitIds: [profile.primaryUnit.unitId], search: 'nghiên' }, limit: 2 });
    for (const resource of ['users', 'roles', 'scopes', 'user-roles', 'representatives', 'academic-years', 'achievement-types', 'award-types']) await admin.list(resource);
    await selections.options({ userId: an.UserId }, 'REPORT');
    assert.ok(Array.isArray((await notifications.listNotifications({ userId: an.UserId })).items));
    await getAuditLogs({ userId: an.UserId, limit: 2 });
    await calendarService().list({ userId: an.UserId });
    await calendarService().listSystem();
    t.diagnostic('Migrated source reads and native JSON/pagination queries passed');

    await rollbackFixture(pool, async client => {
      const unit = await organizations.createUnit({ code: marker, name: 'SQL Server rollback fixture', type: 'DEPARTMENT' });
      const editedUnit = await organizations.updateUnit(unit.unitId, unit.version, { code: marker, name: 'Edited rollback fixture', type: 'DEPARTMENT', isActive: true });
      assert.equal(editedUnit.version, 2);
      assert.equal(await organizations.updateUnit(unit.unitId, unit.version, { code: marker, name: 'Stale update', type: 'DEPARTMENT', isActive: true }), null);
      const child = await organizations.createUnit({ code: `${marker}_child`, name: 'Child fixture', type: 'DIVISION', parentId: unit.unitId });
      assert.equal(await organizations.hasDescendant(unit.unitId, child.unitId), true);
      assert.deepEqual((await achievements.listDescendantUnitIds([unit.unitId])).sort((a,b) => a-b), [Number(unit.unitId), Number(child.unitId)].sort((a,b) => a-b));

      const makeUser = async suffix => {
        const email = `${marker}_${suffix}@example.invalid`;
        await register({ fullName: `Rollback ${suffix}`, email, password: 'RollbackOnly2026!' });
        const row = await auth.findUserByUsernameOrEmail(email);
        return { userId: Number(row.UserId), email };
      };
      const owner = await makeUser('owner');
      const manager = await makeUser('manager');
      const lecturer = await profiles.findLecturerByUserId(owner.userId);
      const changedProfile = await profiles.updateLecturer(lecturer.lecturerId, lecturer.version, { phone: '0901234567', title: 'Giảng viên', degree: 'Thạc sĩ' });
      assert.equal(changedProfile.phone, '0901234567');
      assert.equal(await profiles.updateLecturer(lecturer.lecturerId, lecturer.version, { phone: 'stale' }), null);
      const token = await auth.createRefreshToken({ userId: owner.userId, tokenHash: `${marker}_token`, expiresAt: '2099-01-01T00:00:00Z' });
      const rotated = await auth.rotateRefreshToken(token.RefreshTokenId, { userId: owner.userId, newTokenHash: `${marker}_rotated`, newExpiresAt: '2099-01-01T00:00:00Z' });
      assert.ok(rotated.newTokenId);
      assert.ok((await auth.findRefreshTokenByHash(`${marker}_token`)).RevokedAt);
      await assert.rejects(auth.rotateRefreshToken(token.RefreshTokenId, { userId: owner.userId, newTokenHash: `${marker}_reused`, newExpiresAt: '2099-01-01T00:00:00Z' }), e => e.statusCode === 401);
      assert.equal(await auth.revokeRefreshTokenByHash(`${marker}_rotated`), true);
      const catalogFields = { code: `${marker}_type`, name: 'Rollback type', description: null, applicableSubjectType: 'BOTH', isActive: true };
      const createdType = await admin.saveCatalog(manager.userId, 'achievement-types', null, catalogFields);
      const editedType = await admin.saveCatalog(manager.userId, 'achievement-types', createdType.id, { ...catalogFields, name: 'Edited rollback type' });
      assert.equal(editedType.name, 'Edited rollback type');
      assert.equal((await admin.deactivateCatalog(manager.userId, 'achievement-types', createdType.id)).is_active, false);
      await organizations.transferLecturer({ lecturerId: lecturer.lecturerId, unitId: unit.unitId, effectiveAt: '2000-01-01T00:00:00Z', assignedBy: manager.userId });
      const roles = (await client.query('SELECT role_id,code FROM app.roles')).rows;
      const roleId = code => roles.find(r => r.code === code).role_id;
      await admin.assign(manager.userId, 'user-roles', { userId: manager.userId, roleId: roleId('MANAGER'), validFrom: '2000-01-01T00:00:00Z', validTo: null });
      const scope = await admin.assign(manager.userId, 'scopes', { userId: manager.userId, roleId: roleId('MANAGER'), unitId: unit.unitId, includeDescendants: true, validFrom: '2000-01-01T00:00:00Z', validTo: null });
      assert.equal(await auth.isUnitInUserScope(manager.userId, child.unitId, 'MANAGER'), true);
      await admin.assign(manager.userId, 'user-roles', { userId: owner.userId, roleId: roleId('UNIT_REPRESENTATIVE'), validFrom: '2000-01-01T00:00:00Z', validTo: null });
      const rep = await admin.assign(manager.userId, 'representatives', { userId: owner.userId, unitId: unit.unitId, validFrom: '2000-01-01T00:00:00Z', validTo: '2099-01-01T00:00:00Z' });
      assert.ok((await achievements.findActiveRepresentative(owner.userId, unit.unitId)).unitRepresentativeId);

      const type = (await achievements.listActiveTypes()).find(r => r.applicable_subject_type !== 'UNIT');
      assert.ok(type);
      const service = new AchievementService({ adapter: { fileExists: async () => true } });
      const draft = await service.createAchievement(owner, { subjectType: 'LECTURER', achievementTypeId: Number(type.achievement_type_id), title: marker, recognitionYear: 2026, startDate: '2026-01-01' });
      assert.equal(draft.startDate, '2026-01-01');
      const edited = await service.updateAchievement(owner, draft.achievementId, { version: draft.version, title: `${marker} edited` });
      assert.equal(edited.version, 2);
      await assert.rejects(service.updateAchievement(owner, draft.achievementId, { version: 1, title: 'stale' }), e => e.statusCode === 409);
      const evidence = await evidences.createEvidenceRecord({ achievementId: draft.achievementId, title: 'Rollback evidence', description: 'Private fixture', createdBy: owner.userId }, client);
      const fileArgs = { evidenceId: evidence.evidenceId, originalFileName: 'proof.pdf', storageKey: `${marker}/proof.pdf`, mimeType: 'application/pdf', fileExtension: '.pdf', fileSize: 100, sha256Hash: 'a'.repeat(64), uploadedBy: owner.userId };
      await evidences.createEvidenceFileRecord({ ...fileArgs, versionNo: 1 }, client);
      const secondFile = await evidences.createEvidenceFileRecord({ ...fileArgs, storageKey: `${marker}/proof-v2.pdf`, versionNo: 2 }, client);
      assert.equal(await evidences.getLatestVersionNo(evidence.evidenceId, client), 2);
      assert.equal((await evidences.getEvidenceFiles(evidence.evidenceId, client)).length, 2);
      assert.equal((await evidences.getEvidencesByAchievementId(draft.achievementId))[0].latestFileId, secondFile.evidenceFileId);
      assert.equal((await evidences.findEvidenceFileDetail(secondFile.evidenceFileId)).achievementId, draft.achievementId);
      assert.equal((await evidences.findEvidenceById(evidence.evidenceId, client)).isRemoved, false);
      const submitted = await service.submitAchievement(owner, draft.achievementId, { version: 2, note: 'Native snapshot test' });
      assert.equal(submitted.status, 'SUBMITTED');
      const submissions = await achievements.listSubmissions(draft.achievementId);
      assert.equal(submissions.length, 1);
      assert.equal(submissions[0].frozenFilesCount, 1);
      assert.equal(submissions[0].snapshotData.evidences[0].file.evidenceFileId, secondFile.evidenceFileId);
      assert.equal((await achievements.linkSubmissionEvidenceFiles(client, submissions[0].submissionId, [secondFile.evidenceFileId])).length, 0);
      const verified = await service.verifyAchievement(manager, draft.achievementId, { version: submitted.version, note: 'Verified in rollback test' });
      assert.equal(verified.status, 'VERIFIED');
      assert.equal((await achievements.listHistories(draft.achievementId)).length, 2);
      await verifyCvHttp(owner, draft.achievementId);
      await assert.rejects(service.updateAchievement(owner, draft.achievementId, { version: verified.version, title: 'forbidden' }), e => e.statusCode === 409);
      const inbox = await notifications.listNotifications(owner);
      assert.ok(inbox.items.length);
      assert.ok((await notifications.readNotification(owner, inbox.items[0].notificationId)).readAt);
      assert.equal((await notifications.notifyStatusChanged(client, { entityType: 'ACHIEVEMENT', entityId: draft.achievementId, version: verified.version, fromStatus: 'SUBMITTED', toStatus: 'VERIFIED' })).length, 0);
      await admin.revoke(manager.userId, 'representatives', rep.id);
      await admin.revoke(manager.userId, 'scopes', scope.id);
      assert.equal(await auth.isUnitInUserScope(manager.userId, child.unitId, 'MANAGER'), false);

      const calendar = calendarService();
      const event = { title: marker, startsAt: '2026-11-10T10:00', endsAt: '2026-11-10T11:00', allDay: false, category: 'personal' };
      const createdEvent = await calendar.create(owner, event);
      const editedEvent = await calendar.update(owner, createdEvent.id, { ...event, version: createdEvent.version, completed: true });
      assert.equal(editedEvent.completed, true);
      await calendar.remove(owner, editedEvent.id, editedEvent.version);
      t.diagnostic('Rollback CRUD, optimistic conflicts, snapshot latest-file freezing, notification idempotency and trigger-safe OUTPUT passed');
    });
    assert.equal((await pool.query('SELECT COUNT(*) AS n FROM app.organization_units WHERE code=$1', [marker])).rows[0].n, 0);
    assert.equal((await auth.findUserByUsernameOrEmail(`${marker}_owner@example.invalid`)), null);

    // Validation triggers deliberately abort their transaction, so each gets its own outer rollback.
    for (const scenario of ['cycle', 'overlap']) {
      await assert.rejects(rollbackFixture(pool, async () => {
        const unit = await organizations.createUnit({ code: `${marker}_${scenario}`, name: 'Trigger fixture', type: 'DEPARTMENT' });
        if (scenario === 'cycle') {
          const child = await organizations.createUnit({ code: `${marker}_${scenario}_c`, name: 'Child', type: 'DIVISION', parentId: unit.unitId });
          await organizations.updateUnit(unit.unitId, unit.version, { code: `${marker}_${scenario}`, name: 'Cycle forbidden', type: 'DEPARTMENT', isActive: true, parentId: child.unitId });
        } else {
          const args = { unitId: unit.unitId, userId: an.UserId, validFrom: '2000-01-01T00:00:00Z', assignedBy: an.UserId };
          await organizations.appointRepresentative(args);
          await organizations.appointRepresentative(args);
        }
      }), error => ['23514', '23P01'].includes(error.code) || error.sqlServerNumber === 51014);
    }
    t.diagnostic('Cycle and overlapping representation triggers reject invalid writes; all fixture data rolled back');
  } finally { setPool(pool); await closeDB(); }
});
