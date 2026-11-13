import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { connectDB, closeDB, setPool } from '../src/config/database.js';
import repo from '../src/modules/achievements/achievementRepository.js';
import { createAchievementService } from '../src/modules/achievements/achievementService.js';
import { cleanupAchievementTrash } from '../src/modules/achievements/achievementTrashCleanup.js';

test('SQL Server achievement trash: owner restore, expiry, version, evidence retention and permanent cleanup', { timeout: 60000 }, async () => {
  const pool = await connectDB();
  const client = await pool.connect();
  await client.query('BEGIN');
  let pending = Promise.resolve();
  const run = (sql, values = []) => {
    if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(sql.trim())) return Promise.resolve({ rows: [], rowCount: 0 });
    const result = pending.then(() => client.query(sql, values));
    pending = result.catch(() => {});
    return result;
  };
  const shared = { query: run, release: async () => {} };
  setPool({ query: run, connect: async () => shared });
  try {
    const { rows: [person] } = await run(`SELECT TOP (1) l.lecturer_id, l.user_id, la.unit_id,
      (SELECT TOP (1) achievement_type_id FROM app.achievement_types WHERE is_active=1) AS type_id
      FROM app.lecturers l JOIN app.lecturer_assignments la ON la.lecturer_id=l.lecturer_id WHERE la.is_primary=1 AND l.user_id IS NOT NULL`);
    assert.ok(person);
    const user = { userId: Number(person.user_id) };
    const service = createAchievementService(repo, { roles: async () => ['LECTURER'], scope: async () => false });
    const title = `Trash test ${randomUUID()}`;
    const draft = await repo.createAchievement({ lecturerId: person.lecturer_id, contextUnitId: person.unit_id, achievementTypeId: person.type_id, title, recognitionYear: 2026, createdBy: user.userId });
    const id = draft.achievementId;
    const actionable = await service.listAchievements(user, { workflow: 'ACTIONABLE', search: title });
    assert.equal(actionable.items.length, 1);
    assert.equal((await service.listAchievements(user, { workflow: 'PENDING', search: title })).items.length, 0);
    // Ensure native parameter binding still checks optimistic versions on normal edits.
    assert.ok(await repo.updateAchievement(id, draft.version, { title: `${title} edited` }));
    assert.equal(await repo.updateAchievement(id, draft.version, { title: 'Stale title' }), null);
    const { rows: [ev] } = await run(`INSERT INTO app.evidences (achievement_id,title,created_by) OUTPUT INSERTED.evidence_id VALUES ($1,N'Trash retained evidence',$2)`, [id, user.userId]);
    const key = `test-trash/${randomUUID()}.pdf`;
    await run(`INSERT INTO app.evidence_files (evidence_id,original_file_name,storage_key,mime_type,file_extension,file_size,sha256_hash,uploaded_by) VALUES ($1,N'test.pdf',$2,N'application/pdf',N'.pdf',10,$3,$4)`, [ev.evidence_id,key,'a'.repeat(64),user.userId]);
    await service.deleteAchievement(user, id);
    assert.equal(await repo.findAchievementById(id), null);
    assert.equal((await repo.listAchievements({ filters: { search: title } })).total, 0);
    const trash = await repo.listAchievements({ filters: { search: title, trash: 'true' } });
    assert.equal(trash.total, 1);
    assert.equal(trash.items[0].evidenceCount, 1);
    assert.equal(await repo.updateAchievement(id, trash.items[0].version, { title: 'Blocked trashed edit' }), null);
    assert.equal(await repo.findAchievementForUpdate(shared, id), null);
    const prematurelyRemoved = [];
    await cleanupAchievementTrash({ deleteFile: async key => { prematurelyRemoved.push(key); return true; }, fileExists: async () => false });
    assert.equal(prematurelyRemoved.includes(key), false);
    assert.equal((await repo.findAchievementById(id,null,true)).submissions.length,0);
    await assert.rejects(service.restoreAchievement({ userId: user.userId + 999999 }, id), error => error.statusCode === 403);
    const restored = await service.restoreAchievement(user,id);
    assert.ok(['ACTIVE', 'DRAFT'].includes(restored.status));
    await service.deleteAchievement(user,id);
    await run('UPDATE app.achievements SET deleted_at = DATEADD(day,-31,SYSUTCDATETIME()) WHERE achievement_id=$1', [id]);
    await assert.rejects(service.restoreAchievement(user,id), error => error.statusCode === 409);
    assert.equal((await repo.listAchievements({ filters: { search: title, trash: 'true' } })).total,0);
    const removed = [];
    await cleanupAchievementTrash({ deleteFile: async key => { removed.push(key); return true; }, fileExists: async () => false });
    assert.ok(removed.includes(key));
    assert.equal(await repo.findAchievementById(id,null,true),null);
    assert.equal((await run('SELECT * FROM app.evidence_files WHERE evidence_id=$1',[ev.evidence_id])).rows.length,0);
    assert.equal((await run('SELECT * FROM app.achievement_trash_file_cleanup WHERE storage_key=$1',[key])).rows.length,0);
    // Cleanup is idempotent and never calls physical storage in this rollback fixture.
    await cleanupAchievementTrash({ deleteFile: async () => true, fileExists: async () => false });
  } finally {
    await pending;
    await client.query('ROLLBACK');
    await client.release();
    setPool(pool);
    await closeDB();
  }
});
