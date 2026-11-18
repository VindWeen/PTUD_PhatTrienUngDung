import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { closeDB } from '../backend/src/config/database.js';
import { withTransaction } from '../backend/src/utils/dbHelper.js';
import { hashPassword } from '../backend/src/utils/crypto.js';
import { insertId } from '../backend/src/v2/shared.js';
import { permissions } from '../backend/src/v2/access.js';
import { canReadVersion, canUseVersion, listAccessiblePinnedContexts } from '../backend/src/v2/regulationAccess.js';
import { recognitionAttributes, seedAwardRegulations } from './seed-regulation-awards.mjs';
import { filePath, storageRoot, validateFile } from '../backend/src/v2/files.js';
import { evaluateVersion } from '../backend/src/v2/intelligenceEvaluator.js';
import { runAssessment } from '../backend/src/v2/intelligenceRoutes.js';

const { batch, kpis } = JSON.parse(await fs.readFile(new URL('./demo/lecturer-extra-fixtures.json', import.meta.url), 'utf8'));

const args = process.argv.slice(2).join(' ');
const request = /^--apply --database=(PTUD_LHU(?:_SeedTest_[0-9]+)?)( --awards-only)?$/.exec(args);
if (!request) throw new Error('Usage: node scripts/seed-lecturer-demo.mjs --apply --database=PTUD_LHU [--awards-only]');
const [, database, awardsOnly] = request;

const Zip = createRequire(new URL('../backend/package.json', import.meta.url))('pizzip');
const tag = 'DEMO-TDKT';
const password = randomBytes(15).toString('base64url');
const passwordHash = await hashPassword(password);
const written = [];
let evidenceCount = 0;
const today = new Date();
const dateAfter = days => new Date(today.getTime() + days * 86400000);
const sha = buffer => createHash('sha256').update(buffer).digest();
const json = JSON.stringify;

const recognitionDemo = {
  'Công nhận sáng kiến cải tiến học liệu': { recognition_scope: 'BASE', has_recognition_doc: true },
  'Nghiệm thu đề tài học liệu số': { recognition_scope: 'MINISTRY', role: 'CHU_NHIEM' },
};

function evidenceDocument(title) {
  const zip = new Zip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>DỮ LIỆU DEMO - Minh chứng giả lập</w:t></w:r></w:p><w:p><w:r><w:t>${title}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generate({ type: 'nodebuffer' });
}

try {
  const result = await withTransaction(async ({ query, client }) => {
    assert.equal((await query('SELECT DB_NAME() AS name')).rows[0].name, database);
    await query(`DECLARE @result int; EXEC @result=sys.sp_getapplock @Resource=N'DEMO-TDKT',
      @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000;
      IF @result<0 THROW 51000,'Could not lock demo seed',1;`);
    const row = async (table, fields, identity = true) => {
      const columns = Object.keys(fields).join(',');
      const values = Object.values(fields);
      const params = values.map((_, i) => '$' + (i + 1)).join(',');
      if (identity) return insertId(client, table, columns, params, values);
      await query(`INSERT INTO app.${table}(${columns}) VALUES(${params})`, values);
    };
    const existingSchool = (await query('SELECT id,created_by_user_id FROM app.organizations WHERE code=$1', [tag])).rows[0];
    if (awardsOnly) {
      if (!existingSchool) throw new Error('Demo school is required.');
      const versions = await seedAwardRegulations({ query, row, owner: existingSchool.created_by_user_id, organization: existingSchool.id });
      const types = (await query('SELECT id,code,attribute_schema_json FROM app.achievement_types WHERE code IN ($1,$2,$3)',
        [tag+'-sang-kien',tag+'-nghiem-thu',tag+'-de-tai-khcn'])).rows;
      for (const type of types) {
        const schema = JSON.parse(type.attribute_schema_json);
        const updated = { ...schema, type: 'object', properties: { ...schema.properties, ...recognitionAttributes } };
        await query('UPDATE app.achievement_types SET attribute_schema_json=$2 WHERE id=$1',[type.id,json(updated)]);
      }
      const samples = (await query(`SELECT a.id,a.title,a.attributes_json FROM app.achievements a
        JOIN app.users u ON u.id=a.owner_user_id JOIN app.achievement_types t ON t.id=a.achievement_type_id
        WHERE u.normalized_email=$1 AND t.code IN ($2,$3) AND a.deleted_at IS NULL`,
        ['gv-du@tdkt.demo.example.test',tag+'-sang-kien',tag+'-nghiem-thu'])).rows;
      let achievementsUpdated = 0;
      for (const sample of samples) {
        const title = sample.title.startsWith('[DEMO] ') ? sample.title.slice(7) : sample.title;
        if (!Object.hasOwn(recognitionDemo,title)) continue;
        const attributes = json({ ...recognitionDemo[title], ...JSON.parse(sample.attributes_json) });
        if (attributes === sample.attributes_json) continue;
        await query('UPDATE app.achievements SET attributes_json=$2,updated_at=SYSUTCDATETIME() WHERE id=$1',[sample.id,attributes]);
        achievementsUpdated++;
      }
      return { versions, achievementsUpdated };
    }
    if (existingSchool) throw new Error('Demo already exists. Use --awards-only to refresh regulation seeds.');
    const accounts = [
      ['admin', 'Quản trị hệ thống', 'OTHER'], ['truong', 'Quản lý trường', 'STAFF'],
      ['khoa-a', 'Trưởng khoa Công nghệ', 'LECTURER'], ['khoa-b', 'Trưởng khoa Kinh tế', 'LECTURER'],
      ['khoa-c', 'Trưởng khoa Ngoại ngữ', 'LECTURER'], ['gv-du', 'Nguyễn Minh An', 'LECTURER'],
      ['gv-thieu', 'Trần Thanh Bình', 'LECTURER'], ['gv-doclap', 'Lê Hoài Chi', 'LECTURER'],
      ...batch.map(member => [member.key, member.name, member.personType]),
    ];
    const users = {};
    for (const [key, name, person_type] of accounts) {
      const email = `${key}@tdkt.demo.example.test`;
      users[key] = await row('users', { email, password_hash: passwordHash });
      await row('person_profiles', { user_id: users[key], full_name: name, person_type }, false);
    }
    const admin = users.admin, manager = users.truong;
    await row('global_role_grants', { user_id: admin, role_code: 'SYSTEM_ADMIN' });
    const org = (code, name, organization_type, parent_id, created_by_user_id) =>
      row('organizations', { code, name, organization_type, parent_id, created_by_user_id });
    const school = await org(tag, 'Trường Đại học Lạc Hồng', 'UNIVERSITY', null, manager);
    const a = await org(tag+'-A', 'Khoa Công nghệ thông tin', 'FACULTY', school, manager);
    const b = await org(tag+'-B', 'Khoa Kinh tế', 'FACULTY', school, manager);
    const c = await org(tag+'-C', 'Khoa Ngoại ngữ', 'FACULTY', null, users['khoa-c']);
    for (const [organization_id, user_id] of [[school, manager], [a, users['khoa-a']], [b, users['khoa-b']], [c, users['khoa-c']]]) {
      for (const permission_code of permissions)
        await row('org_access_grants', { organization_id, user_id, permission_code, include_descendants: organization_id === school, granted_by_user_id: admin });
    }
    const full = users['gv-du'], gap = users['gv-thieu'], solo = users['gv-doclap'];
    const faculties = { A: a, B: b, C: c };
    const members = [[a, full, users['khoa-a']], [b, gap, users['khoa-b']],
      ...batch.map(member => [faculties[member.faculty], users[member.key], users['khoa-' + member.faculty.toLowerCase()]])];
    for (const [organization_id, user_id, approver] of members) {
      const request = await row('membership_join_requests', { organization_id, user_id });
      await query("UPDATE app.membership_join_requests SET status='ACCEPTED', responded_at=SYSUTCDATETIME(), responded_by_user_id=$2 WHERE id=$1", [request, approver]);
      await row('memberships', { organization_id, user_id, join_request_id: request, title: 'Giảng viên' });
    }
    await row('organization_link_requests', { child_organization_id: c, target_parent_id: school, request_type: 'ATTACH',
      requested_by_user_id: users['khoa-c'], child_consented_by_user_id: users['khoa-c'], expires_at: dateAfter(7), reason: 'DEMO: Xin trực thuộc trường' });
    await row('membership_invitations', { organization_id: c, invitee_user_id: solo, invited_by_user_id: users['khoa-c'], title: 'Giảng viên', expires_at: dateAfter(7) });
    await row('notifications', { recipient_user_id: solo, sender_user_id: users['khoa-c'], organization_id: c, notification_type: 'MEMBERSHIP_INVITATION', title: '[DEMO] Lời mời tham gia Khoa Ngoại ngữ' });

    async function publish({ code, name, owner, organization, criteria }) {
      const regulation_id = await row('regulations', { code: tag+'-'+code, name: '[DEMO] '+name,
        description: 'Dữ liệu trình diễn. Tiêu chí mẫu phục vụ đối chiếu, không xác nhận đủ điều kiện công nhận danh hiệu.',
        created_by_user_id: owner, owner_type: organization ? 'ORGANIZATION' : 'PERSONAL', owner_organization_id: organization ?? null,
        owner_user_id: organization ? null : owner, is_internal: Boolean(organization) });
      const version = await row('regulation_versions', { regulation_id, version_label: 'Demo 2026',
        effective_from: '2026-01-01', source_title: name, source_kind: 'DEMO',
        applicability_json: json({ person_types: ['LECTURER'] }), created_by_user_id: owner });
      for (const [index, criterion] of criteria.entries()) {
        await row('criteria', { regulation_version_id: version, code: 'C'+(index+1), title: criterion.title,
          source_reference: criterion.ref, rule_json: json(criterion.rule) });
      }
      await query("UPDATE app.regulation_versions SET publication_status='PUBLISHED',published_at=SYSUTCDATETIME(),published_by_user_id=$2 WHERE id=$1", [version, owner]);
      if (organization) await row('regulation_adoptions', { regulation_id, regulation_version_id: version, organization_id: organization, source_type: 'OWNED', adopted_by_user_id: owner });
      return version;
    }
    const count = kind => ({ type: 'count', target: 1, from: '2026-01-01', to: '2026-12-31',
      filters: [{ field: 'attributes.kind', operator: 'eq', value: kind }] });
    const awardVersions = await seedAwardRegulations({ query, row, owner: manager, organization: school });
    const core = awardVersions['QC-CSTDCS-2026'];
    const faculty = await publish({code:'KHOA-A', name:'Rà soát hồ sơ thi đua nội bộ Khoa Công nghệ', owner:users['khoa-a'], organization:a, criteria:[
      {title:'Có bản xác nhận áp dụng',ref:'Checklist mẫu của Khoa Công nghệ',rule:count('ap-dung')},
    ]});
    const personal = await publish({code:'CA-NHAN',name:'Danh sách tự rà soát hồ sơ giảng viên',owner:full,criteria:[
      {title:'Có quyết định công nhận sáng kiến',ref:'Checklist tự đặt của giảng viên',rule:count('sang-kien')},
    ]});

    const catalog = {};
    for (const [kind, name] of [['lao-dong-tien-tien','Lao động tiên tiến'],['xuat-sac','Đánh giá nhiệm vụ'],['sang-kien','Sáng kiến'],['nghiem-thu','Đề tài KH&CN'],['ap-dung','Xác nhận áp dụng'],['cstd','Chiến sĩ thi đua'],['cong-bo','Công bố khoa học']])
      catalog[kind] = await row('achievement_types', {code:tag+'-'+kind,name:'[DEMO] '+name, attribute_schema_json: json(['sang-kien','nghiem-thu'].includes(kind) ? { type:'object', properties:recognitionAttributes } : {})});
    const entries = [
      [full,'cstd','Quyết định Chiến sĩ thi đua cơ sở năm 2023','2023-12-20',true],
      [full,'cstd','Quyết định Chiến sĩ thi đua cơ sở năm 2024','2024-12-20',true],
      [full,'cstd','Quyết định Chiến sĩ thi đua cơ sở năm 2025','2025-12-20',true],
      [full,'lao-dong-tien-tien','Quyết định Lao động tiên tiến năm 2026','2026-10-15',true],
      [full,'xuat-sac','Đánh giá hoàn thành xuất sắc nhiệm vụ năm 2026','2026-10-10',true],
      [full,'sang-kien','Công nhận sáng kiến cải tiến học liệu','2026-08-12',true],
      [full,'nghiem-thu','Nghiệm thu đề tài học liệu số','2026-07-20',true],
      [full,'ap-dung','Xác nhận áp dụng học liệu tại hai đơn vị','2026-10-26',true],
      [full,'cong-bo','Bài báo về học liệu số','2026-06-15',false],
      [gap,'nghiem-thu','Biên bản nghiệm thu đề tài phân tích dữ liệu','2026-09-21',true],
      [gap,'lao-dong-tien-tien','Quyết định Lao động tiên tiến năm 2025','2025-11-20',false],
      [gap,'cong-bo','Báo cáo hội thảo về phân tích dữ liệu','2026-04-19',false],
      [gap,'xuat-sac','Đánh giá nhiệm vụ năm 2025','2025-10-19',false],
      [solo,'cong-bo','Bài báo về phương pháp giảng dạy','2026-05-13',false],
    ];
    const achievements = {};
    await fs.mkdir(storageRoot,{recursive:true});
    for (const [owner_user_id, kind, title, achieved_at, attach] of entries) {
      const attributes = owner_user_id === full ? { kind, ...recognitionDemo[title] } : { kind };
      const id = await row('achievements', { owner_user_id, achievement_type_id: catalog[kind], title:'[DEMO] '+title,
        achieved_at, attributes_json:json(attributes) });
      (achievements[owner_user_id] ??= []).push({id,achieved_at,attributes});
      if (attach) {
        const buffer=evidenceDocument(title);
        const meta=validateFile({buffer,originalname:'minh-chung-demo.docx'});
        const target=filePath(meta.key);
        await fs.writeFile(target,buffer,{flag:'wx'});
        written.push(target);
        evidenceCount++;
        await row('evidence_files',{achievement_id:id,owner_user_id,storage_key:meta.key,original_filename:'minh-chung-demo.docx',
          mime_type:meta.mime,byte_size:buffer.length,sha256:sha(buffer)});
      }
    }
    for (const member of batch) {
      for (const { kind, attributes, ...fields } of member.achievements) {
        assert.ok(catalog[kind], 'Missing achievement type: ' + kind);
        await row('achievements', { ...fields, owner_user_id: users[member.key], achievement_type_id: catalog[kind], attributes_json: json(attributes) });
      }
    }
    for (const { progress, tasks, ...fields } of kpis) {
      const goal_id = await row('kpi_goals', { ...fields, owner_user_id: full });
      for (const update of progress)
        await row('kpi_progress', { ...update, goal_id, owner_user_id: full });
      for (const task of tasks)
        await row('kpi_tasks', { ...task, goal_id, completed_at: task.status === 'DONE' ? today : null });
    }
    const goal = await row('kpi_goals', {owner_user_id:gap,title:'[DEMO] Xin xác nhận áp dụng đề tài',measure_unit:'xác nhận',status:'IN_PROGRESS'});
    for (const [owner_user_id, goal_id, title, day] of [[gap,goal,'Hẹn rà soát minh chứng',3],[full,null,'Chuẩn bị hồ sơ thi đua',5]]) {
      const starts_at=dateAfter(day);
      await row('calendar_events',{owner_user_id,goal_id,title:'[DEMO] '+title,starts_at,ends_at:new Date(starts_at.getTime()+3600000)});
    }
    const template = await row('cv_templates',{code:tag+'-CV',name:'[DEMO] CV Giảng viên',renderer_key:'Academic'});
    for (const [owner_user_id, isPublic, slug] of [[full,true,'demo-tdkt-giang-vien'],[gap,false,'demo-tdkt-ho-so-rieng']]) {
      const cv_id=await row('cvs',{owner_user_id,template_id:template,title:'[DEMO] Hồ sơ giảng viên',public_slug:slug,
        publication_status:isPublic?'PUBLIC':'PRIVATE',published_at:isPublic?today:null});
      await row('cv_achievements',{cv_id,owner_user_id,achievement_id:achievements[owner_user_id][0].id},false);
    }
    assert.equal(await canUseVersion(full,core,query),true);
    assert.equal(await canUseVersion(gap,core,query),true);
    assert.equal(await canReadVersion(solo,core,query),true);
    assert.equal(await canUseVersion(solo,core,query),false);
    assert.equal(await canUseVersion(full,faculty,query),true);
    assert.equal(await canReadVersion(manager,faculty,query),false);
    assert.equal(await canReadVersion(gap,faculty,query),false);
    assert.equal(await canReadVersion(admin,faculty,query),true);
    assert.equal(await canReadVersion(admin,personal,query),false);
    const version = (await query('SELECT * FROM app.regulation_versions WHERE id=$1',[core])).rows[0];
    const criteria = (await query('SELECT * FROM app.criteria WHERE regulation_version_id=$1',[core])).rows;
    const groups = (await query('SELECT * FROM app.criterion_groups WHERE regulation_version_id=$1',[core])).rows;
    for (const [user, conclusion] of [[full,'MET'],[gap,'NOT_MET']])
      assert.equal(evaluateVersion(version,groups,criteria,{person_type:'LECTURER'},achievements[user],'2026-11-18').conclusion,conclusion);
    let historyRuns = 0;
    const day = '2026-11-19';
    for (const subject of [full, gap]) {
      const contexts = await listAccessiblePinnedContexts(subject, query);
      for (const versionId of Object.values(awardVersions)) {
        const context = contexts.find(item => Number(item.regulation_version_id) === Number(versionId));
        assert.ok(context, 'Missing demo regulation context');
        for (const evaluationDate of ['2026-11-18', day]) {
          await runAssessment({ user: { userId: subject } }, subject, versionId, evaluationDate, null, null, query, client, context);
          historyRuns++;
        }
      }
    }
    const scanBatch = await row('assessment_batches', {
      initiated_by_user_id: manager, organization_id: school, include_descendants: true,
      batch_type: 'ORGANIZATION', status: 'RUNNING', request_snapshot_json: json({ regulation_version_id: core, evaluation_date: day, include_descendants: true }),
    });
    for (const [organization, subject] of members.filter(([org]) => org === a || org === b)) {
      await runAssessment({ user: { userId: manager } }, subject, core, day, scanBatch, organization, query, client);
      historyRuns++;
    }
    await query("UPDATE app.assessment_batches SET status='COMPLETED',completed_at=SYSUTCDATETIME() WHERE id=$1",[scanBatch]);
    return { accounts: accounts.map(([key, role]) => ({role,email:`${key}@tdkt.demo.example.test`})), cv:'/cv/demo-tdkt-giang-vien',
      organizations:4, regulations:5, achievements:entries.length + batch.reduce((total, member) => total + member.achievements.length, 0), evidence:evidenceCount, kpis: kpis.length + 1, historyRuns };
  });
  console.log(json(awardsOnly ? result : {...result,password},null,2));
} catch (error) {
  await Promise.allSettled(written.map(file => fs.unlink(file)));
  throw error;
} finally {
  await closeDB();
}
