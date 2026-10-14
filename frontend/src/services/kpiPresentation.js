export function goalSourceText(note) {
  if (!/^AI W4-P1;/.test(note || '')) return note || '';
  const criterion = note.match(/tiêu chí ([^;]+)/)?.[1];
  const clauses = [...note.matchAll(/"clauseReference":"([^"]+)"/g)].map(match => match[1]);
  return ['Đề xuất từ phân tích AI', criterion && `Tiêu chí ${criterion}`, ...new Set(clauses)].filter(Boolean).join(' · ');
}
