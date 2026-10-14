/** Reset demo transactions and build real workflow snapshots through backend services.
 * Run from backend: node ../database/scripts/seedScenario.js --apply
 * Requires migrated app schema and the base catalogs/accounts from supabase/seed.sql.
 * Backups are mandatory; no schema/auth/storage Supabase tables are dropped.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool, getDbPoolConfig, setPool } from '../../backend/src/config/database.js';
import bcrypt from '../../backend/node_modules/bcryptjs/index.js';
import { runBackup } from '../../scripts/backup.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixtures = path.join(root, 'docs/testing/scenario/fixtures');
const operational = [
  'audit_logs', 'refresh_tokens', 'notifications',
  'application_review_comments', 'application_reviews', 'award_application_histories',
  'award_application_inputs', 'award_applications', 'award_record_achievements',
  'award_record_histories', 'award_records', 'award_decision_files', 'award_decisions',
  'award_criteria', 'award_periods', 'ai_rag_explanations', 'evaluation_criterion_results',
  'evaluation_runs', 'kpi_recommendations', 'external_kpi_run_items', 'external_kpi_records',
  'external_kpi_runs', 'external_kpi_mappings', 'kpi_results', 'kpi_goals',
  'submission_evidence_files', 'achievement_status_histories', 'achievement_submissions',
  'achievement_verifications', 'evidence_files', 'evidences', 'achievements',
];
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const year = Number(today.slice(0, 4));
function dayOffset(n) { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function walk(dir) { return fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : e.isFile() ? [path.join(dir, e.name)] : []) : []; }

// Map each service transaction to a savepoint, keeping the entire reset atomic.
export function transactionPool(client) {
  let serial = 0;
  let pending = Promise.resolve();
  const execute = (sql, params) => {
    const result = pending.then(() => client.query(sql, params));
    pending = result.catch(() => {});
    return result;
  };
  const makeClient = () => {
    const stack = [];
    return { release() {}, async query(sql, params) {
      const command = typeof sql === 'string' ? sql.trim().toUpperCase() : '';
      if (command === 'BEGIN') { const name = `scenario_${++serial}`; stack.push(name); return execute(`SAVEPOINT ${name}`); }
      if (command === 'COMMIT') { const name = stack.pop(); if (!name) throw new Error('Unbalanced service transaction'); return execute(`RELEASE SAVEPOINT ${name}`); }
      if (command === 'ROLLBACK') { const name = stack.pop(); if (!name) throw new Error('Unbalanced service transaction'); await execute(`ROLLBACK TO SAVEPOINT ${name}`); return execute(`RELEASE SAVEPOINT ${name}`); }
      return execute(sql, params);
    } };
  };
  return { query: execute, connect: async () => makeClient() };
}

export async function seedScenario({ apply = false } = {}) {
  if (!apply) {
    console.log('Preview only. --apply backs up app + private files, resets demo transactions, and creates SCN scenarios.');
    console.log('Preserves roles, existing accounts, units, catalogs, migrations and three base regulation sources.');
    console.log('Reset tables: ' + operational.join(', '));
    return;
  }
  for (const file of ['evidence-demo.pdf', 'decision-demo.pdf']) {
    if (!fs.existsSync(path.join(fixtures, file))) throw new Error('Missing fixture: ' + file);
  }
  const storageBase = path.resolve(process.env.STORAGE_DIR || path.join(root, 'backend/storage/private/evidences'));
  if (!storageBase.startsWith(root + path.sep)) throw new Error('Scenario storage must stay within this project');
  const oldFiles = walk(storageBase);
  const addedFiles = [];
  const pool = new Pool({ ...getDbPoolConfig(), max: 2, min: 0 });
  let client, committed = false, storageAdapter, restoreSave;
  const manifest = { seedVersion: 1, date: today, simulationOnly: true, accounts: [], achievements: {}, applications: {}, awards: {}, kpi: {}, ai: {} };
  try {
    const foundation = (await pool.query("SELECT username FROM app.users WHERE username IN ('an.nv','bich.tt','duc.pm','cuong.lh')")).rows;
    if (foundation.length !== 4) throw new Error('Load the base seed on a fresh demo DB first; four foundation accounts are required');
    const backup = await runBackup({ outDir: path.join(root, 'backups', 'before_scenario_' + new Date().toISOString().replace(/[:.]/g, '-')), storageDir: storageBase });
    // Do not log backup data: it contains authentication hashes and private metadata.
    const backupDir = backup.backupDir || backup.outDir;
    if (!backup.success || !backupDir) throw new Error('Backup did not complete');
    for (const key of ['schemaDump','rolesDump','dataDump','fullDump']) {
      const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(backupDir, backup.manifest.database[key + 'File']))).digest('hex');
      if (actual !== backup.manifest.database[key + 'Sha256']) throw new Error('Backup checksum mismatch: ' + key);
    }
    const archivedFiles = JSON.parse(fs.readFileSync(path.join(backupDir, 'storage_backup/storage_manifest.json'), 'utf8'));
    for (const file of archivedFiles.files) {
      const archived = path.resolve(backupDir, 'storage_backup', file.storageKey);
      if (!archived.startsWith(path.join(backupDir, 'storage_backup') + path.sep)) throw new Error('Invalid archived file path');
      const actual = crypto.createHash('sha256').update(fs.readFileSync(archived)).digest('hex');
      if (actual !== file.checksumSha256) throw new Error('Backup file checksum mismatch');
    }
    manifest.backupDirectory = backupDir;
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='10s'");
    await client.query("SET LOCAL statement_timeout='60s'");
    await client.query('TRUNCATE ' + operational.map(t => 'app.' + t).join(', ') + ' RESTART IDENTITY');
    setPool(transactionPool(client));

    const storage = (await import('../../backend/src/modules/evidences/storage/localStorageAdapter.js')).default;
    storage.baseDir = storageBase;
    const originalSave = storage.saveFile.bind(storage);
    storageAdapter = storage; restoreSave = originalSave;
    storage.saveFile = async (key, bytes) => { addedFiles.push(storage.resolveSafePath(key)); return originalSave(key, bytes); };
    const ach = (await import('../../backend/src/modules/achievements/achievementService.js')).default;
    const evidence = (await import('../../backend/src/modules/evidences/evidenceService.js')).default;
    const application = (await import('../../backend/src/modules/awards/applicationService.js')).default;
    const awards = (await import('../../backend/src/modules/awards/awardService.js')).default;
    const kpi = await import('../../backend/src/modules/kpi/kpiService.js');
    const regulation = await import('../../backend/src/modules/regulations/regulationService.js');

    // Delete identifiable obsolete fixture documents; preserve the base sources/confirmation states.
    const obsolete = "SELECT document_id FROM app.regulation_documents WHERE document_code LIKE 'DOC-TEST-%' OR document_code LIKE 'SCN-%'";
    await client.query(`DELETE FROM app.award_criteria_versions WHERE version_id IN (SELECT version_id FROM app.regulation_document_versions WHERE document_id IN (${obsolete}))`);
    await client.query(`DELETE FROM app.regulation_chunks WHERE version_id IN (SELECT version_id FROM app.regulation_document_versions WHERE document_id IN (${obsolete}))`);
    await client.query(`DELETE FROM app.regulation_document_versions WHERE document_id IN (${obsolete})`);
    await client.query(`DELETE FROM app.regulation_documents WHERE document_id IN (${obsolete})`);

    // Align all identity sequences after earlier scripts with explicitly assigned IDs.
    const sequences = (await client.query(`SELECT table_name,column_name FROM information_schema.columns
      WHERE table_schema='app' AND (is_identity='YES' OR column_default LIKE 'nextval%')`)).rows;
    for (const { table_name: t, column_name: col } of sequences) {
      if (!/^[a-z_]+$/.test(t + col)) throw new Error('Unexpected identifier');
      await client.query(`SELECT setval(pg_get_serial_sequence($1,$2),GREATEST(COALESCE((SELECT MAX(${col}) FROM app.${t}),0)+1,1),false)`, ['app.' + t, col]);
    }
    const passwordHash = await bcrypt.hash('demo1234', 10);
    const roles = Object.fromEntries((await client.query('SELECT code,role_id FROM app.roles')).rows.map(r => [r.code, Number(r.role_id)]));
    const units = Object.fromEntries((await client.query('SELECT code,unit_id FROM app.organization_units')).rows.map(r => [r.code, Number(r.unit_id)]));
    const types = Object.fromEntries((await client.query('SELECT code,achievement_type_id FROM app.achievement_types')).rows.map(r => [r.code, Number(r.achievement_type_id)]));
    const awardTypes = Object.fromEntries((await client.query('SELECT code,award_type_id FROM app.award_types')).rows.map(r => [r.code, Number(r.award_type_id)]));
    for (const code of ['ADMIN','LECTURER','MANAGER','COUNCIL','UNIT_REPRESENTATIVE','RECORDS_OFFICER']) if (!roles[code]) throw new Error('Missing role ' + code);
    if (!units.FIT || !units.FIT_SE || !units.PHARM || !types.RESEARCH_PATENT) throw new Error('Missing base catalog');
    const baseUsers = (await client.query("UPDATE app.users SET password_hash=$1,status='ACTIVE',must_change_password=FALSE WHERE username IN ('an.nv','bich.tt','duc.pm','cuong.lh') RETURNING user_id,username", [passwordHash])).rows;
    const users = Object.fromEntries(baseUsers.map(u => [u.username, { userId: Number(u.user_id) }]));
    // Restore the known demo assignments too, so manual permission tests are resettable.
    for (const [username, assignedRoles] of [['an.nv',['LECTURER']],['bich.tt',['MANAGER','LECTURER']],['duc.pm',['ADMIN']],['cuong.lh',['LECTURER','UNIT_REPRESENTATIVE']]]) {
      const uid = users[username].userId;
      await client.query('DELETE FROM app.user_unit_scopes WHERE user_id=$1', [uid]);
      await client.query('DELETE FROM app.unit_representatives WHERE user_id=$1', [uid]);
      await client.query('DELETE FROM app.user_roles WHERE user_id=$1', [uid]);
      for (const role of assignedRoles) await client.query("INSERT INTO app.user_roles(user_id,role_id,valid_from) VALUES($1,$2,NOW()-INTERVAL '1 year')", [uid, roles[role]]);
      manifest.accounts.push({ username, roles: assignedRoles, userId: uid, password: 'demo1234', status: 'ACTIVE' });
    }
    await client.query("INSERT INTO app.user_unit_scopes(user_id,role_id,unit_id,include_descendants,valid_from) VALUES($1,$2,$3,TRUE,NOW()-INTERVAL '1 year')", [users['bich.tt'].userId, roles.MANAGER, units.FIT]);
    await client.query("INSERT INTO app.unit_representatives(user_id,unit_id,valid_from,valid_to,assigned_by) VALUES($1,$2,NOW()-INTERVAL '1 year',NOW()+INTERVAL '1 year',$3)", [users['cuong.lh'].userId, units.FIT_SE, users['duc.pm'].userId]);
    const extra = [
      ['records.demo', 'Chuyên viên thi đua DEMO', 'RECORDS_OFFICER'],
      ['council.demo', 'Hội đồng - người xử lý DEMO', 'COUNCIL'],
      ['council.other', 'Hội đồng - chưa phân công DEMO', 'COUNCIL'],
      ['linh.pharm', 'Giảng viên Khoa Dược DEMO', 'LECTURER'],
      ['rep.expired', 'Đại diện hết phân công DEMO', 'UNIT_REPRESENTATIVE'],
      ['locked.demo', 'Tài khoản bị khóa DEMO', 'LECTURER'],
    ];
    for (const [username, name, role] of extra) {
      const u = (await client.query(`INSERT INTO app.users(username,email,password_hash,display_name,status,must_change_password)
        VALUES($1,$2,$3,$4,$5,FALSE) ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash,status=EXCLUDED.status,must_change_password=FALSE RETURNING user_id`,
      [username, username + '@example.invalid', passwordHash, name, username === 'locked.demo' ? 'LOCKED' : 'ACTIVE'])).rows[0];
      users[username] = { userId: Number(u.user_id) };
      await client.query('DELETE FROM app.user_unit_scopes WHERE user_id=$1', [u.user_id]);
      await client.query('DELETE FROM app.unit_representatives WHERE user_id=$1', [u.user_id]);
      await client.query('DELETE FROM app.user_roles WHERE user_id=$1', [u.user_id]);
      await client.query("INSERT INTO app.user_roles(user_id,role_id,valid_from) VALUES($1,$2,NOW()-INTERVAL '1 year')", [u.user_id, roles[role]]);
      if (['RECORDS_OFFICER','COUNCIL'].includes(role)) await client.query("INSERT INTO app.user_unit_scopes(user_id,role_id,unit_id,include_descendants,valid_from) VALUES($1,$2,$3,TRUE,NOW()-INTERVAL '1 year')", [u.user_id, roles[role], units.FIT]);
      manifest.accounts.push({ username, role, userId: Number(u.user_id), password: 'demo1234', status: username === 'locked.demo' ? 'LOCKED' : 'ACTIVE' });
    }
    await client.query(`INSERT INTO app.unit_representatives(user_id,unit_id,valid_from,valid_to,assigned_by)
      VALUES($1,$2,NOW()-INTERVAL '30 days',NOW()-INTERVAL '1 day',$3)`, [users['rep.expired'].userId, units.FIT_CS, users['duc.pm'].userId]);
    await client.query("UPDATE app.unit_representatives SET valid_to=NOW()+INTERVAL '1 year' WHERE user_id=$1 AND unit_id=$2 AND revoked_at IS NULL", [users['cuong.lh'].userId, units.FIT_SE]);
    const outside = (await client.query(`INSERT INTO app.lecturers(user_id,employee_code,full_name,email,is_active)
      VALUES($1,'SCN-GV-PHARM','Giảng viên Linh DEMO','linh.pharm@example.invalid',TRUE)
      ON CONFLICT(user_id) DO UPDATE SET is_active=TRUE RETURNING lecturer_id`, [users['linh.pharm'].userId])).rows[0];
    await client.query('DELETE FROM app.lecturer_assignments WHERE lecturer_id=$1', [outside.lecturer_id]);
    await client.query("INSERT INTO app.lecturer_assignments(lecturer_id,unit_id,is_primary,valid_from,assigned_by) VALUES($1,$2,TRUE,NOW()-INTERVAL '1 year',$3)", [outside.lecturer_id, units.PHARM, users['duc.pm'].userId]);
    const lecturerIds = Object.fromEntries((await client.query('SELECT u.username,l.lecturer_id FROM app.lecturers l JOIN app.users u USING(user_id)')).rows.map(r => [r.username, Number(r.lecturer_id)]));
    await client.query('UPDATE app.academic_years SET is_current=FALSE');
    const schoolStartYear = Number(today.slice(5,7)) >= 9 ? year : year-1;
    const academicYear = (await client.query(`INSERT INTO app.academic_years(code,name,start_date,end_date,is_current,is_active)
      VALUES($1,$2,$3,$4,TRUE,TRUE) ON CONFLICT(code) DO UPDATE SET is_current=TRUE,is_active=TRUE RETURNING academic_year_id`,
    [`${schoolStartYear}-${schoolStartYear+1}`, `Năm học ${schoolStartYear} - ${schoolStartYear+1}`, `${schoolStartYear}-09-01`, `${schoolStartYear+1}-08-31`])).rows[0];
    const sample = fs.readFileSync(path.join(fixtures, 'evidence-demo.pdf'));
    const decisionFile = fs.readFileSync(path.join(fixtures, 'decision-demo.pdf'));
    const fileObject = (buffer, name) => ({ buffer, size: buffer.length, originalname: name, mimetype: 'application/pdf' });
    const an = users['an.nv'], manager = users['bich.tt'], representative = users['cuong.lh'], officer = users['records.demo'], council = users['council.demo'];
    async function makeAchievement(key, title, state = 'DRAFT', user = an, collective = false) {
      let r = await ach.createAchievement(user, { subjectType: collective ? 'UNIT' : 'LECTURER',
        ...(collective ? { organizationUnitId: units.FIT_SE } : {}), achievementTypeId: collective ? types.RESEARCH_PATENT : types.RESEARCH_JOURNAL_Q1,
        title: `${key} | ${title} [MÔ PHỎNG]`, description: 'Dữ liệu của kịch bản SCN; không xác nhận thành tích thật.', recognitionYear: year,
        academicYearId: Number(academicYear.academic_year_id), startDate: dayOffset(-20), endDate: dayOffset(-5), contributionRole: collective ? 'Tập thể thực hiện' : 'Tác giả chính' });
      if (key !== 'SCN-A01') await evidence.createEvidence({ achievementId: r.achievementId, body: { title: 'Minh chứng ' + key + ' - MÔ PHỎNG' }, file: fileObject(sample, 'evidence-demo.pdf'), user });
      if (state !== 'DRAFT') r = await ach.submitAchievement(user, r.achievementId, { version: r.version });
      if (['VERIFIED','REVOKED'].includes(state)) r = await ach.verifyAchievement(manager, r.achievementId, { version: r.version, note: 'Đã kiểm tra dữ liệu mô phỏng của kịch bản.' });
      if (state === 'NEED_CORRECTION') r = await ach.requestCorrection(manager, r.achievementId, { version: r.version, reason: 'Bổ sung mô tả vai trò đóng góp và tải phiên bản minh chứng mới.' });
      if (state === 'REJECTED') r = await ach.rejectAchievement(manager, r.achievementId, { version: r.version, reason: 'Minh chứng mô phỏng không khớp nội dung kê khai trong ca từ chối.' });
      if (state === 'CANCELLED') r = await ach.cancelAchievement(user, r.achievementId, { version: r.version, reason: 'Chủ hồ sơ rút kê khai trong kịch bản.' });
      if (state === 'REVOKED') r = await ach.revokeAchievement(manager, r.achievementId, { version: r.version, reason: 'Phát hiện sai thông tin; chuẩn bị tạo hồ sơ thay thế.' });
      manifest.achievements[key] = { id: r.achievementId, title: r.title, status: r.status, owner: Object.keys(users).find(k => users[k] === user), subjectType: collective ? 'UNIT' : 'LECTURER' };
      return r;
    }
    await makeAchievement('SCN-A01', 'Luồng chính - bài báo của An');
    await makeAchievement('SCN-A02', 'Chờ quản lý xác nhận', 'SUBMITTED');
    await makeAchievement('SCN-A03', 'Yêu cầu bổ sung minh chứng', 'NEED_CORRECTION');
    const verified = await makeAchievement('SCN-A04', 'Nguồn hợp lệ cho đề nghị cá nhân', 'VERIFIED');
    await makeAchievement('SCN-A05', 'Hồ sơ bị từ chối', 'REJECTED');
    await makeAchievement('SCN-A06', 'Chủ hồ sơ đã rút', 'CANCELLED');
    const revoked = await makeAchievement('SCN-A07', 'Thành tích đã thu hồi', 'REVOKED');
    const replacement = await ach.replaceAchievement(an, revoked.achievementId, { title: 'SCN-A08 | Bản thay thế A07 [MÔ PHỎNG]' });
    manifest.achievements['SCN-A08'] = { id: replacement.achievementId, status: replacement.status, replaces: revoked.achievementId, owner: 'an.nv' };
    await makeAchievement('SCN-A09', 'Hồ sơ của quản lý để test chống tự duyệt', 'SUBMITTED', manager);
    await makeAchievement('SCN-A10', 'Hồ sơ Khoa Dược ngoài phạm vi CNTT', 'SUBMITTED', users['linh.pharm']);
    await makeAchievement('SCN-T01', 'Luồng tập thể - sáng chế Bộ môn KTPM', 'DRAFT', representative, true);
    const collective = await makeAchievement('SCN-T02', 'Nguồn hợp lệ cho đề nghị tập thể', 'VERIFIED', representative, true);

    const cycle = await application.createCycle({ code: `SCN-OPEN-${year}`, name: 'SCN | Kỳ xét thưởng đang mở - MÔ PHỎNG', startDate: dayOffset(-30), endDate: dayOffset(180) }, officer);
    await client.query("INSERT INTO app.award_periods(code,name,start_date,end_date,status) VALUES($1,'SCN | Kỳ đã đóng - MÔ PHỎNG',$2,$3,'CLOSED')", [`SCN-CLOSED-${year}`, dayOffset(-180), dayOffset(-60)]);
    manifest.cycleId = Number(cycle.award_period_id);
    async function makeApplication(key, state, source = verified, user = an, collective = false) {
      let r = await application.create({ ...(collective ? { organizationUnitId: units.FIT_SE } : { lecturerId: lecturerIds['an.nv'] }), cycleId: Number(cycle.award_period_id),
        targetAwardTypeId: collective ? awardTypes['TAP_THE_LĐXS'] : awardTypes['CSTĐ_CS'], purpose: `${key} | Hồ sơ đề nghị ${collective ? 'tập thể' : 'cá nhân'} MÔ PHỎNG`, achievementIds: [source.achievementId] }, user);
      const id = Number(r.application_id);
      if (state !== 'DRAFT') r = await application.transition(id, { version: Number(r.version) }, user, 'submit');
      if (!['DRAFT','SUBMITTED'].includes(state)) r = await application.transition(id, { version: Number(r.version), reason: 'Đơn vị đã kiểm tra và chuyển Hội đồng - MÔ PHỎNG.' }, manager, 'forward');
      if (['UNDER_REVIEW','NEED_CORRECTION','RECOMMENDED','NOT_RECOMMENDED'].includes(state)) r = await application.review(id, { version: Number(r.version), reviewerId: council.userId, reason: 'Phân công Hội đồng xử lý hồ sơ mô phỏng.' }, council, 'assign');
      const action = { NEED_CORRECTION: 'request-correction', RECOMMENDED: 'recommend', NOT_RECOMMENDED: 'not-recommend' }[state];
      if (action) r = await application.review(id, { version: Number(r.version), reason: 'Kết luận của ca kiểm thử ' + key + ' - MÔ PHỎNG.' }, council, action);
      manifest.applications[key] = { id, status: r.status, owner: collective ? 'cuong.lh' : 'an.nv', sourceAchievementId: source.achievementId };
      return r;
    }
    for (const [key, state] of [['SCN-P01','DRAFT'],['SCN-P02','SUBMITTED'],['SCN-P03','COUNCIL_PENDING'],['SCN-P04','UNDER_REVIEW'],['SCN-P05','NEED_CORRECTION'],['SCN-P06','RECOMMENDED'],['SCN-P07','NOT_RECOMMENDED']]) await makeApplication(key, state);
    await makeApplication('SCN-PT01', 'COUNCIL_PENDING', collective, representative, true);
    async function makeAward(key, state, collective = false) {
      const decision = await awards.createDecision({ decisionNumber: `${key}-${year}-DEMO`, decisionDate: today, issuer: 'Đơn vị mô phỏng PTUD', title: key + ' | Quyết định MÔ PHỎNG, không có giá trị thực tế' }, officer);
      let r = await awards.createRecord({ ...(collective ? { organizationUnitId: units.FIT_SE } : { lecturerId: lecturerIds['an.nv'] }), awardTypeId: collective ? awardTypes['TAP_THE_LĐXS'] : awardTypes['CSTĐ_CS'], decisionId: Number(decision.decision_id), recognitionYear: year, achievementIds: [collective ? collectiveAchievementId : verified.achievementId] }, officer);
      const id = Number(r.record_id);
      if (key !== 'SCN-R01') await awards.upload(Number(decision.decision_id), fileObject(decisionFile, 'decision-demo.pdf'), officer);
      if (['RECORDED','REVOKED'].includes(state)) r = await awards.transition(id, { version: Number(r.version) }, officer, 'RECORDED');
      if (state === 'REVOKED') r = await awards.transition(id, { version: Number(r.version), reason: 'Thu hồi bản ghi mẫu để thử thay thế và lịch sử.' }, officer, 'REVOKED');
      manifest.awards[key] = { id, decisionId: Number(decision.decision_id), status: r.status, hasFile: key !== 'SCN-R01' };
    }
    const collectiveAchievementId = collective.achievementId;
    await makeAward('SCN-R01', 'DRAFT');
    await makeAward('SCN-R02', 'RECORDED');
    await makeAward('SCN-R03', 'REVOKED');
    await makeAward('SCN-RT01', 'RECORDED', true);

    for (const [key, accepted, result, subject] of [['SCN-K01',false,false,an],['SCN-K02',true,false,an],['SCN-K03',true,true,an],['SCN-KT01',true,true,representative]]) {
      const isCollective = subject === representative;
      let g = await kpi.create(subject, { subjectType: isCollective ? 'UNIT' : 'LECTURER', ...(isCollective ? { organizationUnitId: units.FIT_SE } : {}), code: key,
        title: key + ' | Mục tiêu nghiên cứu MÔ PHỎNG', measureUnit: 'hồ sơ', periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, target: 2,
        plan: 'Chuẩn bị hồ sơ và minh chứng, chưa phải thành tích đã được xác nhận.', sourceNote: 'MÔ PHỎNG - mục tiêu do người dùng nhập để kiểm thử.' });
      if (accepted) g = await kpi.mutateGoal(subject, Number(g.goal_id), 'accept', { version: Number(g.version) });
      if (result) await kpi.result(subject, Number(g.goal_id), 'create', { actual: 1, sourceNote: 'MÔ PHỎNG - kết quả nhập tay.', evidenceNote: 'Chuẩn bị tải evidence-demo.pdf sau khi chuyển thành kê khai nháp.' });
      manifest.kpi[key] = { id: Number(g.goal_id), status: g.status, owner: isCollective ? 'cuong.lh' : 'an.nv', hasResult: result };
    }
    // Confirm a source for demo selection while keeping SIMULATION_ONLY, never official policy.
    const adminUser = { ...users['duc.pm'], roles: ['ADMIN'] };
    const document = await regulation.createDocument({ documentCode: 'SCN-REGULATION', title: 'SCN | Tiêu chí kiểm thử MÔ PHỎNG', documentType: 'GUIDELINE', issuingAuthority: 'Nhóm phát triển - MÔ PHỎNG', description: 'Nguồn giả lập; không phải quy chế chính thức của LHU.' }, adminUser);
    const version = await regulation.createVersion(Number(document.document_id), { versionNumber: 'SCN-v1', effectiveFrom: dayOffset(-30), isOfficial: false, lhuApplicationStatus: 'SIMULATION_ONLY', contentForHash: 'SCN simulation criterion, never official policy' }, adminUser);
    await regulation.addChunks(Number(version.version_id), [{ articleNo: 'Mục demo', clauseNo: '1', pageNo: 1, content: 'MÔ PHỎNG: Chuẩn bị hai hồ sơ nghiên cứu có minh chứng để thực hành workflow. Đây không phải tiêu chuẩn khen thưởng thực tế.' }], adminUser);
    const criterion = await regulation.createCriteriaVersion(Number(version.version_id), { criterionCode: 'SCN-CRIT-01', name: 'SCN | Hai hồ sơ nghiên cứu - MÔ PHỎNG', targetType: 'BOTH', minThreshold: 2, unitMetric: 'hồ sơ', notes: 'MÔ PHỎNG; giữ chưa xác nhận để thử gate AI.' }, adminUser);
    await regulation.confirmVersion(Number(version.version_id), { isConfirmed: true, lhuApplicationStatus: 'SIMULATION_ONLY', confirmationNotes: 'Chỉ xác nhận bộ nguồn giả lập để thực hành UI; không phải chính sách LHU.' }, adminUser);
    await regulation.confirmCriterion(Number(criterion.criteria_version_id), { isConfirmed: true, notes: 'Xác nhận sử dụng dữ liệu MÔ PHỎNG cho test UI. Nguồn vẫn SIMULATION_ONLY; không dùng xét thưởng thật.' }, adminUser);
    const draftCriterion = await regulation.createCriteriaVersion(Number(version.version_id), { criterionCode: 'SCN-CRIT-DRAFT', name: 'SCN | Tiêu chí chưa xác nhận - MÔ PHỎNG', targetType: 'BOTH', minThreshold: 3, unitMetric: 'hồ sơ', notes: 'Giữ chưa xác nhận để thử gate; không phải tiêu chuẩn LHU.' }, adminUser);
    const ai = (await import('../../backend/src/modules/ai/aiService.js')).default;
    for (const [key, subjectType, subjectId, user] of [['SCN-AI01','LECTURER',lecturerIds['an.nv'],an],['SCN-AIT01','UNIT',units.FIT_SE,representative]]) {
      const run = await ai.evaluateStructured({ subjectType, subjectId, criteriaVersionIds: [Number(criterion.criteria_version_id)], forcedProvider: 'mock', asOfDate: today }, user);
      manifest.ai[key] = { runId: run.runId, overallConclusion: run.overallConclusion, criterionId: Number(criterion.criteria_version_id) };
    }
    manifest.units = units;
    manifest.lecturers = lecturerIds;
    manifest.criterionId = Number(criterion.criteria_version_id);
    manifest.unconfirmedCriterionId = Number(draftCriterion.criteria_version_id);
    manifest.storageDirectory = storageBase;
    // Check all files and application snapshots before the atomic commit.
    for (const row of (await client.query('SELECT storage_key,sha256_hash FROM app.evidence_files UNION ALL SELECT storage_key,sha256_hash FROM app.award_decision_files')).rows) {
      const bytes = fs.readFileSync(storage.resolveSafePath(row.storage_key));
      if (crypto.createHash('sha256').update(bytes).digest('hex') !== row.sha256_hash) throw new Error('File hash mismatch');
    }
    const missing = (await client.query("SELECT COUNT(*)::int n FROM app.award_applications a LEFT JOIN app.award_application_inputs i USING(application_id) WHERE a.status<>'DRAFT' AND i.application_id IS NULL")).rows[0].n;
    if (missing) throw new Error('Missing submitted application snapshots');
    await client.query('COMMIT'); committed = true;
    storage.saveFile = originalSave;
    setPool(pool);
    // Remove only files present before the reset, after a completed backup and commit.
    manifest.fileCleanupWarnings = [];
    for (const file of oldFiles) if (file.startsWith(storageBase + path.sep) && fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch (e) { manifest.fileCleanupWarnings.push({ file: path.relative(storageBase, file), code: e.code }); }
    }
    fs.mkdirSync(path.join(root, 'output/scenario'), { recursive: true });
    fs.writeFileSync(path.join(root, 'output/scenario/manifest.json'), JSON.stringify(manifest, null, 2));
    console.log('SCN ready: ' + Object.keys(manifest.achievements).length + ' achievements, ' + Object.keys(manifest.applications).length + ' applications, 4 award records, 4 KPI goals, 2 simulation assessments.');
    console.log('Manifest: output/scenario/manifest.json');
    return manifest;
  } catch (e) {
    if (client && !committed) { await client.query('ROLLBACK'); for (const file of addedFiles) if (file.startsWith(storageBase + path.sep) && fs.existsSync(file)) fs.unlinkSync(file); }
    throw e;
  } finally { if (storageAdapter && restoreSave) storageAdapter.saveFile = restoreSave; setPool(null); if (client) client.release(); await pool.end(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seedScenario({ apply: process.argv.includes('--apply') }).catch(e => { console.error('SCN failed:', e.message); process.exitCode = 1; });
}
