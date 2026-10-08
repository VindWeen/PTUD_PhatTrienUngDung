# Checklist nghiệm thu W5-P4

- [x] Đọc blueprint/source/hợp đồng; kế hoạch DB theo ADR-001 Supabase pg.
- [x] Xác định Q1/Q3/P3 trong lịch sử local; không tuyên bố PR remote đã merge.
- [x] Review backend quyền/trạng thái trước đọc/sửa file; sửa fallback quyền JWT khi DB lỗi.
- [x] Thử restore độc lập bằng backup cục bộ và schema/thư mục riêng; kết quả FAIL được giữ.
- [x] Lập nguồn đóng góp, mục lục báo cáo, slide cần số liệu, manifest khóa tư liệu ứng viên.
- [x] Phân biệt fixture/mockup/KPI mô phỏng/offline gate; không công bố accuracy AI chưa đo.
- [ ] Q3 sửa drift `achievements.verified_by`, chạy restore hoàn tất; kiểm số dòng/hash/HTTP file và file quyết định.
- [ ] Q3 xử lý findings bảo vệ restore trong PR_REVIEW.
- [ ] Chụp UI live ứng viên đã khử định danh; đối soát ERD hiện hành với schema thực.
- [ ] Xác minh URL/trạng thái PR; xác nhận tên peer và nguồn/nhãn AI trước dùng số đo.

## Lệnh đã chạy và tự kiểm

Từ root, `node --test backend/tests/w5-q1.test.js backend/tests/w2-q2.test.js` → PASS 10/10. Sau sửa chạy thêm `backend/tests/w5-p4.test.js` cùng hai file trên; xem verification.json cho kết quả cuối.

Restore W5-P4 tái dùng runner đã có, không migrate/seed app dùng chung:

```powershell
$env:W5_P3_ENV_FILE=(Resolve-Path backend/.env).Path
$env:W5_P3_BACKUP_DIR=(Resolve-Path backups/w5p3_http).Path
node backend/tests/w5-p3.integration.js
Remove-Item Env:W5_P3_ENV_FILE,Env:W5_P3_BACKUP_DIR
```

Cần secrets cục bộ và quyền tạo schema. Backup chứa dữ liệu thật, luôn giữ Git ignore. Runner sinh schema random, migrate/seed trên schema riêng, restore vào schema riêng khác, finally dọn cả hai. Không chạy restore mặc định hoặc force-overwrite-primary. Lượt 08/10/2026: Supabase thật, 5 login HTTP qua, restore exit 1 / SQLSTATE 42703. HTTP file restored chưa chạy, không PASS. Log đầy đủ chỉ ở output/w5-p4/restore-local.log (ignore).

Tự kiểm review: role DB lỗi/response sai/role thu hồi + JWT cũ phải chặn trước storage; owner hợp lệ vẫn theo quyền sẵn có. Đối chiếu hash manifest bằng Get-FileHash SHA256. Khi đổi code/tư liệu phải cập nhật baseline, kết quả và manifest; không dùng kết quả cũ cho code mới.

API download vẫn `/api/v1/evidence-files/:id/download`; lỗi đọc role DB được chuyển middleware lỗi, không fallback JWT. Không đổi request/response thành công. Chưa nghiệm thu đầy đủ W5-P4 do blocker Q3; không commit/push/merge.

Commit đề xuất: `fix(W5-P4): fail closed evidence role lookup and freeze sourced report inputs`.
