// Presentation only: the stored response and deterministic evaluation stay intact.
export function humanizeExplanation(value = '') {
  return String(value)
    .replace(/(?:chỉ\s*số\s*đạt\s*:\s*)?\bnull\s*\/\s*\d+(?:[.,]\d+)?/gi, 'chưa tính được số lượng so với ngưỡng yêu cầu')
    .replace(/CRITERION_SOURCE_UNMAPPED/g, 'chưa cấu hình nguồn dữ liệu')
    .replace(/(?<![A-Z0-9-])(?:SIMULATED_KPI|SIMULATION)(?![A-Z0-9-])/g, 'dữ liệu mô phỏng')
    .replace(/UNCONFIRMED/g, 'chưa thể kết luận')
    .replace(/HUMAN_REVIEW_REQUIRED/g, 'cần người có thẩm quyền rà soát')
    .replace(/MISSING_DATA/g, 'thiếu dữ liệu hoặc minh chứng')
    .replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g, token => token === 'CHUNK_ID' ? token : 'vấn đề cần kiểm tra (xem thông tin kỹ thuật)')
    .replace(/\bnull\b|\bN\/A\b/g, 'chưa xác định');
}

export function splitExplanation(text = '') {
  const sections = [];
  const intro = [];
  let current = null;
  let summary = [];
  let collectingSummary = false;
  for (const line of String(text).split('\n')) {
    const plain = line.replace(/^\s*#{1,6}\s*/, '').replace(/\*\*/g, '').trim();
    const conclusion = plain.match(/^(?:\d+[.)]\s*)?(?:Tóm lại|Kết luận)(?:\s*[:：]|\s*$)/i);
    const numbered = plain.match(/^([1-5])[.)]\s+(.+)$/);
    // Treat numbered text as a section heading only when it is short and heading-like.
    const heading = numbered && numbered[2].length < 110 && !/[.!?]\s+\S/.test(numbered[2]);
    if (conclusion) {
      collectingSummary = true;
      summary.push(line.replace(/^\s*(?:#{1,6}\s*)?(?:\*\*)?(?:\d+[.)]\s*)?(?:\*\*)?(?:Tóm lại|Kết luận)(?:\*\*|\s|[:：])*/i, ''));
    } else if (heading) {
      collectingSummary = false;
      current = { number: Number(numbered[1]), title: numbered[2].replace(/\*\*/g, ''), lines: [] };
      sections.push(current);
    } else if (collectingSummary) summary.push(line);
    else if (current) current.lines.push(line);
    else intro.push(line);
  }
  return { intro: intro.join('\n').trim(), summary: summary.join('\n').trim(), sections: sections.map(section => ({ ...section, text: section.lines.join('\n').trim() })) };
}
