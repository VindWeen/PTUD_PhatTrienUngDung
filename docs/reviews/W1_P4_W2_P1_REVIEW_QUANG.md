# Review W1-P4 & W2-P1 (Võ Nhạc Phước) — Người review: Tạ Trần Vinh Quang

Ngày review: 05/10/2026 · Phạm vi: `origin/w1-p4` (bb6eb73), `origin/w2-p1` (4ea8344) · Kết luận: **Chấp thuận merge vào `main`** kèm các ghi chú bên dưới.

## 1. Tích hợp nhánh

`w1q4` (W1-P1, W1-P3, W1-Q4 + `main`) và `w2-p1` (W1-P1, W1-P3, W1-P4, W2-P1) cùng tách từ `72da9bc`. Merge có 2 conflict:

| File | Cách giải quyết |
|---|---|
| `backend/package.json` | Giữ cả `test:audit`, `demo:w1-q4` (Q4) và `test:w2-p1`, `test:w2-p1:integration` (P1). |
| `organizationController.js` | `create/update/remove` giữ tham số `req.user?.userId` để ghi audit (Q4); `appoint` dùng `adminRepository.assign` (W2-P1) vì kiểm tra vai trò đại diện bao phủ thời hạn và ghi audit trong cùng transaction. |

## 2. Kết quả kiểm thử sau merge

| Lệnh | Kết quả |
|---|---|
| `npm run migrate` | Áp dụng `20261002000011_w2_p1_assignment_revocation.sql` lên Supabase |
| `npm test` (auth & phân quyền) | 31/31 đạt |
| `npm run test:audit` | 5/5 đạt |
| `npm run test:w1-p3` | 4/4 đạt |
| `npm run test:w2-p1` | 5/5 đạt |
| `npm run test:w2-p1:integration` | 66 HTTP assertions đạt, rollback dữ liệu test |
| `node scripts/validate_contracts.mjs` | 68/68 đạt |
| Frontend `lint` + `build` | Đạt |

## 3. Đánh giá W1-P4 (kho nguồn quy định & review auth)

- Sổ nguồn `06_Nguon.csv` + README và biên bản xác nhận nghiệp vụ đầy đủ theo tiêu chí kế hoạch.
- Review auth phát hiện đúng lỗi `requireRoles('MANAGER', 'UNIT_REP')` (mã vai trò sai) trên `/auth/verify-scope`; sửa thành chỉ `MANAGER` + `roleCode` cho `requireScope` là hợp lý.
- Biên hiệu lực đổi `valid_to >= NOW()` → `valid_to > NOW()` (khoảng nửa mở `[)`), thống nhất với exclusion constraint.

## 4. Đánh giá W2-P1 (tài khoản, phân công, danh mục)

Điểm tốt:
- Thu hồi bằng `revoked_at`, giữ lịch sử; exclusion constraint chỉ áp dụng bản ghi chưa thu hồi.
- `isUnitInUserScope` / `getActiveScopes` kiểm tra lại trạng thái tài khoản, đơn vị, vai trò gốc mỗi request → khóa tài khoản có hiệu lực ngay với access token cũ (đã có test).
- Khóa tài khoản thu hồi refresh token; ADMIN không tự suy ra quyền MANAGER.
- `requireUnitRead` / `requireLecturerRead` đóng lỗ hổng đọc hồ sơ ngoài phạm vi.

Ghi chú cần xử lý tiếp (không chặn merge):
1. **Audit chưa đi qua `auditService` của Q4**: `adminRepository.mutate` tự `INSERT audit_logs` với action chung `ADMIN_CHANGE` và chỉ xóa `password_hash`. Nên dùng chung bộ che bí mật của `recordAuditLog` (hoặc export hàm mask) và action cụ thể (`ADMIN_USER_UPDATE`, `ADMIN_SCOPE_REVOKE`…) để tra cứu.
2. **Đổi hành vi bổ nhiệm đại diện**: luồng cũ tự đóng nhiệm kỳ đại diện trước; `assign` mới sẽ báo lỗi exclusion constraint nếu chồng thời gian. Cần map lỗi `23P01` thành `409` có thông điệp rõ ràng, và `organizationService.appointRepresentative` hiện không còn được controller dùng (dead code) — nên xóa hoặc gom về một luồng.
3. **CI chưa chạy `test:w2-p1`**: nên thêm vào `.github/workflows/ci.yml`.
4. Seed: tài khoản `records.demo` dùng `user_id = 5` cố định — kiểm tra không đụng sequence khi chạy seed lại.
5. Cảnh báo checksum migration `000004`–`000008` khi chạy `migrate` (khả năng do CRLF/LF giữa hai máy) — nên thêm `.gitattributes` cho `*.sql text eol=lf`.
