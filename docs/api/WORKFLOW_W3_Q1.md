# Tài liệu Hợp đồng Kỹ thuật & Luồng Nghiệp vụ W3-Q1

**Phụ trách**: Tạ Trần Vinh Quang (W3-Q1)  
**Chủ đề**: Bổ sung, gửi lại, từ chối, hủy và thu hồi (Achievements Workflow State Machine)  
**Tiêu chuẩn Kiến trúc**: REST API `/api/v1`, Supabase PostgreSQL driver `pg` với giao dịch ACID, kiểm soát đồng thời lạc quan (OCC version), lưu trữ bất biến (Snapshot Revision).

---

## 1. Bảng Trạng thái & Ma trận Hành động

| Trạng thái hiện tại | Hành động (Action) | Endpoint REST | Vai trò được phép | Trạng thái sau | Yêu cầu lý do (Reason) |
|---|---|---|---|---|---|
| `DRAFT` | Nộp hồ sơ (`SUBMIT`) | `POST /achievements/:id/submit` | Chủ hồ sơ / Đại diện | `SUBMITTED` | Tùy chọn |
| `DRAFT` | Hủy hồ sơ (`CANCEL`) | `POST /achievements/:id/cancel` | Chủ hồ sơ / Đại diện | `CANCELLED` | Tùy chọn |
| `SUBMITTED` | Yêu cầu bổ sung (`REQUEST_CORRECTION`) | `POST /achievements/:id/request-correction` | Manager đúng Scope | `NEED_CORRECTION` | **Bắt buộc** (>= 5 ký tự) |
| `SUBMITTED` | Phê duyệt (`VERIFY`) | `POST /achievements/:id/verify` | Manager đúng Scope | `VERIFIED` | Tùy chọn |
| `SUBMITTED` | Từ chối (`REJECT`) | `POST /achievements/:id/reject` | Manager đúng Scope | `REJECTED` | **Bắt buộc** (>= 5 ký tự) |
| `SUBMITTED` | Hủy hồ sơ (`CANCEL`) | `POST /achievements/:id/cancel` | Chủ hồ sơ / Đại diện | `CANCELLED` | **Bắt buộc** (>= 5 ký tự) |
| `NEED_CORRECTION` | Gửi lại (`RESUBMIT` / `SUBMIT`) | `POST /achievements/:id/resubmit` | Chủ hồ sơ / Đại diện | `SUBMITTED` | Tùy chọn (tăng revision) |
| `NEED_CORRECTION` | Hủy hồ sơ (`CANCEL`) | `POST /achievements/:id/cancel` | Chủ hồ sơ / Đại diện | `CANCELLED` | **Bắt buộc** (>= 5 ký tự) |
| `VERIFIED` | Thu hồi xác nhận (`REVOKE`) | `POST /achievements/:id/revoke` | Manager đúng Scope | `REVOKED` | **Bắt buộc** (>= 5 ký tự) |
| `REJECTED` / `CANCELLED` / `REVOKED` | Tạo bản thay thế (`REPLACE`) | `POST /achievements/:id/replace` | Chủ hồ sơ / Đại diện | `DRAFT` (hồ sơ mới) | Tùy chọn (lưu `replaces_achievement_id`) |

---

## 2. Quy tắc Nghiệp vụ Cốt lõi (Business Rules)

1. **Khóa Bất biến (Immutability)**:
   - Hồ sơ đạt `VERIFIED` bị khóa toàn bộ thao tác sửa đổi thông tin, thêm/sửa/xóa tệp minh chứng và nộp lại (trả HTTP 409 `ConflictError`).
   - Sửa sai chỉ có thể thực hiện thông qua việc Thu hồi (`REVOKE`) có căn cứ, sau đó tạo bản thay thế (`REPLACE`).
2. **Snapshot Đóng băng Phiên bản (Revisions)**:
   - Mỗi lần nộp duyệt (`SUBMIT` hoặc `RESUBMIT`), hệ thống tạo một bản ghi snapshot trong `app.achievement_submissions` với số hiệu `revision_no = MAX(revision_no) + 1`.
   - Toàn bộ danh sách tệp minh chứng active tại thời điểm nộp được đóng băng vào `app.submission_evidence_files`.
   - Snapshot cũ (v1) giữ nguyên vẹn tệp của lần nộp cũ; snapshot mới (v2) phản ánh chính xác tệp bổ sung của lần nộp mới.
3. **Liên kết Bản thay thế (`replaces_achievement_id`)**:
   - Khi hồ sơ rơi vào trạng thái kết thúc (`REJECTED`, `CANCELLED`, `REVOKED`), người dùng được quyền tạo bản kê khai mới thay thế.
   - Bản ghi mới kế thừa thông tin cơ bản và lưu trữ `replaces_achievement_id` trỏ về hồ sơ cũ để bảo đảm tính truy nguyên nguồn gốc lịch sử.
4. **Kiểm soát Đồng thời Lạc quan (OCC)**:
   - Mọi thao tác chuyển trạng thái bắt buộc gửi kèm số hiệu phiên bản `version` (`UPDATE ... WHERE version = $v`). Nếu có yêu cầu cạnh tranh, request sau bị từ chối với HTTP 409 `CONCURRENCY_CONFLICT`.
5. **Giao dịch Toàn vẹn (ACID Transaction)**:
   - Chuyển trạng thái, cập nhật version, đóng băng snapshot, ghi dòng thời gian lịch sử (`status_histories`), lưu nhật ký kiểm toán (`audit_logs`) và gửi thông báo (`notifications`) được thực hiện trên cùng một PostgreSQL client transaction trước khi COMMIT.
