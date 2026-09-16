// Dữ liệu mẫu cho giai đoạn dựng giao diện, không cần API hoặc đăng nhập.
export const demoUser = { fullName: 'Giảng viên LHU' };
export const dashboardSummaries = {
  personal: {
    achievements: { VerifiedCount: 12, PendingCount: 3, NeedCorrectionCount: 1, RejectedCount: 0, RevokedCount: 0, DraftCount: 2, TotalCount: 18 },
    awards: { RecordedCount: 3, IndividualCount: 3, UnitCount: 0, RevokedAwardCount: 0 },
    categories: { RESEARCH: 4, TEACHING: 5, AWARD: 2, OTHER: 1 },
    yearlyTrend: [],
  },
  unit: {
    achievements: { VerifiedCount: 86, PendingCount: 9, NeedCorrectionCount: 3, RejectedCount: 1, RevokedCount: 1, DraftCount: 8, TotalCount: 108 },
    awards: { RecordedCount: 18, IndividualCount: 15, UnitCount: 3, RevokedAwardCount: 0 },
    categories: { RESEARCH: 32, TEACHING: 36, AWARD: 10, OTHER: 8 },
    yearlyTrend: [],
  },
};
