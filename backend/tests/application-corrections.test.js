import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationService, applicationSchema, applicationUpdateSchema } from '../src/modules/awards/applicationService.js';

const body = {version: 1, purpose: 'Corrected purpose', achievementIds: [3], awardRecordIds: []};
function harness(row, owner = true) {
  const calls = [];
  const c = {query: async (sql, values) => {
    calls.push({sql, values});
    if (sql.startsWith('SELECT COALESCE')) return {rows: [{next_version: 2}]};
    if (sql.startsWith('UPDATE app.award_applications')) return {rows: [{...row, purpose: values[1], version: Number(row.version) + 1}]};
    return {rows: []};
  }};
  const s = new ApplicationService();
  s.transaction = async (_user, _action, work) => work(c);
  s.get = async (_id, _user, _c, lock) => {assert.equal(lock, true); return row;};
  s.applicant = async () => {if (!owner) {const err = new Error('owner required');err.statusCode = 403;throw err;}};
  s.history = async () => {};
  s.applicationNotice = async () => {};
  return {s, c, calls};
}

test('create and update require an achievement; update forbids changing subject/cycle/target/status', () => {
  assert.equal(applicationSchema.safeParse({lecturerId: 1, cycleId: 1, targetAwardTypeId: 1, purpose: 'Valid purpose', awardRecordIds: [2]}).success, false);
  for (const extra of [{achievementIds: []}, {lecturerId: 2}, {cycleId: 2}, {targetAwardTypeId: 2}, {status: 'SUBMITTED'}, {achievementIds: [3, 3]}]) {
    assert.equal(applicationUpdateSchema.safeParse({...body, ...extra}).success, false);
  }
});

test('only current applicant can edit mutable states with matching version', async () => {
  for (const status of ['DRAFT', 'NEED_CORRECTION']) {
    const {s, calls} = harness({application_id: 4, status, version: 1});
    await s.update(4, body, {userId: 1});
    const update = calls.find(c=>c.sql.startsWith('UPDATE'));
    assert.match(update.sql, /WHERE application_id=\$1 AND version=\$5 AND status=\$6/);
    assert.deepEqual(update.values, [4, body.purpose, [3], [], 1, status]);
  }
  for (const row of [{status:'SUBMITTED',version:1},{status:'DRAFT',version:2}]) {
    const {s,calls} = harness({application_id: 4, ...row});
    await assert.rejects(s.update(4,body,{userId:1}), e=>e.statusCode===409);
    assert.equal(calls.length,0);
  }
  const {s,calls} = harness({application_id:4,status:'DRAFT',version:1},false);
  await assert.rejects(s.update(4,body,{userId:2}),e=>e.statusCode===403);
  assert.equal(calls.length,0);
});

test('resubmit validates sources before appending immutable input and status change', async () => {
  const row = {application_id:4,status:'NEED_CORRECTION',version:1};
  const {s,calls} = harness(row);
  s.snapshot = async()=>{throw new Error('revoked source');};
  await assert.rejects(s.review(4,{version:1,reason:'Updated sources'},{userId:1},'resubmit'),/revoked source/);
  assert.equal(calls.length,0);
  s.snapshot = async()=>({inputVersion:1,purpose:'Corrected purpose'});
  await s.review(4,{version:1,reason:'Updated sources'},{userId:1},'resubmit');
  const insert = calls.find(c=>c.sql.startsWith('INSERT INTO app.award_application_inputs'));
  assert.equal(insert.values[1],2);
  assert.equal(JSON.parse(insert.values[2]).inputVersion,2);
  assert.ok(calls.indexOf(insert)<calls.findIndex(c=>c.sql.startsWith('UPDATE')));
  assert.ok(!calls.some(c=>c.sql.startsWith('UPDATE app.award_application_inputs')));
});
