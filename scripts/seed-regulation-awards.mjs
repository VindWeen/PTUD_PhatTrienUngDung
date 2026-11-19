import { ruleSchema } from '../backend/src/modules/intelligenceEvaluator.js';

const citations = [
  { label: 'Luật Thi đua, khen thưởng 06/2022/QH15', url: 'https://vanban.chinhphu.vn/?docid=206170&pageid=27160' },
  { label: 'Luật sửa đổi 06/2026/QH16', url: 'https://vanban.chinhphu.vn/?docid=218100&pageid=27160' },
  { label: 'Nghị định 368/2026/NĐ-CP', url: 'https://vanban.chinhphu.vn/?docid=219636&pageid=27160' },
  { label: 'Thông tư 25/2026/TT-BNV', url: 'https://vanban.chinhphu.vn/?docid=219729&pageid=27160' },
];
const quota = 'Điều 5 Nghị định 368/2026/NĐ-CP giới hạn tổng số được xét tặng theo điểm b, c và d ở mức không quá 10% số cá nhân đạt chuẩn Lao động tiên tiến hoặc Chiến sĩ tiên tiến, sau khi loại khỏi mẫu số các cá nhân được xét theo điểm a.';
const eq = (field, value) => ({ field: 'attributes.' + field, operator: 'eq', value });
const oneOf = (field, value) => ({ field: 'attributes.' + field, operator: 'in', value });
const count = (...filters) => ({ type: 'count', target: 1, filters });
const thisYear = (...filters) => ({ ...count(...filters), from: '2026-01-01', to: '2026-12-31' });
const either = (...rules) => ({ operator: 'OR', rules });
const streak = (kind, years) => ({
  type: 'distinct_years', consecutive: true, target: years, last_years: years, filters: [eq('kind', kind)],
});
const science = oneOf('kind', ['nghiem-thu', 'de-tai-khcn']);
const role = oneOf('role', ['CHU_NHIEM', 'THU_KY', 'THANH_VIEN_CHINH']);
const document = eq('has_recognition_doc', true);
const higherScope = oneOf('recognition_scope', ['MINISTRY', 'PROVINCE']);
const workStandard = thisYear(oneOf('kind', ['lao-dong-tien-tien', 'hoan-thanh-tot', 'xuat-sac']));
const manual = (title, ref, group) => ({ title, ref, group });
const automatic = (title, ref, rule, group, note) => ({ title, ref, rule, group, note });

const awards = [
  {
    code: 'QC-CSTDCS-2026', name: 'Chiến sĩ thi đua cơ sở',
    aggregation: { operator: 'OR' },
    groups: ['Hoàn thành xuất sắc nhiệm vụ', 'Tiêu chuẩn Lao động tiên tiến và sáng kiến', 'Tiêu chuẩn Lao động tiên tiến và nhiệm vụ KH&CN'],
    criteria: [
      automatic('Hoàn thành xuất sắc nhiệm vụ trong năm xét', 'Điểm a khoản 1 Điều 23', thisYear(eq('kind', 'xuat-sac')), 0),
      automatic('Đạt chuẩn Lao động tiên tiến hoặc hoàn thành tốt nhiệm vụ trở lên', 'Điểm b khoản 1 Điều 23', workStandard, 1),
      automatic('Sáng kiến có văn bản công nhận hiệu quả', 'Điểm b khoản 1 Điều 23 và khoản 2, 4 Điều 9 Thông tư 25', thisYear(eq('kind', 'sang-kien'), document), 1, quota),
      automatic('Đạt chuẩn Lao động tiên tiến hoặc hoàn thành tốt nhiệm vụ trở lên', 'Điểm c khoản 1 Điều 23', workStandard, 2),
      automatic('Nhiệm vụ KH&CN có vai trò phù hợp và văn bản công nhận', 'Điểm c khoản 1 Điều 23 và khoản 3, 4 Điều 9 Thông tư 25', thisYear(science, role, document), 2, quota),
    ],
  },
  {
    code: 'QC-CSTDBT-2026', name: 'Chiến sĩ thi đua Bộ, ban, ngành, tỉnh',
    aggregation: { operator: 'AND' },
    groups: [],
    criteria: [
      automatic('Ba năm liên tục được tặng Chiến sĩ thi đua cơ sở', 'Điểm a khoản 1 Điều 22', streak('cstd', 3)),
      automatic('Sáng kiến hoặc nhiệm vụ KH&CN được công nhận ở cấp Bộ, ban, ngành, tỉnh', 'Điểm b khoản 1 và khoản 2 Điều 22, Điều 9 Thông tư 25',
        either(count(eq('kind', 'sang-kien'), higherScope, document), count(science, higherScope, document))),
      manual('Hội đồng bình xét cá nhân có thành tích xuất sắc tiêu biểu', 'Điểm a khoản 1 Điều 22'),
    ],
  },
  {
    code: 'QC-BKBT-2026', name: 'Bằng khen của Bộ, ban, ngành, tỉnh',
    aggregation: { operator: 'OR', require_ungrouped: true },
    groups: ['Thành tích liên tục', 'Phong trào thi đua', 'Thành tích đột xuất', 'Đóng góp KH&CN, chuyển đổi số hoặc an sinh xã hội'],
    criteria: [
      manual('Gương mẫu chấp hành chủ trương, chính sách và pháp luật', 'Khoản 1 Điều 74'),
      automatic('Hai năm liên tục đạt Chiến sĩ thi đua cơ sở hoặc hoàn thành xuất sắc nhiệm vụ', 'Điểm d khoản 1 Điều 74',
        either(streak('cstd', 2), streak('xuat-sac', 2)), 0),
      manual('Thành tích xuất sắc được bình xét trong phong trào thi đua', 'Điểm a khoản 1 Điều 74', 1),
      manual('Thành tích đột xuất có phạm vi ảnh hưởng phù hợp', 'Điểm b khoản 1 Điều 74', 2),
      manual('Đóng góp được xác nhận trong lĩnh vực áp dụng', 'Điểm c khoản 1 Điều 74', 3),
    ],
  },
];

export const recognitionAttributes = {
  recognition_scope: {
    type: 'string', title: 'Phạm vi được công nhận', enum: ['BASE', 'MINISTRY', 'PROVINCE', 'NATIONAL'],
    enumNames: ['Cơ sở', 'Bộ, ban, ngành', 'Tỉnh', 'Toàn quốc'],
  },
  has_recognition_doc: { type: 'boolean', title: 'Đã có văn bản công nhận hiệu quả hoặc phạm vi của cấp có thẩm quyền' },
};

export async function seedAwardRegulations({ query, row, owner, organization }) {
  const versions = {};
  for (const award of awards) {
    const existing = (await query('SELECT r.owner_organization_id,v.id,v.publication_status FROM app.regulations r LEFT JOIN app.regulation_versions v ON v.regulation_id=r.id AND v.version_label=$2 WHERE r.code=$1',
      [award.code, 'Áp dụng từ 01/10/2026'])).rows[0];
    if (existing) {
      if (Number(existing.owner_organization_id) !== Number(organization) || existing.publication_status !== 'PUBLISHED')
        throw new Error('Mã quy chế đã được sử dụng: ' + award.code);
      versions[award.code] = existing.id;
      continue;
    }
    const regulation_id = await row('regulations', {
      code: award.code, name: award.name, description: 'Bộ tiêu chí mẫu để tự rà soát hồ sơ thi đua.',
      owner_type: 'ORGANIZATION', owner_organization_id: organization, created_by_user_id: owner, is_public: true, is_internal: true,
    });
    const regulation_version_id = await row('regulation_versions', {
      regulation_id, version_label: 'Áp dụng từ 01/10/2026', effective_from: '2026-10-01',
      source_title: 'Luật Thi đua, khen thưởng và văn bản hướng dẫn', source_url: citations[1].url,
      source_kind: 'DEMO', applicability_json: JSON.stringify({ person_types: ['LECTURER', 'STAFF'] }),
      aggregation_json: JSON.stringify(award.aggregation), created_by_user_id: owner,
    });
    const groups = [];
    for (const [index, title] of award.groups.entries()) {
      groups.push(await row('criterion_groups', {
        regulation_version_id, code: 'G' + (index + 1), title, operator: 'AND', is_required: true, sort_order: index,
      }));
    }
    for (const [index, criterion] of award.criteria.entries()) {
      const rule = ruleSchema.parse(criterion.rule ?? count());
      await row('criteria', {
        regulation_version_id, criterion_group_id: groups[criterion.group] ?? null,
        code: 'C' + (index + 1), title: criterion.title, source_reference: criterion.ref, sort_order: index,
        coverage_status: criterion.rule ? 'AUTOMATED' : 'MANUAL',
        rule_json: JSON.stringify(rule), provenance_json: JSON.stringify({ citations, note: criterion.note }),
      });
    }
    await query("UPDATE app.regulation_versions SET publication_status='PUBLISHED',published_at=SYSUTCDATETIME(),published_by_user_id=$2 WHERE id=$1", [regulation_version_id, owner]);
    await row('regulation_adoptions', { regulation_id, regulation_version_id, organization_id: organization, source_type: 'OWNED', adopted_by_user_id: owner });
    versions[award.code] = regulation_version_id;
  }
  return versions;
}
