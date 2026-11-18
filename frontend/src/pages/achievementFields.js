export const detailLabels = {
  recognition_scope: 'Phạm vi được công nhận', has_recognition_doc: 'Văn bản công nhận',
  category: 'Lĩnh vực hoạt động', role: 'Vai trò tham gia', grade: 'Xếp loại / Giải thưởng', rank: 'Hạng',
  hours: 'Số giờ hoạt động', teaching_periods: 'Số tiết quy đổi', contribution_percent: 'Tỷ lệ đóng góp (%)',
  decision_number: 'Số quyết định', academic_year: 'Năm học', recognition_year: 'Năm công nhận',
};
export const numericDetails = new Set(['hours', 'teaching_periods', 'contribution_percent', 'recognition_year']);
export const basicDetailKeys = ['category', 'role', 'grade'];
export const primaryLabels = { title: 'Tên thành tích', achievedAt: 'Ngày đạt', issuer: 'Đơn vị cấp', achievementTypeId: 'Loại thành tích' };
export const displayAchievementTitle = title => String(title || '').replace(/^\s*\[DEMO\]\s*/i, '') || title;

export function dynamicAchievementFields(type) {
  const text = [type?.code, type?.name].filter(Boolean).join(' ').toLowerCase();
  if (/giảng dạy|teaching|giờ giảng/.test(text)) return ['teaching_periods', 'academic_year'];
  if (/bài báo|công bố|scientific.paper|publication|journal/.test(text)) return ['contribution_percent'];
  if (/tình nguyện|dịch vụ cộng đồng|community|volunteer/.test(text)) return ['hours'];
  return [];
}

export function suggestedAchievementFields(data, types) {
  const normalize = value => String(value || '').trim().toLocaleLowerCase('vi');
  const typeName = normalize(data.achievementType);
  const type = typeName && types.find(item => [item.code, item.name].some(value => normalize(value) === typeName));
  const date = data.issueDate;
  const day = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date) : null;
  const achievedAt = day && Number.isFinite(day.valueOf()) && day.toISOString().slice(0, 10) === date ? date : undefined;
  const present = object => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  return {
    fields: present({ title: data.title?.slice(0, 300), achievedAt, issuer: data.issuer?.slice(0, 300), achievementTypeId: type ? String(type.id) : undefined }),
    details: present({
      decision_number: data.decisionNumber, academic_year: data.academicYear, recognition_year: data.recognitionYear,
      teaching_periods: data.teachingPeriods, contribution_percent: data.contributionPercent, hours: data.hours,
      role: data.role, grade: data.grade,
      category: { TEACHING: 'Giảng dạy', SCIENTIFIC_RESEARCH: 'Nghiên cứu khoa học', COMMUNITY_SERVICE: 'Hoạt động cộng đồng' }[data.category],
    }),
  };
}

export function formatAchievementValue(value) {
  if (Array.isArray(value)) return value.map(formatAchievementValue).join(', ');
  if (value && typeof value === 'object') return Object.entries(value).map(([key, entry]) => key + ': ' + formatAchievementValue(entry)).join(', ');
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  return String(value ?? '');
}
