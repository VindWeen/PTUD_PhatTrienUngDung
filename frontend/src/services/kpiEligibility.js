export function recommendationBlockReason(run) {
  if (!run) return 'Chọn phiên thẩm định để kiểm tra điều kiện tạo gợi ý.';
  if (run.isStale) return 'Dữ liệu hồ sơ hoặc quy định đã thay đổi. Hãy thực hiện thẩm định mới.';
  if (run.overallStatus === 'FAILED') return 'Phiên thẩm định không thành công. Hãy thực hiện lại ở trang thẩm định.';
  if (run.overallStatus !== 'COMPLETED') return 'Phiên còn tiêu chí mô phỏng, chưa xác nhận hoặc cần người có thẩm quyền rà soát. Hoàn thiện căn cứ và hồ sơ trước khi thẩm định lại.';
  return '';
}

export function criterionBlockReasons(run) {
  return (run?.criterionResults || []).flatMap(c => {
    const reasons = [];
    if (c.isSimulation || !c.isConfirmedByLhu) reasons.push('căn cứ/tiêu chí chưa được xác nhận áp dụng');
    if (c.humanReviewRequired || c.thresholdMetric?.isSatisfied === 'UNCONFIRMED') reasons.push('cần rà soát dữ liệu và minh chứng');
    return reasons.length ? [`${c.criterionName || c.criterionCode}: ${reasons.join('; ')}.`] : [];
  });
}
