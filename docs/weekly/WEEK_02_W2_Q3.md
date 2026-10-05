# Báo cáo Bàn giao W2-Q3 — Gửi và Xác nhận có Snapshot, Lịch sử, Transaction

Phụ trách: **Tạ Trần Vinh Quang**  
Nhiệm vụ: **W2-Q3: Gửi và xác nhận có snapshot, lịch sử, transaction trong project PTUD_PhatTrienUngDung**  
Bối cảnh: React 18 / Vite / TailwindCSS, Express REST `/api/v1`, Supabase (PostgreSQL) qua `pg` connection pool; auth Express và file private giữ nguyên; kế thừa và tích hợp các module đã chốt: W1-Q4 (Audit Log), W1-P3 (Tổ chức & Phạm vi), W2-Q1 (CRUD Thành tích), W2-Q2 (Minh chứng số & Private Storage), W2-P3 (Dịch vụ Thông báo / notification service khi tích hợp).

---

## 1. Các file thay đổi & tạo mới

### CSDL & Migration:
- `supabase/migrations/20261005000016_w2_q3_submissions_and_verifications.sql`:
  - Khởi tạo bảng Snapshot lần nộp `app.achievement_submissions` (lưu trữ bản sao dữ liệu `snapshot_data JSONB`, số lần nộp `revision_no`, `submitted_by`, `submitted_at`, `submit_note`).
  - Khởi tạo bảng Đóng băng phiên bản tệp minh chứng `app.submission_evidence_files` (lưu trữ `file_id`, `version_no`, `original_file_name`, `storage_key`, `sha256_hash`, `file_size` tại thời điểm nộp).
  - Khởi tạo bảng Dòng thời gian lịch sử trạng thái `app.achievement_status_histories` (lưu vết `from_status`, `to_status`, `actor_id`, `submission_id`, `reason`).
  - Bổ sung cột người thẩm định `verified_by BIGINT REFERENCES app.users(user_id)` và thời điểm thẩm định `verified_at` vào bảng `app.achievements`.
  - Thực thi quy tắc bảo mật: `REVOKE ALL ON ALL TABLES IN SCHEMA app FROM anon, authenticated;` để bảo vệ CSDL. Đã migrate thành công lên live Supabase PostgreSQL.

### Backend (Node.js / Express):
- `backend/src/modules/achievements/achievementSchemas.js`: Định nghĩa các Zod Schemas kiểm tra ràng buộc đầu vào chặt chẽ: `submitAchievementSchema`, `verifyAchievementSchema`, `requestCorrectionSchema`, `rejectAchievementSchema`, `cancelAchievementSchema`, `revokeAchievementSchema`.
- `backend/src/modules/achievements/achievementRepository.js`:
  - Thêm phương thức `findAchievementForUpdate` (sử dụng khóa hàng `SELECT ... FOR UPDATE OF a` chống xung đột cạnh tranh).
  - Thêm các hàm nghiệp vụ CSDL: `getActiveEvidencesWithFiles`, `createSubmission`, `linkSubmissionEvidenceFiles`, `recordStatusHistory`, `updateAchievementStatus`, `listHistories`, `listSubmissions`.
  - Cập nhật `findAchievementById` hỗ trợ tham số `client` để đọc dữ liệu tức thì trong cùng một transaction chưa commit.
- `backend/src/modules/achievements/achievementService.js`:
  - Thực thi 6 luồng hành động workflow trong **cùng một pg client transaction** (`withTransaction`): Nộp hồ sơ (`submitAchievement`), Phê duyệt (`verifyAchievement`), Yêu cầu bổ sung (`requestCorrection`), Từ chối (`rejectAchievement`), Hủy nộp (`cancelSubmission`), và Thu hồi xác nhận (`revokeVerification`).
  - Tích hợp đồng thời: Cập nhật trạng thái + Ghi snapshot + Ghi lịch sử + Ghi kiểm toán (`recordAuditLog`) + Gửi thông báo tự động (`notifyStatusChanged` từ W2-P3).
  - Kiểm tra liêm chính **Cấm tự duyệt (Anti-Self-Approval)**: Nếu người duyệt là người tạo, người nộp, hoặc giảng viên chủ hồ sơ thì chặn ngay với mã HTTP 403 `SELF_APPROVAL_PROHIBITED`.
  - Kiểm soát đồng thời lạc quan (OCC): Kiểm tra `version`, `UPDATE WHERE version = $v`, tăng `version = version + 1`, trả về mã HTTP 409 `CONCURRENCY_CONFLICT` nếu xung đột.
- `backend/src/modules/achievements/achievementController.js` & `achievementRoutes.js`: Expose các RESTful endpoints `/submit`, `/verify`, `/request-correction`, `/reject`, `/cancel`, `/revoke`, `/history`, `/submissions`.
- `backend/src/modules/evidences/evidenceService.js`: Cập nhật cơ chế khóa bất biến: Khi hồ sơ ở trạng thái `VERIFIED`, toàn bộ thao tác tải lên, cập nhật phiên bản hoặc xóa minh chứng đều trả về mã lỗi HTTP 409 `ConflictError` (`ACHIEVEMENT_IMMUTABLE`).
- `backend/package.json`: Bổ sung npm script `test:w2-q3` và `test:w2-q3:integration`.

### Frontend (React / Vite / TailwindCSS):
- `frontend/src/services/achievementsApi.js`: Bổ sung các phương thức gọi API cho quy trình nộp, duyệt, từ chối, yêu cầu bổ sung, hủy nộp, thu hồi, lịch sử và snapshot lần nộp.
- `frontend/src/services/fixtureClient.js`: Cung cấp mock fixture client đồng bộ cho W2-Q3.
- `frontend/src/pages/Achievements.jsx`:
  - **Bộ chuyển Tab chuyên nghiệp**: "Tất cả hồ sơ" và "Hàng chờ thẩm định" (Hiển thị badge số lượng hồ sơ `SUBMITTED` đang chờ phê duyệt).
  - **Hệ thống nút Thao tác nhanh (Action Buttons)** trên từng dòng: Nộp hồ sơ, Thẩm định (Phê duyệt), Yêu cầu sửa đổi, Từ chối, Hủy nộp, Thu hồi, kèm icon Ổ khóa đối với hồ sơ đã `VERIFIED`.
  - **Modal Thao tác Nghiệp vụ**: Nhập ghi chú/lý do bắt buộc cho từng loại hành động, tự động gửi kèm số phiên bản `version` chống xung đột.
  - **Thông báo Cảnh báo Cấm Tự Duyệt**: Cảnh báo trực quan màu hổ phách/đỏ khi Quản lý mở hồ sơ của chính mình ("Theo quy chế liêm chính, bạn không được tự thẩm định hồ sơ do chính mình kê khai/đứng tên").
  - **Modal Chi tiết 3 Tab**:
    1. *Thông tin & Minh chứng*: Hiển thị huy hiệu Bất biến (Đã khóa) khi `VERIFIED`.
    2. *Lịch sử trạng thái*: Dòng thời gian (Timeline) chi tiết từng bước chuyển dịch trạng thái, người thực hiện, vai trò và lý do.
    3. *Các lần nộp (Snapshots)*: Hiển thị các bản sao đóng băng dữ liệu và danh sách tệp đính kèm tương ứng tại thời điểm nộp.

### Tests:
- `backend/tests/w2-q3.test.js`: 4 bài kiểm thử đơn vị:
  - Zod Schemas cho các hành động thẩm định.
  - Bắt buộc tối thiểu 1 tệp minh chứng khi nộp.
  - Cấm người kê khai/chủ sở hữu tự thẩm định hồ sơ của mình (Anti-Self-Approval).
  - Kiểm tra các ràng buộc trạng thái hồ sơ.
- `backend/tests/w2-q3.integration.js`: Kiểm thử tích hợp HTTP thực tế với Supabase PostgreSQL cloud theo 6 giai đoạn:
  1. Thiết lập tài khoản kiểm thử (Giảng viên An, Quản lý Bích, Quản lý Cường).
  2. Luồng cá nhân Giảng viên: Tạo -> Nộp có Snapshot -> Quản lý Thẩm định -> `status: VERIFIED`, `version: 3`, `verifiedBy: 2`.
  3. Kiểm tra tính Bất biến khi hồ sơ đã `VERIFIED`: Chặn sửa nội dung (409), chặn thêm minh chứng mới (409), chặn xóa minh chứng (409).
  4. Kiểm tra Cấm Tự Duyệt (Anti-Self-Approval): Trưởng khoa Bích tự tạo hồ sơ của chính mình rồi tự bấm duyệt -> Chặn ngay HTTP 403 `SELF_APPROVAL_PROHIBITED`.
  5. Kiểm tra Hai Request Cạnh Tranh (OCC Concurrency Conflict): Hai request duyệt song song gửi cùng `version = 2` -> Một request thành công (200), request còn lại trả về HTTP 409 `CONCURRENCY_CONFLICT`.
  6. Luồng Tập thể: Đại diện đơn vị tạo hồ sơ tập thể -> Tải minh chứng -> Nộp có Snapshot -> Quản lý Thẩm định thành công.

---

## 2. Kết quả kiểm tra thực tế

| Lệnh kiểm tra | Kết quả | Trạng thái |
| :--- | :--- | :--- |
| `node scripts/validate_contracts.mjs` | **68/68 PASS** (Kiểm tra tĩnh hợp đồng OpenAPI, DB schema, Business Rules) | **ĐẠT** |
| `npm --prefix backend run test:w2-q3` | **4/4 PASS** (Unit tests Zod schemas, Anti-Self-Approval, Status constraints) | **ĐẠT** |
| `npm --prefix backend run test:w2-q3:integration` | **6/6 Giai đoạn PASS** (Chạy trên live Supabase DB: Luồng cá nhân, Snapshot & Đóng băng file, Khóa VERIFIED 409, Cấm tự duyệt 403, Hai request cạnh tranh 409, Luồng tập thể) | **ĐẠT** |
| `npm --prefix backend run test:w2-q2` | **4/4 PASS** (Unit tests Minh chứng số & Private storage) | **ĐẠT** |
| `npm --prefix backend run test:w2-p3` | **2/2 PASS** (Unit tests Dịch vụ thông báo) | **ĐẠT** |
| `npm --prefix backend run test:w2-p2` | **4/4 PASS** (Unit tests Quản lý quyết định khen thưởng) | **ĐẠT** |
| `npm --prefix frontend run lint` | **0 errors, 0 warnings** | **ĐẠT** |
| `npm --prefix frontend run build` | **Vite build thành công (exit code 0)** | **ĐẠT** |

---

## 3. Tiêu chí nghiệm thu đã hoàn thành

1. **Submit đủ dữ liệu và ít nhất một file, snapshot nội dung/phiên bản file**: Đã hoàn thành và kiểm thử; chặn nộp nếu chưa có file (400), nộp thành công ghi snapshot vào `app.achievement_submissions` và đóng băng danh sách tệp vào `app.submission_evidence_files`.
2. **Làm hàng chờ và verify, cấm tự duyệt**: Đã xây dựng tab Hàng chờ thẩm định trên UI; kiểm tra scope quản lý CTE và cấm chủ hồ sơ / người tạo / người nộp tự duyệt (HTTP 403 `SELF_APPROVAL_PROHIBITED`).
3. **Cùng một pg client transaction ghi trạng thái / history / audit / notification**: Đã hoàn thành trong `achievementService.js` sử dụng `withTransaction`, bảo đảm tính nguyên tử hoàn đối với CSDL.
4. **UPDATE với id+version+status, tăng version và trả 409 nếu xung đột**: Đã cài đặt cơ chế khóa lạc quan OCC và kiểm thử thành công kịch bản 2 request cạnh tranh (1 request 200, request kia nhận 409 `CONCURRENCY_CONFLICT`).
5. **VERIFIED khóa sửa/file**: Khi hồ sơ đạt trạng thái `VERIFIED`, cả API cập nhật thành tích (`PUT /achievements/:id`) và API minh chứng (`POST /achievements/:id/evidences`, `DELETE /evidences/:id`) đều từ chối và trả về HTTP 409.
6. **Bàn giao không commit/push/merge trước khi được yêu cầu**: Tuân thủ tuyệt đối quy định; toàn bộ code được hoàn thiện trên nhánh `w2q3`, kiểm tra sạch sẽ và sẵn sàng commit khi có lệnh.

---

## 4. Hướng dẫn kiểm tra trên Giao diện (UI)

1. Khởi chạy hệ thống:
   - Backend: `npm --prefix backend run dev` (chạy trên cổng `5000`)
   - Frontend: `npm --prefix frontend run dev` (chạy trên cổng `5173`)
2. Đăng nhập với tài khoản Giảng viên (ví dụ: `gv_an` / `password123`):
   - Vào mục **Hồ sơ thành tích số**.
   - Bấm **Kê khai thành tích mới**, sau đó tải lên ít nhất 1 tệp minh chứng.
   - Bấm nút **Nộp hồ sơ** (`Gửi duyệt`). Hồ sơ chuyển sang trạng thái `Chờ thẩm định` (`SUBMITTED`).
3. Đăng nhập với tài khoản Trưởng khoa/Quản lý (ví dụ: `bich_cntt` / `password123`):
   - Chuyển sang tab **Hàng chờ thẩm định**.
   - Bấm **Thẩm định** để Phê duyệt hồ sơ (`VERIFIED`) hoặc **Yêu cầu bổ sung** (`NEED_CORRECTION`).
   - Nếu hồ sơ do chính Quản lý kê khai: Giao diện sẽ hiển thị cảnh báo cấm tự duyệt và vô hiệu hóa nút Duyệt.
4. Xem chi tiết hồ sơ:
   - Mở modal chi tiết, bấm tab **Lịch sử trạng thái** để xem dòng thời gian các bước duyệt.
   - Bấm tab **Các lần nộp (Snapshots)** để xem bản sao lưu dữ liệu và danh sách tệp minh chứng được đóng băng tại từng lần nộp.

---

## 5. Đề xuất Commit Message

```git
feat(achievements): [W2-Q3] Implement achievement submissions, snapshots, approval workflow with OCC, anti-self-approval and transaction integrity
```
*(Ghi chú: Nhánh `w2q3` chưa commit, chưa push, chưa merge; chờ lệnh tiếp theo từ người phụ trách).*
