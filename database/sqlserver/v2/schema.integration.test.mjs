import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool, getDbPoolConfig } from '../../../backend/src/config/database.js';

const pool = new Pool(getDbPoolConfig());
before(async () => {
  const result = await pool.query("SELECT COUNT(*) AS total FROM app._schema_migrations WHERE name=N'001_v2_schema.sql'");
  assert.equal(result.rows[0].total, 1, 'Apply V2 migrations before running live schema checks.');
});
after(async () => { await pool.end(); });

async function rollbackFixture(work) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); await work(client); }
  finally { await client.release(); }
}
async function insert(client, table, columns, values, params) {
  assert.match(table, /^[a-z_]+$/);
  const result = await client.query(`DECLARE @ids TABLE(id bigint);
    INSERT app.${table} (${columns}) OUTPUT INSERTED.id INTO @ids VALUES (${values});
    SELECT id FROM @ids;`, params);
  return result.rows[0].id;
}
const user = client => insert(client, 'users', 'email', '$1', [`${randomUUID()}@example.test`]);
const organization = (client, owner, parent = null) => insert(client, 'organizations',
  'code,name,organization_type,created_by_user_id,parent_id', "$1,N'Lớp kiểm thử','CLASS',$2,$3", [randomUUID(), owner, parent]);
const achievement = (client, owner) => insert(client, 'achievements',
  'owner_user_id,title,achieved_at', "$1,N'Thành tích kiểm thử','2026-11-15'", [owner]);
const goal = (client, owner) => insert(client, 'kpi_goals',
  'owner_user_id,title,measure_unit', "$1,N'Mục tiêu kiểm thử',N'giờ'", [owner]);
const cv = (client, owner, slug) => slug
  ? insert(client, 'cvs', 'owner_user_id,title,public_slug', "$1,N'CV kiểm thử',$2", [owner, slug])
  : insert(client, 'cvs', 'owner_user_id,title', "$1,N'CV kiểm thử'", [owner]);
const invitation = (client, owner, org, accepted = true) => insert(client, 'membership_invitations',
  'organization_id,invitee_user_id,invited_by_user_id,status,created_at,expires_at,responded_at,responded_by_user_id',
  accepted ? "$1,$2,$2,'ACCEPTED','2020-01-01','2099-01-01','2026-01-01',$2"
    : "$1,$2,$2,'PENDING','2020-01-01','2099-01-01',NULL,NULL", [org, owner]);
const membership = (client, owner, org, invite, from, to = null) => insert(client, 'memberships',
  'user_id,organization_id,invitation_id,valid_from,valid_to', '$1,$2,$3,$4,$5', [owner, org, invite, from, to]);
async function regulation(client, owner) {
  const regulationId = await insert(client, 'regulations', 'code,name,created_by_user_id', "$1,N'Quy chế kiểm thử',$2", [randomUUID(), owner]);
  const versionId = await insert(client, 'regulation_versions',
    'regulation_id,version_label,effective_from,source_title,applicability_json,created_by_user_id',
    "$1,N'v1','2026-01-01',N'Văn bản kiểm thử',N'{}',$2", [regulationId, owner]);
  const criterionId = await insert(client, 'criteria',
    'regulation_version_id,code,title,rule_json,source_reference',
    "$1,N'C1',N'Tiêu chí kiểm thử',N'{}',N'Điều kiểm thử'", [versionId]);
  await client.query("UPDATE app.regulation_versions SET publication_status='PUBLISHED',published_at=SYSUTCDATETIME(),published_by_user_id=$1 WHERE id=$2", [owner, versionId]);
  return { regulationId, versionId, criterionId };
}
const run = (client, owner, version) => insert(client, 'assessment_runs',
  'subject_user_id,initiated_by_user_id,regulation_version_id,evaluation_date,evaluator_version,input_snapshot_json',
  "$1,$1,$2,'2026-11-15',N'test-v1',N'{}'", [owner, version]);

test('a person without any organization can own achievements, KPI and a private CV', () => rollbackFixture(async client => {
  const owner = await user(client);
  await client.query("INSERT app.person_profiles(user_id,full_name,person_type) VALUES($1,N'Người dùng tự do','OTHER')", [owner]);
  assert.ok(await achievement(client, owner));
  assert.ok(await goal(client, owner));
  const cvId = await cv(client, owner);
  const result = await client.query('SELECT public_slug,public_contact_settings_json FROM app.cvs WHERE id=$1', [cvId]);
  assert.match(result.rows[0].public_slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.deepEqual(JSON.parse(result.rows[0].public_contact_settings_json), { email: false, phone: false });
  assert.equal((await client.query('SELECT COUNT(*) AS total FROM app.memberships WHERE user_id=$1', [owner])).rows[0].total, 0);
}));

test('organization parent updates cannot create a cycle', () => rollbackFixture(async client => {
  const owner = await user(client);
  const parent = await organization(client, owner);
  const child = await organization(client, owner, parent);
  await assert.rejects(client.query('UPDATE app.organizations SET parent_id=$1 WHERE id=$2', [child, parent]), /cycle|chu trình/i);
}));

test('membership cannot be activated from a pending invitation', () => rollbackFixture(async client => {
  const owner = await user(client), org = await organization(client, owner);
  const pending = await invitation(client, owner, org, false);
  await assert.rejects(membership(client, owner, org, pending, '2026-01-01'), /accept|invitation|đồng ý/i);
}));

test('overlapping membership periods for the same person and organization are rejected', () => rollbackFixture(async client => {
  const owner = await user(client), org = await organization(client, owner);
  const first = await invitation(client, owner, org);
  const second = await invitation(client, owner, org);
  await membership(client, owner, org, first, '2026-01-01', '2026-07-01');
  await assert.rejects(membership(client, owner, org, second, '2026-06-01', '2026-12-01'), /overlap|chồng/i);
}));

test('half-open adjacent membership periods and membership in another organization are supported', () => rollbackFixture(async client => {
  const owner = await user(client), org = await organization(client, owner);
  const otherOrg = await organization(client, owner);
  await membership(client, owner, org, await invitation(client, owner, org), '2026-01-01', '2026-07-01');
  await membership(client, owner, org, await invitation(client, owner, org), '2026-07-01', null);
  await membership(client, owner, otherOrg, await invitation(client, owner, otherOrg), '2026-01-01');
  assert.equal((await client.query('SELECT COUNT(*) AS total FROM app.memberships WHERE user_id=$1', [owner])).rows[0].total, 3);
}));

test('a CV cannot select an achievement belonging to another person', () => rollbackFixture(async client => {
  const owner = await user(client), other = await user(client);
  const cvId = await cv(client, owner), otherAchievement = await achievement(client, other);
  await assert.rejects(client.query('INSERT app.cv_achievements(cv_id,achievement_id,owner_user_id) VALUES($1,$2,$3)', [cvId, otherAchievement, owner]), /FK_cv_item_achievement/);
}));

test('KPI links cannot count another person achievement', () => rollbackFixture(async client => {
  const owner = await user(client), other = await user(client);
  const goalId = await goal(client, owner), otherAchievement = await achievement(client, other);
  await assert.rejects(client.query('INSERT app.kpi_achievements(goal_id,achievement_id,owner_user_id) VALUES($1,$2,$3)', [goalId, otherAchievement, owner]), /FK_kpi_achievement_item/);
}));

test('a KPI cannot count the same achievement twice', () => rollbackFixture(async client => {
  const owner = await user(client), item = await achievement(client, owner), goalId = await goal(client, owner);
  await client.query('INSERT app.kpi_achievements(goal_id,achievement_id,owner_user_id) VALUES($1,$2,$3)', [goalId, item, owner]);
  await assert.rejects(client.query('INSERT app.kpi_achievements(goal_id,achievement_id,owner_user_id) VALUES($1,$2,$3)', [goalId, item, owner]), /PK_kpi_achievements/);
}));

test('custom CV slugs must be unique', () => rollbackFixture(async client => {
  const owner = await user(client), slug = `test-${randomUUID()}`;
  await cv(client, owner, slug);
  await assert.rejects(cv(client, owner, slug), /UQ_cv_slug/);
}));

test('malformed JSON cannot be stored as achievement attributes', () => rollbackFixture(async client => {
  const owner = await user(client);
  await assert.rejects(client.query("INSERT app.achievements(owner_user_id,title,achieved_at,attributes_json) VALUES($1,N'Bad JSON','2026-01-01',N'{bad')", [owner]), /CK_achievement_json/);
}));

test('criterion results must belong to the version evaluated by their assessment', () => rollbackFixture(async client => {
  const owner = await user(client), a = await regulation(client, owner), b = await regulation(client, owner);
  const runId = await run(client, owner, a.versionId);
  await assert.rejects(client.query(`INSERT app.criterion_results(run_id,subject_user_id,regulation_version_id,criterion_id,conclusion,criterion_snapshot_json)
    VALUES($1,$2,$3,$4,'NOT_MET',N'{}')`, [runId, owner, a.versionId, b.criterionId]), /FK_result_criterion/);
}));

test('published regulation criteria cannot be edited in place', () => rollbackFixture(async client => {
  const owner = await user(client), a = await regulation(client, owner);
  await assert.rejects(client.query("UPDATE app.criteria SET rule_json=N'{\"changed\":true}' WHERE id=$1", [a.criterionId]), /publish|immutable|bất biến/i);
}));

test('completed assessment snapshots cannot be overwritten', () => rollbackFixture(async client => {
  const owner = await user(client), a = await regulation(client, owner), runId = await run(client, owner, a.versionId);
  await client.query(`INSERT app.criterion_results(run_id,subject_user_id,regulation_version_id,criterion_id,conclusion,criterion_snapshot_json)
    VALUES($1,$2,$3,$4,'INSUFFICIENT_DATA',N'{}')`, [runId, owner, a.versionId, a.criterionId]);
  await client.query("UPDATE app.assessment_runs SET status='COMPLETED',conclusion='INSUFFICIENT_DATA',completed_at=SYSUTCDATETIME() WHERE id=$1", [runId]);
  await assert.rejects(client.query("UPDATE app.assessment_runs SET input_snapshot_json=N'{\"changed\":true}' WHERE id=$1", [runId]), /immutable|snapshot|completed|bất biến/i);
}));
