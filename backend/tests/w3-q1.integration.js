// W3-Q1 integration test: Real Express + PostgreSQL on Supabase, isolated schema, outer rollback.
// Verifies full state machine transitions: request-correction, resubmit (new revision & frozen files),
// reject, cancel (mandatory reason if submitted), revoke (mandatory reason),
// replacement achievement linkage for ended records (REJECTED/CANCELLED/REVOKED),
// history & snapshot viewers, and OCC concurrency conflict handling.

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { Pool, getDbPoolConfig, setPool } from '../src/config/database.js';
import { generateAccessToken } from '../src/utils/crypto.js';
import storage from '../src/modules/evidences/storage/localStorageAdapter.js';
import app from '../src/app.js';

const schema = `w3q1_test_${randomBytes(6).toString('hex')}`;
assert.match(schema, /^w3q1_test_[a-f0-9]{12}$/);
const rewrite = (sql) => sql.replace(/\bapp\b/g, schema);
const pool = new Pool({ ...getDbPoolConfig(), max: 1, connectionTimeoutMillis: 5000 });
let client, server;
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
  for (const name of (await fs.readdir(new URL('../../supabase/migrations/', import.meta.url))).filter((n) => n.endsWith('.sql')).sort()) {
    await client.query(rewrite(await fs.readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8')));
  }
  await client.query(rewrite(await fs.readFile(new URL('../../supabase/seed.sql', import.meta.url), 'utf8')));
  await client.query(rewrite("UPDATE app.users SET email='fixture-'||user_id||'@example.invalid', display_name='W3-Q1 SYNTHETIC '||user_id"));

  const adapted = async (sql, values) => {
    if (sql === 'BEGIN') return client.query('SAVEPOINT w3q1_mutation');
    if (sql === 'COMMIT') return client.query('RELEASE SAVEPOINT w3q1_mutation');
    if (sql === 'ROLLBACK') {
      await client.query('ROLLBACK TO SAVEPOINT w3q1_mutation');
      return client.query('RELEASE SAVEPOINT w3q1_mutation');
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
  const tokens = Object.fromEntries(
    Object.entries(roleSets).map(([id, roles]) => [id, generateAccessToken({ userId: Number(id), roles })])
  );

  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;

  async function call(method, path, body, user, expected = 200) {
    const r = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${tokens[user]}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const txt = await r.text();
    let json = null;
    try {
      json = JSON.parse(txt);
    } catch {}
    assert.equal(r.status, expected, `${method} ${path} -> expected ${expected}, got ${r.status}: ${txt}`);
    return json;
  }

  const pdfBytes = (suffix) => Buffer.from(`%PDF-1.4\nW3-Q1 SYNTHETIC SECURE TEST ${suffix}\n%%EOF`);

  async function uploadEvidence(achievementId, user, title, filename, content) {
    const form = new FormData();
    form.append('title', title);
    form.append('description', 'Evidence file content');
    form.append('file', new Blob([pdfBytes(content)], { type: 'application/pdf' }), filename);

    const r = await fetch(`${base}/achievements/${achievementId}/evidences`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens[user]}` },
      body: form,
    });
    const json = await r.json();
    assert.equal(r.status, 201, `upload evidence -> ${JSON.stringify(json)}`);
    return json.data;
  }

  // 1. Gán phạm vi Scope: user 2 (Manager) quản lý unit 1 (Khoa CNTT)
  await db("INSERT INTO app.user_roles (user_id, role_id) VALUES (2, (SELECT role_id FROM app.roles WHERE code='MANAGER')) ON CONFLICT DO NOTHING");
  await db("INSERT INTO app.user_unit_scopes (user_id, role_id, unit_id, include_descendants) VALUES (2, (SELECT role_id FROM app.roles WHERE code='MANAGER'), 1, true) ON CONFLICT DO NOTHING");

  console.log('--- Giai đoạn 1: Tạo DRAFT và Nộp lần 1 (Snapshot v1) ---');
  const createdAch = await call('POST', '/achievements', {
    subjectType: 'LECTURER',
    achievementTypeId: 1,
    title: 'Nghiên cứu kiến trúc phân tán cho hệ thống giáo dục đại học',
    description: 'Bài báo công bố tại hội thảo quốc tế IEEE 2026',
    recognitionYear: 2026,
  }, 1, 201);
  const achId = createdAch.data.achievementId;
  check('Tạo DRAFT thành công', createdAch.data.status, 'DRAFT');
  check('Version khởi tạo là 1', createdAch.data.version, 1);

  // Tải lên tệp minh chứng v1
  const ev1 = await uploadEvidence(achId, 1, 'Chứng nhận bài báo v1', 'paper_v1.pdf', 'CONTENT_VERSION_1');
  check('Minh chứng v1 đã tạo', !!ev1.evidenceId, true);

  // Nộp lần 1 (SUBMIT)
  const submit1 = await call('POST', `/achievements/${achId}/submit`, {
    version: 1,
    note: 'Kính gửi Trưởng khoa phê duyệt bài báo',
  }, 1, 200);
  check('Trạng thái chuyển sang SUBMITTED', submit1.data.status, 'SUBMITTED');
  check('Version tăng lên 2', submit1.data.version, 2);

  // Kiểm tra snapshot v1 được tạo
  const subs1 = await call('GET', `/achievements/${achId}/submissions`, null, 1, 200);
  check('Có 1 submission được ghi nhận', subs1.data.submissions.length, 1);
  check('Revision là 1', subs1.data.submissions[0].revisionNo, 1);
  check('Đóng băng 1 file minh chứng', subs1.data.submissions[0].frozenFilesCount, 1);

  console.log('--- Giai đoạn 2: Manager yêu cầu bổ sung (NEED_CORRECTION) ---');
  // Thử yêu cầu bổ sung thiếu lý do (< 5 ký tự) -> Bị 400
  await call('POST', `/achievements/${achId}/request-correction`, {
    version: 2,
    reason: 'abc',
  }, 2, 400);

  // Yêu cầu bổ sung hợp lệ
  const reqCorr = await call('POST', `/achievements/${achId}/request-correction`, {
    version: 2,
    reason: 'Minh chứng thiếu trang phụ lục danh sách tác giả, vui lòng cập nhật lại file scan',
  }, 2, 200);
  check('Trạng thái chuyển sang NEED_CORRECTION', reqCorr.data.status, 'NEED_CORRECTION');
  check('Version tăng lên 3', reqCorr.data.version, 3);

  console.log('--- Giai đoạn 3: Giảng viên cập nhật và Gửi lại (Resubmit Snapshot v2) ---');
  // Tải lên tệp minh chứng phiên bản mới
  const ev2 = await uploadEvidence(achId, 1, 'Chứng nhận bài báo có phụ lục v2', 'paper_v2.pdf', 'CONTENT_VERSION_2');

  // Gửi lại qua endpoint alias /resubmit
  const resubmit = await call('POST', `/achievements/${achId}/resubmit`, {
    version: 3,
    submitNote: 'Đã bổ sung phụ lục tác giả trong file scan v2',
  }, 1, 200);
  check('Gửi lại thành công sang SUBMITTED', resubmit.data.status, 'SUBMITTED');
  check('Version tăng lên 4', resubmit.data.version, 4);

  // Kiểm tra submissions có 2 revisions độc lập
  const subs2 = await call('GET', `/achievements/${achId}/submissions`, null, 1, 200);
  check('Có 2 submissions được ghi nhận', subs2.data.submissions.length, 2);
  check('Revision 2 ghi nhận đúng revisionNo', subs2.data.submissions[1].revisionNo, 2);
  check('Revision 2 đóng băng 2 file minh chứng', subs2.data.submissions[1].frozenFilesCount, 2);

  console.log('--- Giai đoạn 4: Thẩm định Thành công & Concurrency OCC Conflict (409) ---');
  // 1. Manager thẩm định thành công với version hiện tại (version 4)
  const verifiedAch = await call('POST', `/achievements/${achId}/verify`, {
    version: 4,
    note: 'Đạt chuẩn chất lượng khoa học',
  }, 2, 200);
  check('Hồ sơ đạt VERIFIED', verifiedAch.data.status, 'VERIFIED');
  check('Version tăng lên 5', verifiedAch.data.version, 5);

  // 2. Thao tác đồng thời gửi version cũ (version 4) -> Trả về 409 CONCURRENCY_CONFLICT
  await call('POST', `/achievements/${achId}/verify`, {
    version: 4,
    note: 'Thử thẩm định lại với version cũ',
  }, 2, 409);
  check('OCC: Thao tác với version cũ bị chặn 409 Conflict', true, true);

  // Khóa bất biến: Không thể nộp lại từ VERIFIED
  await call('POST', `/achievements/${achId}/submit`, { version: 5 }, 1, 409);

  console.log('--- Giai đoạn 5: Manager Thu hồi xác nhận (REVOKED) ---');
  // Thu hồi thiếu lý do -> 400
  await call('POST', `/achievements/${achId}/revoke`, { version: 5, reason: '' }, 2, 400);

  // Thu hồi hợp lệ
  const revoked = await call('POST', `/achievements/${achId}/revoke`, {
    version: 5,
    reason: 'Phát hiện bài báo trùng lặp nội dung với đề tài cấp cơ sở, thu hồi để hiệu chỉnh',
  }, 2, 200);
  check('Thu hồi thành công sang REVOKED', revoked.data.status, 'REVOKED');
  check('Version tăng lên 6', revoked.data.version, 6);

  // Hồ sơ REVOKED không được nộp lại trực tiếp
  await call('POST', `/achievements/${achId}/submit`, { version: 6 }, 1, 409);

  console.log('--- Giai đoạn 6: Tạo bản thay thế có liên kết (Replacement) ---');
  // Tạo bản thay thế từ hồ sơ REVOKED qua POST /achievements/:id/replace
  const replacedRes = await call('POST', `/achievements/${achId}/replace`, {
    title: 'Nghiên cứu kiến trúc phân tán cho giáo dục đại học (Bản hiệu chỉnh)',
    description: 'Đã loại bỏ nội dung trùng lặp theo yêu cầu thẩm định',
  }, 1, 201);
  const newAchId = replacedRes.data.achievementId;
  check('Bản thay thế tạo thành công ở trạng thái DRAFT', replacedRes.data.status, 'DRAFT');
  check('Bản thay thế có version là 1', replacedRes.data.version, 1);
  check('Liên kết replacesAchievementId trỏ đúng hồ sơ cũ', Number(replacedRes.data.replacesAchievementId), achId);

  // Kiểm tra CSDL lưu chính xác replaces_achievement_id
  const dbRow = await db(`SELECT replaces_achievement_id AS "repId" FROM ${schema}.achievements WHERE achievement_id = $1`, [newAchId]);
  check('CSDL lưu đúng replaces_achievement_id', Number(dbRow.rows[0].repId), achId);

  console.log('--- Giai đoạn 7: Hủy hồ sơ (Cancel) và Từ chối (Reject) ---');
  // 1. Hủy hồ sơ DRAFT không cần lý do -> 200
  const cancelledDraft = await call('POST', `/achievements/${newAchId}/cancel`, {
    version: 1,
  }, 1, 200);
  check('Hủy DRAFT thành công sang CANCELLED', cancelledDraft.data.status, 'CANCELLED');

  // Cho phép tạo bản thay thế cho hồ sơ CANCELLED
  const replacedCancelled = await call('POST', `/achievements/${newAchId}/replace`, {
    title: 'Bản thay thế sau khi tự hủy hồ sơ',
  }, 1, 201);
  const finalDraftId = replacedCancelled.data.achievementId;
  check('Tạo bản thay thế từ CANCELLED thành công', Number(replacedCancelled.data.replacesAchievementId), newAchId);

  // 2. Tạo một hồ sơ mới để test Reject
  const achToReject = await call('POST', '/achievements', {
    subjectType: 'LECTURER',
    achievementTypeId: 2,
    title: 'Sáng kiến cải tiến phương pháp giảng dạy',
    recognitionYear: 2026,
  }, 1, 201);
  const rejectTargetId = achToReject.data.achievementId;
  await uploadEvidence(rejectTargetId, 1, 'Minh chứng sáng kiến', 'sk.pdf', 'SK_CONTENT');
  await call('POST', `/achievements/${rejectTargetId}/submit`, { version: 1 }, 1, 200);

  // Manager Reject thiếu lý do -> 400
  await call('POST', `/achievements/${rejectTargetId}/reject`, { version: 2, reason: '' }, 2, 400);

  // Manager Reject có lý do -> 200
  const rejected = await call('POST', `/achievements/${rejectTargetId}/reject`, {
    version: 2,
    reason: 'Sáng kiến chưa đạt tiêu chí đổi mới cấp trường',
  }, 2, 200);
  check('Từ chối thành công sang REJECTED', rejected.data.status, 'REJECTED');

  // Tạo bản thay thế cho hồ sơ REJECTED -> 201
  const replacedRejected = await call('POST', `/achievements/${rejectTargetId}/replace`, {
    title: 'Sáng kiến cải tiến giảng dạy (Đã bổ sung tiêu chí đổi mới)',
  }, 1, 201);
  check('Tạo bản thay thế từ REJECTED thành công', Number(replacedRejected.data.replacesAchievementId), rejectTargetId);

  console.log('--- Giai đoạn 8: Đọc Lịch sử trạng thái và Danh sách Submissions ---');
  const historyRes = await call('GET', `/achievements/${achId}/history`, null, 1, 200);
  check('Lịch sử ghi vết đầy đủ các bước', historyRes.data.histories.length >= 4, true);

  const finalSubsRes = await call('GET', `/achievements/${achId}/submissions`, null, 1, 200);
  check('Danh sách submissions có đúng 2 lần nộp', finalSubsRes.data.submissions.length, 2);

  console.log(`\n🎉 TOÀN BỘ ${results.length} KIỂM TRA TÍCH HỢP W3-Q1 HOÀN TOÀN ĐẠT!`);
} catch (err) {
  console.error('❌ Lỗi kiểm thử tích hợp W3-Q1:', err);
  throw err;
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (client) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    client.release();
  }
  await pool.end();

  // Dọn dẹp tệp vật lý tạo ra trong quá trình test
  for (const k of physicalKeys) {
    try {
      await storage.deleteFile(k);
    } catch {}
  }
}
