const fields = {
  title: 'tên thành tích', issuer: 'đơn vị cấp', level_code: 'cấp thành tích',
  achievement_type_id: 'loại thành tích', achieved_at: 'ngày đạt',
  'attributes.kind': 'loại minh chứng', 'attributes.recognition_scope': 'phạm vi công nhận',
  'attributes.has_recognition_doc': 'văn bản công nhận',
  'attributes.category': 'nhóm hoạt động', 'attributes.role': 'vai trò',
  'attributes.grade': 'xếp loại', 'attributes.hours': 'số giờ', 'attributes.rank': 'hạng',
};
const labels = { gte: 'ít nhất', lte: 'không quá', eq: 'đúng' };
const operators = { eq: 'là', ne: 'khác', in: 'thuộc một trong các giá trị', contains: 'chứa', gte: 'từ', lte: 'tối đa' };
const fieldLabel = field => fields[field] || (field?.startsWith('attributes.') ? 'thông tin bổ sung' : 'trường dữ liệu');
const dateLabel = value => String(value).slice(0, 10).split('-').reverse().join('/');

const valuesByField = {
  'attributes.kind': {
    'xuat-sac': 'Hoàn thành xuất sắc nhiệm vụ', 'hoan-thanh-tot': 'Hoàn thành tốt nhiệm vụ',
    'lao-dong-tien-tien': 'Lao động tiên tiến', 'sang-kien': 'Sáng kiến',
    'nghiem-thu': 'Nghiệm thu đề tài', 'de-tai-khcn': 'Nhiệm vụ khoa học và công nghệ',
    'cstd': 'Chiến sĩ thi đua cơ sở', 'chien-si-thi-dua-co-so': 'Chiến sĩ thi đua cơ sở',
    'ap-dung': 'Xác nhận áp dụng', 'cong-bo': 'Công bố khoa học',
  },
  'attributes.role': { CHU_NHIEM: 'Chủ nhiệm', THU_KY: 'Thư ký', THANH_VIEN_CHINH: 'Thành viên chính' },
  'attributes.recognition_scope': { BASE: 'Cơ sở', MINISTRY: 'Bộ, ban, ngành', PROVINCE: 'Tỉnh', NATIONAL: 'Toàn quốc' },
};

export const formatRegulationOperator = operator => operator === 'OR' ? 'Đạt ít nhất một điều kiện' : 'Đạt tất cả điều kiện';

export function formatRegulationRule(value, catalog = [], coverageStatus) {
  if (coverageStatus === "MANUAL") return "Cần hội đồng / cán bộ rà soát minh chứng";
  if (coverageStatus === "UNSUPPORTED") return "Cần kiểm tra minh chứng ngoài hệ thống";
  const rule = typeof value === 'string' ? parseRule(value) : value;
  if (!rule || typeof rule !== 'object') return 'Chưa có cách đối chiếu tự động.';
  if (Array.isArray(rule.rules)) {
    return formatRegulationOperator(rule.operator) + ': '
      + rule.rules.map(child => '(' + formatRegulationRule(child, catalog) + ')').join('; ');
  }
  const comparator = labels[rule.comparator] || 'ít nhất';
  const threshold = comparator + ' ' + rule.target;
  const descriptions = {
    count: 'Có ' + threshold + ' thành tích phù hợp',
    sum: 'Tổng ' + fieldLabel(rule.field) + ' đạt ' + threshold + (rule.measure_unit ? ' ' + rule.measure_unit : ''),
    distinct_years: 'Có thành tích phù hợp trong ' + threshold + (rule.consecutive ? ' năm liên tiếp' : ' năm khác nhau'),
    boolean: 'Kiểm tra sự tồn tại của thành tích phù hợp, với giá trị ' + threshold + ' (1 = có, 0 = không)',
  };
  const filters = (rule.filters || []).map(filter => {
    if (filter.field === 'attributes.has_recognition_doc' && filter.operator === 'eq')
      return filter.value ? 'đã có văn bản công nhận' : 'chưa có văn bản công nhận';
    const values = (Array.isArray(filter.value) ? filter.value : [filter.value]).map(item => {
      if (filter.field === 'achievement_type_id') return catalog.find(type => String(type.id) === String(item))?.name || 'loại thành tích đã chọn';
      const labelsForField = valuesByField[filter.field];
      if (labelsForField) return Object.hasOwn(labelsForField, item) ? labelsForField[item] : 'giá trị đã cấu hình';
      return typeof item === 'boolean' ? (item ? 'Có' : 'Không') : String(item);
    });
    return fieldLabel(filter.field) + ' ' + (operators[filter.operator] || '') + ' ' + values.join(', ');
  });
  const window = [rule.from && 'từ ' + dateLabel(rule.from), rule.to && 'đến ' + dateLabel(rule.to), rule.last_years && 'trong ' + rule.last_years + ' năm trước ngày xét'].filter(Boolean);
  return [descriptions[rule.type] || 'Xem căn cứ để biết điều kiện áp dụng', filters.length && 'Chỉ tính khi ' + filters.join(', '), window.length && 'Thời gian: ' + window.join(', ')].filter(Boolean).join('. ') + '.';
}

export function describeRegulationRule(value, catalog, coverageStatus) {
  const rule = typeof value === 'string' ? parseRule(value) : value;
  if (Array.isArray(rule?.rules) && (!coverageStatus || coverageStatus === 'AUTOMATED')) {
    return {
      label: formatRegulationOperator(rule.operator),
      connector: rule.operator === 'OR' ? 'Hoặc' : 'Và',
      children: rule.rules.map(child => describeRegulationRule(child, catalog)),
    };
  }
  return { label: formatRegulationRule(rule, catalog, coverageStatus) };
}

function parseRule(value) {
  try { return JSON.parse(value); } catch { return null; }
}
