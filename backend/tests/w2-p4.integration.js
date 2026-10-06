// W2-P4 review demo: real Express + PostgreSQL, isolated schema, outer rollback.
// Review observations deliberately characterize defects; PASS is not acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { Pool, getDbPoolConfig, setPool } from '../src/config/database.js';
import { generateAccessToken } from '../src/utils/crypto.js';
import storage from '../src/modules/evidences/storage/localStorageAdapter.js';
import app from '../src/app.js';

const schema = `w2p4_test_${randomBytes(6).toString('hex')}`;
assert.match(schema, /^w2p4_test_[a-f0-9]{12}$/);
const rewrite = sql => sql.replace(/\bapp\b/g, schema);
const pool = new Pool({ ...getDbPoolConfig(), max: 1, connectionTimeoutMillis: 5000 });
let client, server, injectNotificationFailure = false, removeEvidenceBeforeBegin = null;
const results = [];
const observations = [];
const physicalKeys = new Set();
const saveFile = storage.saveFile.bind(storage);
storage.saveFile = async (key, bytes) => {
  const result = await saveFile(key, bytes);
  physicalKeys.add(key);
  return result;
};
const check = (label, actual, expected) => {
  assert.deepEqual(actual, expected, label);
  results.push(label);
};
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query("SET LOCAL statement_timeout='20s'");
  for (const name of (await fs.readdir(new URL('../../supabase/migrations/', import.meta.url))).filter(n => n.endsWith('.sql')).sort()) {
    await client.query(rewrite(await fs.readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8')));
  }
  // The existing fixture seed is rewritten to the test schema BEFORE executing.
  await client.query(rewrite(await fs.readFile(new URL('../../supabase/seed.sql', import.meta.url), 'utf8')));
  await client.query(rewrite("UPDATE app.users SET email='fixture-'||user_id||'@example.invalid', display_name='W2-P4 SYNTHETIC '||user_id"));
  const adapted = async (sql, values) => {
    if (sql === 'BEGIN') {
      if (removeEvidenceBeforeBegin !== null) {
        // Deterministic interleaving: simulate removal after preflight, before row lock.
        await client.query(rewrite('UPDATE app.evidences SET is_removed=TRUE WHERE evidence_id=$1'), [removeEvidenceBeforeBegin]);
        removeEvidenceBeforeBegin = null;
      }
      return client.query('SAVEPOINT w2p4_mutation');
    }
    if (sql === 'COMMIT') return client.query('RELEASE SAVEPOINT w2p4_mutation');
    if (sql === 'ROLLBACK') {
      await client.query('ROLLBACK TO SAVEPOINT w2p4_mutation');
      return client.query('RELEASE SAVEPOINT w2p4_mutation');
    }
    if (injectNotificationFailure && /INSERT INTO app\.notifications/.test(sql)) {
      throw new Error('W2-P4 synthetic notification failure');
    }
    return client.query(rewrite(sql), values);
  };
  let queue = Promise.resolve();
  const serialized = (sql, values) => {
    const pending = queue.then(() => adapted(sql, values));
    queue = pending.catch(() => {});
    return pending;
  };
  setPool({ query: serialized, connect: async () => ({ query: serialized, release() {} }) });
  const db = (sql, values) => serialized(sql, values);
  const roleSets = { 1: ['LECTURER'], 2: ['MANAGER', 'LECTURER'], 3: ['ADMIN'], 4: ['UNIT_REPRESENTATIVE', 'LECTURER'], 5: ['RECORDS_OFFICER'] };
  const tokens = Object.fromEntries(Object.entries(roleSets).map(([id, roles]) => [id, generateAccessToken({ userId: Number(id), roles })]));
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  async function call(method, path, body, user, expected = 200) {
    const r = await fetch(base + path, { method, headers: { Authorization: `Bearer ${tokens[user]}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await r.json();
    check(`${method} ${path} -> ${expected}`, r.status, expected);
    return data;
  }
  const pdf = suffix => Buffer.from(`%PDF-1.4\nW2-P4 SYNTHETIC ONLY ${suffix}`);
  async function upload(path, user, label, expected = 201) {
    const form = new FormData();
    form.append('title', `W2-P4 SYNTHETIC ${label}`);
    form.append('file', new Blob([pdf(label)], { type: 'application/pdf' }), 'synthetic.pdf');
    const r = await fetch(base + path, { method: 'POST', headers: { Authorization: `Bearer ${tokens[user]}` }, body: form });
    const data = await r.json();
    check(`upload ${label} -> ${expected}`, r.status, expected);
    if (data.data?.file?.storageKey) physicalKeys.add(data.data.file.storageKey);
    if (data.data?.storageKey) physicalKeys.add(data.data.storageKey);
    return data.data;
  }
  const payload = { subjectType: 'LECTURER', achievementTypeId: 3, title: 'W2-P4 SYNTHETIC giáo trình', recognitionYear: 2026 };
  const a = (await call('POST', '/achievements', payload, 1, 201)).data;
  const route = `/achievements/${a.achievementId}`;
  await call('POST', route + '/submit', { version: a.version }, 1, 400);
  const evidence = await upload(route + '/evidences', 1, 'v1');
  const evidenceId = evidence.evidenceId;
  const files1 = (await db('SELECT evidence_file_id,storage_key,sha256_hash FROM app.evidence_files WHERE evidence_id=$1', [evidenceId])).rows;
  files1.forEach(f => physicalKeys.add(f.storage_key));
  const file1 = Number(files1[0].evidence_file_id);
  check('v1 SHA256 matches physical bytes', files1[0].sha256_hash, createHash('sha256').update(pdf('v1')).digest('hex'));
  await call('POST', route + '/submit', { version: a.version }, 4, 403);
  let current = (await call('POST', route + '/submit', { version: a.version, note: 'W2-P4 first snapshot' }, 1)).data;
  const first = (await call('GET', route + '/submissions', null, 1)).data.submissions[0];
  check('revision 1 freezes file v1', [first.revisionNo, first.frozenFilesCount, first.snapshotData.evidences[0].file.evidenceFileId], [1, 1, file1]);
  await call('POST', route + '/request-correction', { version: current.version, reason: 'SYNTHETIC bổ sung minh chứng' }, 2);
  current = (await call('GET', route, null, 1)).data;
  const changed = (await call('PATCH', route, { version: current.version, title: 'W2-P4 SYNTHETIC giáo trình v2' }, 1)).data;
  await upload(`/evidences/${evidenceId}/versions`, 1, 'v2');
  const files2 = (await db('SELECT evidence_file_id,storage_key FROM app.evidence_files WHERE evidence_id=$1 ORDER BY version_no', [evidenceId])).rows;
  files2.forEach(f => physicalKeys.add(f.storage_key));
  check('two immutable file rows', files2.length, 2);
  await call('POST', route + '/submit', { version: a.version }, 1, 409);
  current = (await call('POST', route + '/submit', { version: changed.version }, 1)).data;
  const revisions = (await call('GET', route + '/submissions', null, 1)).data.submissions;
  check('resubmit freezes v2, keeps old title/file', [revisions.length, revisions[0].snapshotData.title, revisions[0].snapshotData.evidences[0].file.evidenceFileId, revisions[1].snapshotData.title, revisions[1].snapshotData.evidences[0].file.evidenceFileId], [2, payload.title, file1, changed.title, Number(files2[1].evidence_file_id)]);
  const frozenDownload = await fetch(base + `/evidence-files/${file1}/download`, { headers: { Authorization: `Bearer ${tokens[1]}` } });
  check('download old v1 status', frozenDownload.status, 200);
  check('download old v1 bytes', Buffer.from(await frozenDownload.arrayBuffer()), pdf('v1'));
  const outsider = await fetch(base + `/evidence-files/${file1}/download`, { headers: { Authorization: `Bearer ${tokens[4]}` } });
  check('outsider download forbidden', outsider.status, 403);
  // Scoped manager stale version, then verify.
  await call('POST', route + '/verify', { version: 1 }, 2, 409);
  current = (await call('POST', route + '/verify', { version: current.version }, 2)).data;
  for (const u of [1, 3, 5]) await upload(route + '/evidences', u, `locked-${u}`, 409);
  await call('PATCH', route, { version: current.version, title: 'SYNTHETIC blocked' }, 1, 409);
  const audit = (await db("SELECT user_id,new_values FROM app.audit_logs WHERE entity_id=$1 AND action='ACHIEVEMENT_VERIFY'", [a.achievementId])).rows;
  check('verify audit has actor and state', [Number(audit[0].user_id), audit[0].new_values.status], [2, 'VERIFIED']);
  check('transaction has notifications', (await db("SELECT COUNT(*)::int AS n FROM app.notifications WHERE entity_type='ACHIEVEMENT' AND entity_id=$1", [a.achievementId])).rows[0].n > 0, true);

  // Collective demo and anti-self-approval with manager-owned personal record.
  const c = (await call('POST', '/achievements', { ...payload, subjectType: 'UNIT', achievementTypeId: 2, organizationUnitId: 2, title: 'W2-P4 SYNTHETIC tập thể' }, 4, 201)).data;
  const cr = `/achievements/${c.achievementId}`;
  await upload(cr + '/evidences', 4, 'collective');
  await call('POST', cr + '/submit', { version: c.version }, 4);
  const self = (await call('POST', '/achievements', { ...payload, title: 'W2-P4 SYNTHETIC manager owner' }, 2, 201)).data;
  const sr = `/achievements/${self.achievementId}`;
  await upload(sr + '/evidences', 2, 'self');
  const submittedSelf = (await call('POST', sr + '/submit', { version: self.version }, 2)).data;
  const selfError = await call('POST', sr + '/verify', { version: submittedSelf.version }, 2, 403);
  check('anti-self-approval error code', selfError.error.code, 'SELF_APPROVAL_PROHIBITED');

  // Inject failure after history/audit writes; the SAME real pg client must roll back.
  const rollback = (await call('POST', '/achievements', { ...payload, title: 'W2-P4 SYNTHETIC rollback' }, 1, 201)).data;
  const rr = `/achievements/${rollback.achievementId}`;
  await upload(rr + '/evidences', 1, 'rollback');
  injectNotificationFailure = true;
  await call('POST', rr + '/submit', { version: rollback.version }, 1, 500);
  injectNotificationFailure = false;
  const rolled = (await call('GET', rr, null, 1)).data;
  check('notification failure restores state/version', [rolled.status, rolled.version], ['DRAFT', rollback.version]);
  for (const table of ['achievement_submissions', 'achievement_status_histories']) {
    check(`notification rollback removes ${table}`, (await db(`SELECT COUNT(*)::int AS n FROM app.${table} WHERE achievement_id=$1`, [rollback.achievementId])).rows[0].n, 0);
  }
  check('notification rollback removes submit audit', (await db("SELECT COUNT(*)::int AS n FROM app.audit_logs WHERE entity_id=$1 AND action='ACHIEVEMENT_SUBMIT'", [rollback.achievementId])).rows[0].n, 0);

  // Review observations, separate from acceptance assertions.
  await call('POST', sr + '/verify', { version: submittedSelf.version }, 3);
  observations.push('P1 ADMIN without MANAGER/scope can verify another subject (HTTP 200)');
  await db('UPDATE app.user_unit_scopes SET valid_to=NOW()-INTERVAL \'1 second\' WHERE user_id=5');
  const outScope = await fetch(base + `/evidence-files/${file1}/download`, { headers: { Authorization: `Bearer ${tokens[5]}` } });
  check('REPRO records officer expired scope still downloads', outScope.status, 200);
  await outScope.arrayBuffer();
  observations.push('P1 RECORDS_OFFICER expired scope can download private evidence (HTTP 200)');
  const fileAudit = (await db("SELECT user_id,new_values FROM app.audit_logs WHERE entity_id=$1 AND action='CREATE_EVIDENCE'", [evidenceId])).rows;
  check('REPRO evidence audit loses actor/data', [fileAudit[0].user_id, fileAudit[0].new_values], [null, null]);
  observations.push('P2 evidence audit actor/new_values are null');

  const missingKey = (await db('SELECT storage_key FROM app.evidence_files ef JOIN app.evidences e USING(evidence_id) WHERE e.achievement_id=$1', [rollback.achievementId])).rows[0].storage_key;
  await storage.deleteFile(missingKey);
  await call('POST', rr + '/submit', { version: rollback.version }, 1);
  observations.push('P1 submit accepts metadata whose physical private file is missing (HTTP 200)');
  const race = (await call('POST', '/achievements', { ...payload, title: 'W2-P4 SYNTHETIC preflight interleaving' }, 1, 201)).data;
  const raceRoute = `/achievements/${race.achievementId}`;
  const raceEvidence = await upload(raceRoute + '/evidences', 1, 'interleaving');
  removeEvidenceBeforeBegin = raceEvidence.evidenceId;
  await call('POST', raceRoute + '/submit', { version: race.version }, 1);
  check('REPRO snapshot contains evidence removed between preflight and transaction', (await db('SELECT is_removed FROM app.evidences WHERE evidence_id=$1', [raceEvidence.evidenceId])).rows[0].is_removed, true);
  observations.push('P1 submit snapshots evidence removed after preflight (deterministic interleaving, not parallel load test)');
  await db('UPDATE app.user_unit_scopes SET valid_to=NOW()-INTERVAL \'1 second\' WHERE user_id=2');
  await call('POST', cr + '/verify', { version: 2 }, 2, 403);
  await db('UPDATE app.unit_representatives SET valid_to=NOW()-INTERVAL \'1 second\' WHERE user_id=4');
  await call('POST', cr + '/cancel', { version: 2, reason: 'SYNTHETIC expired representative' }, 4, 403);

  // W2-P2 real decision flow; use a new record, no AI-generated award.
  await db("UPDATE app.user_unit_scopes SET valid_to=NULL WHERE user_id=5");
  const d = (await call('POST', '/award-decisions', { decisionNumber: 'W2-P4-SYNTHETIC', decisionDate: '2026-10-06', issuer: 'SYNTHETIC', title: 'SYNTHETIC decision' }, 5, 201)).data;
  const award = (await call('POST', '/award-records', { lecturerId: 1, awardTypeId: 1, decisionId: Number(d.decision_id), recognitionYear: 2026 }, 5, 201)).data;
  await call('POST', `/award-records/${award.record_id}/record`, { version: 1 }, 5, 400);
  await upload(`/award-decisions/${d.decision_id}/files`, 5, 'decision');
  await call('POST', `/award-records/${award.record_id}/record`, { version: 1 }, 5);
} finally {
  injectNotificationFailure = false;
  if (server) await new Promise(resolve => server.close(resolve));
  try {
    for (const key of physicalKeys) await storage.deleteFile(key);
    check('all files saved by this run are cleaned up', (await Promise.all([...physicalKeys].map(key => storage.fileExists(key)))).some(Boolean), false);
  } finally {
    storage.saveFile = saveFile;
    if (client) { await client.query('ROLLBACK'); client.release(); }
    try {
      if (client) check('test schema does not exist after outer rollback', (await pool.query('SELECT to_regnamespace($1) AS ns', [schema])).rows[0].ns, null);
    } finally { await pool.end(); }
  }
}
// Only publish a successful report after cleanup and rollback have been verified.
const report = { task: 'W2-P4', baseline: 'f091c57', checkedAt: '2026-10-06', mode: 'REAL_HTTP_POSTGRESQL_ISOLATED_ROLLBACK', assertions: results.length, observations, acceptance: 'CHANGES_REQUIRED', checks: results };
await fs.mkdir(new URL('../../docs/testing/week-2/', import.meta.url), { recursive: true });
await fs.writeFile(new URL('../../docs/testing/week-2/W2_P4_RESULT.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(`W2-P4 PASS: ${results.length} real HTTP/DB/cleanup assertions; ${observations.length} reproduced findings. Acceptance: CHANGES_REQUIRED.`);
