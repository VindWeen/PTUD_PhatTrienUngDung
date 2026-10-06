// W2-Q4 integration test: Real Express + PostgreSQL on Supabase, isolated schema, outer rollback.
// Verifies all security gates: No URL/file bypass, expired representative blocked,
// anti-self-approval enforced, manager scope strictly enforced, ADMIN cannot bypass matrix,
// VERIFIED does NOT generate AwardRecord, and transactional notifications/audits.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { Pool, getDbPoolConfig, setPool } from '../src/config/database.js';
import { generateAccessToken } from '../src/utils/crypto.js';
import storage from '../src/modules/evidences/storage/localStorageAdapter.js';
import app from '../src/app.js';

const schema = `w2q4_test_${randomBytes(6).toString('hex')}`;
assert.match(schema, /^w2q4_test_[a-f0-9]{12}$/);
const rewrite = sql => sql.replace(/\bapp\b/g, schema);
const pool = new Pool({ ...getDbPoolConfig(), max: 1, connectionTimeoutMillis: 5000 });
let client, server, injectNotificationFailure = false;
const results = [];
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
  await client.query("SET LOCAL statement_timeout='25s'");
  for (const name of (await fs.readdir(new URL('../../supabase/migrations/', import.meta.url))).filter(n => n.endsWith('.sql')).sort()) {
    await client.query(rewrite(await fs.readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8')));
  }
  await client.query(rewrite(await fs.readFile(new URL('../../supabase/seed.sql', import.meta.url), 'utf8')));
  await client.query(rewrite("UPDATE app.users SET email='fixture-'||user_id||'@example.invalid', display_name='W2-Q4 SYNTHETIC '||user_id"));

  const adapted = async (sql, values) => {
    if (sql === 'BEGIN') return client.query('SAVEPOINT w2q4_mutation');
    if (sql === 'COMMIT') return client.query('RELEASE SAVEPOINT w2q4_mutation');
    if (sql === 'ROLLBACK') {
      await client.query('ROLLBACK TO SAVEPOINT w2q4_mutation');
      return client.query('RELEASE SAVEPOINT w2q4_mutation');
    }
    if (injectNotificationFailure && /INSERT INTO app\.notifications/.test(sql)) {
      throw new Error('W2-Q4 synthetic notification failure injected for rollback test');
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

  const roleSets = {
    1: ['LECTURER'],
    2: ['MANAGER', 'LECTURER'],
    3: ['ADMIN'],
    4: ['UNIT_REPRESENTATIVE', 'LECTURER'],
    5: ['RECORDS_OFFICER'],
  };
  const tokens = Object.fromEntries(Object.entries(roleSets).map(([id, roles]) => [id, generateAccessToken({ userId: Number(id), roles })]));

  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;

  async function call(method, path, body, user, expected = 200) {
    const r = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${tokens[user]}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await r.json();
    check(`${method} ${path} -> ${expected}`, r.status, expected);
    return data;
  }

  const pdf = suffix => Buffer.from(`%PDF-1.4\nW2-Q4 SYNTHETIC SECURE TEST ${suffix}`);
  async function upload(path, user, label, expected = 201) {
    const form = new FormData();
    form.append('title', `W2-Q4 SYNTHETIC ${label}`);
    form.append('file', new Blob([pdf(label)], { type: 'application/pdf' }), 'synthetic.pdf');
    const r = await fetch(base + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens[user]}` },
      body: form,
    });
    const data = await r.json();
    check(`upload ${label} -> ${expected}`, r.status, expected);
    if (data.data?.file?.storageKey) physicalKeys.add(data.data.file.storageKey);
    if (data.data?.storageKey) physicalKeys.add(data.data.storageKey);
    return data.data;
  }

  // 1. Tạo hồ sơ cá nhân và thử nghiệm nộp/sửa minh chứng
  const payload = { subjectType: 'LECTURER', achievementTypeId: 3, title: 'W2-Q4 Giáo trình kiểm thử bảo mật', recognitionYear: 2026 };
  const a = (await call('POST', '/achievements', payload, 1, 201)).data;
  const route = `/achievements/${a.achievementId}`;

  // Nộp khi chưa có file -> 400 ValidationError
  await call('POST', route + '/submit', { version: a.version }, 1, 400);

  // Upload file v1
  const evidence = await upload(route + '/evidences', 1, 'v1');
  const evidenceId = evidence.evidenceId;
  const files1 = (await db('SELECT evidence_file_id,storage_key,sha256_hash FROM app.evidence_files WHERE evidence_id=$1', [evidenceId])).rows;
  files1.forEach(f => physicalKeys.add(f.storage_key));
  const file1 = Number(files1[0].evidence_file_id);
  check('v1 SHA256 matches physical bytes', files1[0].sha256_hash, createHash('sha256').update(pdf('v1')).digest('hex'));

  // Người lạ (User 4) nộp hồ sơ của User 1 -> 403 Forbidden
  await call('POST', route + '/submit', { version: a.version }, 4, 403);

  // Nộp lần đầu tạo revision 1
  let current = (await call('POST', route + '/submit', { version: a.version, note: 'W2-Q4 Snapshot 1' }, 1)).data;
  const first = (await call('GET', route + '/submissions', null, 1)).data.submissions[0];
  check('revision 1 freezes file v1', [first.revisionNo, first.frozenFilesCount, first.snapshotData.evidences[0].file.evidenceFileId], [1, 1, file1]);

  // Manager yêu cầu bổ sung minh chứng
  await call('POST', route + '/request-correction', { version: current.version, reason: 'Bổ sung phiên bản 2 minh chứng' }, 2);
  current = (await call('GET', route, null, 1)).data;
  check('status is NEED_CORRECTION', current.status, 'NEED_CORRECTION');

  // Sửa tiêu đề và upload v2
  const changed = (await call('PATCH', route, { version: current.version, title: 'W2-Q4 Giáo trình bản sửa đổi v2' }, 1)).data;
  await upload(`/evidences/${evidenceId}/versions`, 1, 'v2');
  const files2 = (await db('SELECT evidence_file_id,storage_key FROM app.evidence_files WHERE evidence_id=$1 ORDER BY version_no', [evidenceId])).rows;
  files2.forEach(f => physicalKeys.add(f.storage_key));
  check('two immutable file versions exist in db', files2.length, 2);

  // Nộp lại với version cũ -> 409 ConcurrencyConflictError
  await call('POST', route + '/submit', { version: a.version }, 1, 409);

  // Nộp lại thành công tạo revision 2
  current = (await call('POST', route + '/submit', { version: changed.version, note: 'W2-Q4 Snapshot 2' }, 1)).data;
  const revisions = (await call('GET', route + '/submissions', null, 1)).data.submissions;
  check('resubmit creates revision 2 and preserves old revision 1 snapshot', revisions.length, 2);

  // =========================================================================
  // GATE 1: URL & PRIVATE FILE AUTHORIZATION (Không có đường vượt quyền qua URL/file)
  // =========================================================================
  // Owner (User 1) tải file v1 thành công (200)
  const downloadOwner = await fetch(base + `/evidence-files/${file1}/download`, { headers: { Authorization: `Bearer ${tokens[1]}` } });
  check('owner downloads private file -> 200', downloadOwner.status, 200);
  check('owner downloaded bytes match original', Buffer.from(await downloadOwner.arrayBuffer()), pdf('v1'));

  // Người ngoài (User 4) tải file qua URL -> 403 Forbidden
  const downloadOutsider = await fetch(base + `/evidence-files/${file1}/download`, { headers: { Authorization: `Bearer ${tokens[4]}` } });
  check('outsider downloading private file -> 403', downloadOutsider.status, 403);

  // Records Officer bị hết hạn scope trong DB -> 403 Forbidden
  await db("UPDATE app.user_unit_scopes SET valid_to=NOW()-INTERVAL '1 second' WHERE user_id=5");
  const downloadExpiredScope = await fetch(base + `/evidence-files/${file1}/download`, { headers: { Authorization: `Bearer ${tokens[5]}` } });
  check('records officer with expired scope downloading private file -> 403', downloadExpiredScope.status, 403);
  await db("UPDATE app.user_unit_scopes SET valid_to=NULL WHERE user_id=5");

  // =========================================================================
  // GATE 2: ANTI-SELF-APPROVAL (Cấm tự duyệt dưới mọi hình thức)
  // =========================================================================
  // Tạo hồ sơ thuộc sở hữu của Manager (User 2)
  const managerOwned = (await call('POST', '/achievements', { ...payload, title: 'W2-Q4 Thành tích cá nhân của Manager' }, 2, 201)).data;
  const moroute = `/achievements/${managerOwned.achievementId}`;
  await upload(moroute + '/evidences', 2, 'manager-self');
  const moSubmitted = (await call('POST', moroute + '/submit', { version: managerOwned.version }, 2)).data;

  // Manager tự verify hồ sơ của chính mình -> 403 SELF_APPROVAL_PROHIBITED
  const selfVerifyErr = await call('POST', moroute + '/verify', { version: moSubmitted.version }, 2, 403);
  check('anti-self-approval on verify', selfVerifyErr.error.code, 'SELF_APPROVAL_PROHIBITED');

  // Manager tự request-correction hồ sơ của mình -> 403 SELF_APPROVAL_PROHIBITED
  const selfCorrectionErr = await call('POST', moroute + '/request-correction', { version: moSubmitted.version, reason: 'Tự sửa' }, 2, 403);
  check('anti-self-approval on correction', selfCorrectionErr.error.code, 'SELF_APPROVAL_PROHIBITED');

  // Manager tự reject hồ sơ của mình -> 403 SELF_APPROVAL_PROHIBITED
  const selfRejectErr = await call('POST', moroute + '/reject', { version: moSubmitted.version, reason: 'Tự từ chối' }, 2, 403);
  check('anti-self-approval on reject', selfRejectErr.error.code, 'SELF_APPROVAL_PROHIBITED');

  // =========================================================================
  // GATE 3: ADMIN KHÔNG MẶC NHIÊN DUYỆT & MANAGER NGOÀI PHẠM VI BỊ CHẶN
  // =========================================================================
  // ADMIN (User 3, không có vai trò MANAGER và không có scope) thử verify -> 403 Forbidden!
  const adminVerifyErr = await call('POST', moroute + '/verify', { version: moSubmitted.version }, 3, 403);
  check('admin without manager role/scope verify rejected', adminVerifyErr.error?.code === 'FORBIDDEN' || adminVerifyErr.error?.message?.includes('MANAGER'), true);

  // Manager có scope hết hạn trong DB -> 403 OutOfScopeError
  await db("UPDATE app.user_unit_scopes SET valid_to=NOW()-INTERVAL '1 second' WHERE user_id=2");
  await call('POST', route + '/verify', { version: current.version }, 2, 403);
  await db("UPDATE app.user_unit_scopes SET valid_to=NULL WHERE user_id=2");

  // =========================================================================
  // GATE 4: ĐẠI DIỆN ĐƠN VỊ HẾT HẠN BỊ CHẶN NỘP / SỬA / HỦY
  // =========================================================================
  const collective = (await call('POST', '/achievements', { ...payload, subjectType: 'UNIT', achievementTypeId: 2, organizationUnitId: 2, title: 'W2-Q4 Thành tích tập thể bộ môn' }, 4, 201)).data;
  const colRoute = `/achievements/${collective.achievementId}`;
  await upload(colRoute + '/evidences', 4, 'collective-evidence');

  // Hết hạn phân công đại diện của User 4
  await db("UPDATE app.unit_representatives SET valid_to=NOW()-INTERVAL '1 second' WHERE user_id=4");
  await call('POST', colRoute + '/submit', { version: collective.version }, 4, 403);
  await call('POST', colRoute + '/cancel', { version: collective.version, reason: 'Hết hạn đại diện tự hủy' }, 4, 403);
  await upload(colRoute + '/evidences', 4, 'expired-rep-upload', 403);
  // Khôi phục hiệu lực đại diện
  await db("UPDATE app.unit_representatives SET valid_to=NULL WHERE user_id=4");
  const colSubmitted = (await call('POST', colRoute + '/submit', { version: collective.version }, 4)).data;

  // =========================================================================
  // GATE 5: VERIFIED THÀNH TÍCH KHÔNG TỰ SINH AWARDRECORD (TÁCH BIỆT NGHIỆP VỤ)
  // =========================================================================
  const awardCountBefore = Number((await db('SELECT COUNT(*)::int AS count FROM app.award_records')).rows[0].count);

  // Manager hợp lệ thẩm định VERIFIED hồ sơ cá nhân của User 1
  const verifiedAchievement = (await call('POST', route + '/verify', { version: current.version, note: 'Hồ sơ đầy đủ, thẩm định ĐẠT' }, 2)).data;
  check('achievement status transitioned to VERIFIED', verifiedAchievement.status, 'VERIFIED');

  // Kiểm tra số lượng AwardRecord: Tuyệt đối không thay đổi!
  const awardCountAfter = Number((await db('SELECT COUNT(*)::int AS count FROM app.award_records')).rows[0].count);
  check('VERIFIED achievement does NOT auto-create AwardRecord', awardCountAfter, awardCountBefore);

  // Kiểm tra bảng award_records không chứa bất kỳ bản ghi nào tự tạo cho achievement này
  const autoCreatedAwards = (await db('SELECT COUNT(*)::int AS count FROM app.award_record_achievements WHERE achievement_id=$1', [a.achievementId])).rows[0].count;
  check('zero auto-linked award records for verified achievement', Number(autoCreatedAwards), 0);

  // Khi đã VERIFIED thì hồ sơ bị khóa bất biến: không thể thêm/sửa file (409 Conflict)
  await upload(route + '/evidences', 1, 'locked-upload', 409);
  await call('PATCH', route, { version: verifiedAchievement.version, title: 'Sửa sau verify' }, 1, 409);

  // =========================================================================
  // GATE 6: KIỂM TRA FILE VẬT LÝ KHI SUBMIT & AUDIT LOGGING CHÍNH XÁC
  // =========================================================================
  // Tạo hồ sơ mới và xóa file vật lý trước khi nộp
  const missingFileAch = (await call('POST', '/achievements', { ...payload, title: 'W2-Q4 Kiểm tra file vật lý thiếu' }, 1, 201)).data;
  const missingRoute = `/achievements/${missingFileAch.achievementId}`;
  const evMissing = await upload(missingRoute + '/evidences', 1, 'missing-file');
  const missingFileKey = (await db('SELECT storage_key FROM app.evidence_files WHERE evidence_id=$1', [evMissing.evidenceId])).rows[0].storage_key;
  // Xóa file vật lý trên đĩa
  await storage.deleteFile(missingFileKey);
  // Khi submit: Backend kiểm tra file vật lý và từ chối 400 ValidationError!
  const submitMissingErr = await call('POST', missingRoute + '/submit', { version: missingFileAch.version }, 1, 400);
  check('submit rejects when physical file is missing from storage', submitMissingErr.error?.code, 'VALIDATION_ERROR');

  // Kiểm tra Audit Log: Đúng actor user_id và new_values (không bị null)
  const evAudits = (await db("SELECT user_id, action, new_values FROM app.audit_logs WHERE entity_id=$1 AND action='CREATE_EVIDENCE'", [evidenceId])).rows;
  check('evidence audit log has valid actor user_id', Number(evAudits[0].user_id), 1);
  check('evidence audit log has valid non-null new_values', evAudits[0].new_values !== null && typeof evAudits[0].new_values === 'object', true);

  // =========================================================================
  // GATE 7: TRANSACTIONAL NOTIFICATION & ROLLBACK INTEGRITY
  // =========================================================================
  const rollbackAch = (await call('POST', '/achievements', { ...payload, title: 'W2-Q4 Rollback test' }, 1, 201)).data;
  const rbRoute = `/achievements/${rollbackAch.achievementId}`;
  await upload(rbRoute + '/evidences', 1, 'rb-file');

  // Inject lỗi notification -> Transaction phải ROLLBACK 100%
  injectNotificationFailure = true;
  await call('POST', rbRoute + '/submit', { version: rollbackAch.version }, 1, 500);
  injectNotificationFailure = false;

  const afterFailedSubmit = (await call('GET', rbRoute, null, 1)).data;
  check('notification failure rolls back achievement to DRAFT and original version', [afterFailedSubmit.status, afterFailedSubmit.version], ['DRAFT', rollbackAch.version]);
  check('no orphan submission rows left after rollback', Number((await db('SELECT COUNT(*)::int AS count FROM app.achievement_submissions WHERE achievement_id=$1', [rollbackAch.achievementId])).rows[0].count), 0);
  check('no orphan submit audit left after rollback', Number((await db("SELECT COUNT(*)::int AS count FROM app.audit_logs WHERE entity_id=$1 AND action='ACHIEVEMENT_SUBMIT'", [rollbackAch.achievementId])).rows[0].count), 0);

  // =========================================================================
  // GATE 8: W2-P2 AWARD RECORD ĐÚNG QUY TRÌNH (Bởi RecordsOfficer + Quyết định + File)
  // =========================================================================
  const decision = (await call('POST', '/award-decisions', { decisionNumber: 'QĐ-W2-Q4-LHU-2026', decisionDate: '2026-10-06', issuer: 'Hiệu trưởng', title: 'Khen thưởng giảng viên tiêu biểu năm 2026' }, 5, 201)).data;
  const awardRecord = (await call('POST', '/award-records', { lecturerId: 1, awardTypeId: 1, decisionId: Number(decision.decision_id), recognitionYear: 2026, achievementIds: [a.achievementId] }, 5, 201)).data;
  check('new award record starts in DRAFT', awardRecord.status, 'DRAFT');

  // Thử chuyển sang RECORDED khi chưa có file quyết định -> 400 Bad Request
  await call('POST', `/award-records/${awardRecord.record_id}/record`, { version: 1 }, 5, 400);

  // Tải file quyết định vật lý
  await upload(`/award-decisions/${decision.decision_id}/files`, 5, 'decision-file');

  // Chuyển sang RECORDED thành công
  const recordedAward = (await call('POST', `/award-records/${awardRecord.record_id}/record`, { version: 1 }, 5)).data;
  check('award record successfully recorded with decision file', recordedAward.status, 'RECORDED');

} finally {
  injectNotificationFailure = false;
  if (server) await new Promise(resolve => server.close(resolve));
  try {
    for (const key of physicalKeys) await storage.deleteFile(key);
    check('all physical files cleaned up', (await Promise.all([...physicalKeys].map(key => storage.fileExists(key)))).some(Boolean), false);
  } finally {
    storage.saveFile = saveFile;
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    try {
      if (client) check('test schema does not exist after outer rollback', (await pool.query('SELECT to_regnamespace($1) AS ns', [schema])).rows[0].ns, null);
    } finally {
      await pool.end();
    }
  }
}

// Ghi báo cáo kiểm thử chính thức
const report = {
  task: 'W2-Q4',
  author: 'Tạ Trần Vinh Quang',
  baseline: 'origin/w3-p2',
  testedAt: '2026-10-06',
  mode: 'REAL_HTTP_POSTGRESQL_ISOLATED_ROLLBACK',
  totalAssertions: results.length,
  securityGates: {
    noUrlFileBypass: 'PASS - Outsider and expired RecordsOfficer blocked with 403',
    antiSelfApproval: 'PASS - Creator/Submitter/Lecturer self-approval prohibited with 403',
    outOfScopeBlocked: 'PASS - Out of scope manager and Admin without manager role blocked with 403',
    expiredRepresentativeBlocked: 'PASS - Expired unit representative blocked from submit/cancel/modify',
    physicalFileValidated: 'PASS - Missing storage key file fails preflight submission with 400',
    verifiedAwardSeparation: 'PASS - VERIFIED achievement never auto-creates AwardRecord',
    transactionalNotificationAndAudit: 'PASS - Injected failure completely rolls back state and audits',
    officialAwardWorkflow: 'PASS - Official AwardRecord requires RecordsOfficer and attached decision file',
  },
  acceptance: 'ACCEPT',
  checks: results,
};

await fs.mkdir(new URL('../../docs/testing/week-2/', import.meta.url), { recursive: true });
await fs.writeFile(new URL('../../docs/testing/week-2/W2_Q4_RESULT.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(`\n================================================================`);
console.log(`W2-Q4 PASS: ${results.length} assertions passed on real HTTP/PostgreSQL Supabase engine.`);
console.log(`Acceptance: ACCEPT (Tất cả cổng kiểm soát bảo mật và nghiệp vụ đạt 100%).`);
console.log(`================================================================\n`);
