# Tài liệu Kỹ thuật API Phân hệ Nộp hồ sơ & Thẩm định Thành tích (W2-Q3)

Phụ trách: **Tạ Trần Vinh Quang**  
Nhiệm vụ: **W2-Q3: Gửi và xác nhận có snapshot, lịch sử, transaction**  
Bối cảnh: Node.js / Express REST API `/api/v1`, Supabase PostgreSQL qua `pg` pool, giao dịch đơn `client` transaction, xác thực JWT & phân quyền vai trò/phạm vi tổ chức CTE.

---

## 1. Giới thiệu tổng quan

Phân hệ W2-Q3 cung cấp chu trình nghiệp vụ hoàn chỉnh cho việc nộp hồ sơ thành tích (cá nhân/tập thể) và thẩm định phê duyệt của Quản lý đơn vị với các yêu cầu bảo đảm:
1. **Kiểm tra minh chứng bắt buộc**: Hồ sơ chỉ được phép nộp (`SUBMITTED`) khi đã có ít nhất một tệp minh chứng hợp lệ (`app.evidences` & `app.evidence_files`).
2. **Snapshot nội dung & Đóng băng phiên bản tệp tin**: Lưu trữ bản sao dữ liệu tại thời điểm nộp vào `app.achievement_submissions` và lưu phiên bản tệp tin minh chứng tương ứng vào `app.submission_evidence_files`.
3. **Toàn vẹn giao dịch (Atomic Transaction)**: Thực hiện toàn bộ các thao tác (cập nhật trạng thái `status`, ghi lịch sử `app.achievement_status_histories`, ghi kiểm toán `recordAuditLog`, và gửi thông báo `notifyStatusChanged`) trong **cùng một transaction `pg` client**; bất kỳ bước nào thất bại sẽ rollback toàn bộ.
4. **Kiểm soát đồng thời lạc quan (Optimistic Concurrency Control - OCC)**: Yêu cầu truyền `version` trong request body. `UPDATE` dựa trên `id + version + status`, tự động tăng `version = version + 1`, trả về mã lỗi HTTP 409 `CONCURRENCY_CONFLICT` nếu phát hiện phiên làm việc khác đã can thiệp trước.
5. **Quy chế liêm chính Cấm tự duyệt (Anti-Self-Approval)**: Nghiêm cấm người tạo hồ sơ, người nộp hồ sơ, hoặc giảng viên chủ hồ sơ tự phê duyệt hồ sơ của chính mình. Trả về mã lỗi HTTP 403 `SELF_APPROVAL_PROHIBITED`.
6. **Tính bất biến khi đã xác nhận (Immutability on VERIFIED)**: Hồ sơ ở trạng thái `VERIFIED` sẽ bị khóa chỉnh sửa nội dung (`PUT/PATCH`) và khóa toàn bộ thao tác thêm, sửa phiên bản, hoặc xóa tệp minh chứng (trả về HTTP 409 `ConflictError`).

---

## 2. Danh sách Điểm cuối API (Endpoints)

Base Path: `/api/v1/achievements`

### 2.1. Nộp hồ sơ thành tích (Submit)
- **Method & Route**: `POST /api/v1/achievements/:id/submit`
- **Quyền truy cập**: Giảng viên chủ hồ sơ (với hồ sơ cá nhân) hoặc Đại diện đơn vị được ủy quyền còn hiệu lực (với hồ sơ tập thể).
- **Ràng buộc trạng thái**: Chỉ cho phép khi hồ sơ đang ở trạng thái `DRAFT` hoặc `NEED_CORRECTION`.
- **Ràng buộc minh chứng**: Hồ sơ phải có tối thiểu 1 danh mục minh chứng và 1 tệp tin đính kèm còn hiệu lực.
- **Request Body**:
```json
{
  "version": 1,
  "note": "Kính gửi Ban Giám hiệu và Trưởng khoa thẩm định hồ sơ bài báo Q1 năm học 2025-2026."
}
```
- **Xử lý Transaction**:
  1. Row-lock bản ghi thành tích bằng `SELECT ... FOR UPDATE OF a`.
  2. Kiểm tra `version` và `status` (OCC).
  3. Lấy dữ liệu minh chứng và danh sách tệp phiên bản mới nhất.
  4. Tạo bản ghi Snapshot trong `app.achievement_submissions` (tự động tính `revision_no = max + 1`).
  5. Tạo các bản ghi đóng băng phiên bản tệp trong `app.submission_evidence_files`.
  6. `UPDATE app.achievements SET status = 'SUBMITTED', version = version + 1, submitted_by = $userId, submitted_at = NOW()`.
  7. Ghi nhận lịch sử trạng thái vào `app.achievement_status_histories`.
  8. Ghi nhật ký kiểm toán `recordAuditLog` (`action: 'SUBMIT_ACHIEVEMENT'`).
  9. Gửi thông báo tự động `notifyStatusChanged` tới Quản lý phụ trách Context Unit.
- **Response**: HTTP 200 OK
```json
{
  "success": true,
  "message": "Nộp hồ sơ thành tích thành công và đã chuyển sang trạng thái chờ thẩm định",
  "data": {
    "achievementId": 17,
    "status": "SUBMITTED",
    "version": 2,
    "submittedBy": 1
  }
}
```

---

### 2.2. Thẩm định & Phê duyệt thành tích (Verify)
- **Method & Route**: `POST /api/v1/achievements/:id/verify`
- **Quyền truy cập**: Quản lý (`MANAGER`) phụ trách Context Unit (kiểm tra cây tổ chức CTE) hoặc `ADMIN` / `RECORDS_OFFICER`.
- **Ràng buộc liêm chính**: **Anti-Self-Approval**: Nếu `user.userId === achievement.createdBy` hoặc `user.userId === achievement.submittedBy` hoặc `user.userId === lecturer.userId`, hệ thống chặn ngay với mã HTTP 403 `SELF_APPROVAL_PROHIBITED`.
- **Ràng buộc trạng thái**: Chỉ áp dụng khi hồ sơ đang ở trạng thái `SUBMITTED`.
- **Request Body**:
```json
{
  "version": 2,
  "note": "Hồ sơ đạt tiêu chuẩn, minh chứng rõ ràng và đã kiểm tra trên Scopus."
}
```
- **Xử lý Transaction**:
  1. Row-lock `FOR UPDATE OF a`.
  2. Kiểm tra cấm tự duyệt (Anti-Self-Approval) -> HTTP 403 `SELF_APPROVAL_PROHIBITED`.
  3. Kiểm tra phạm vi quản lý CTE Scope -> HTTP 403 `OUT_OF_SCOPE`.
  4. Kiểm tra OCC `version` và `status === 'SUBMITTED'`.
  5. Cập nhật `status = 'VERIFIED'`, `version = version + 1`, `verified_by = $userId`, `verified_at = NOW()`.
  6. Ghi lịch sử trạng thái `app.achievement_status_histories` (`from: 'SUBMITTED'`, `to: 'VERIFIED'`).
  7. Ghi nhật ký kiểm toán `recordAuditLog` (`action: 'VERIFY_ACHIEVEMENT'`).
  8. Gửi thông báo `notifyStatusChanged` về cho người tạo và người nộp.
- **Response**: HTTP 200 OK
```json
{
  "success": true,
  "message": "Xác nhận thẩm định hồ sơ thành tích thành công",
  "data": {
    "achievementId": 17,
    "status": "VERIFIED",
    "version": 3,
    "verifiedBy": 2
  }
}
```

---

### 2.3. Yêu cầu bổ sung hồ sơ (Request Correction)
- **Method & Route**: `POST /api/v1/achievements/:id/request-correction`
- **Quyền truy cập**: Quản lý phụ trách Context Unit hoặc `ADMIN` / `RECORDS_OFFICER`.
- **Ràng buộc liêm chính**: Cấm tự duyệt / tự gửi yêu cầu cho chính hồ sơ của mình.
- **Ràng buộc dữ liệu**: `reason` (hoặc `note`) là **bắt buộc** (tối thiểu 5 ký tự).
- **Request Body**:
```json
{
  "version": 2,
  "reason": "Thiếu trang bìa kỷ yếu hội thảo quốc tế có chỉ số ISBN, vui lòng bổ sung minh chứng."
}
```
- **Kết quả**: `status` chuyển thành `NEED_CORRECTION`, `version` tăng thêm 1. Thông báo được gửi tới người nộp để chỉnh sửa và nộp lại.

---

### 2.4. Từ chối hồ sơ thành tích (Reject)
- **Method & Route**: `POST /api/v1/achievements/:id/reject`
- **Quyền truy cập**: Quản lý phụ trách Context Unit hoặc `ADMIN` / `RECORDS_OFFICER`.
- **Ràng buộc liêm chính**: Cấm tự duyệt đối với hồ sơ của chính mình.
- **Ràng buộc dữ liệu**: `reason` (hoặc `note`) là **bắt buộc** (tối thiểu 5 ký tự).
- **Request Body**:
```json
{
  "version": 2,
  "reason": "Bài báo không thuộc danh mục tạp chí khoa học được trường công nhận trong năm học này."
}
```
- **Kết quả**: `status` chuyển thành `REJECTED`, `version` tăng thêm 1. Hồ sơ bị đóng lại và thông báo được gửi đến người nộp.

---

### 2.5. Hủy nộp hồ sơ (Cancel Submission)
- **Method & Route**: `POST /api/v1/achievements/:id/cancel`
- **Quyền truy cập**: Chỉ người nộp (`submitted_by`), người tạo (`created_by`), hoặc giảng viên/đại diện chủ sở hữu hồ sơ.
- **Ràng buộc trạng thái**: Chỉ được phép hủy khi hồ sơ đang ở trạng thái `SUBMITTED` (chưa bị duyệt hoặc từ chối).
- **Request Body**:
```json
{
  "version": 2,
  "reason": "Phát hiện sai sót số liệu trong bài viết, xin rút lại để chỉnh sửa thêm."
}
```
- **Kết quả**: `status` quay về `DRAFT`, `version` tăng thêm 1, mở khóa cho phép tiếp tục chỉnh sửa nội dung và minh chứng.

---

### 2.6. Thu hồi xác nhận (Revoke Verification)
- **Method & Route**: `POST /api/v1/achievements/:id/revoke`
- **Quyền truy cập**: Chỉ dành cho Quản trị viên (`ADMIN`) hoặc Cán bộ văn thư thi đua (`RECORDS_OFFICER`).
- **Ràng buộc trạng thái**: Chỉ áp dụng khi hồ sơ đang ở trạng thái `VERIFIED`.
- **Request Body**:
```json
{
  "version": 3,
  "reason": "Phát hiện vi phạm liêm chính khoa học hoặc trùng lặp dữ liệu sau khi rà soát."
}
```
- **Kết quả**: `status` chuyển về `NEED_CORRECTION`, xóa thông tin xác nhận (`verified_by = NULL`, `verified_at = NULL`), tăng `version`, thông báo khẩn cấp tới các bên liên quan.

---

### 2.7. Lấy danh sách lịch sử trạng thái (Status History)
- **Method & Route**: `GET /api/v1/achievements/:id/history`
- **Response**: HTTP 200 OK
```json
{
  "success": true,
  "data": {
    "achievementId": 17,
    "histories": [
      {
        "historyId": 1,
        "submissionId": 1,
        "fromStatus": "DRAFT",
        "toStatus": "SUBMITTED",
        "actorId": 1,
        "actorFullName": "TS. Nguyễn Văn An",
        "actorRoleCode": "LECTURER",
        "reason": "Kính gửi thẩm định hồ sơ",
        "createdAt": "2026-10-05T16:51:09.198Z"
      },
      {
        "historyId": 2,
        "submissionId": null,
        "fromStatus": "SUBMITTED",
        "toStatus": "VERIFIED",
        "actorId": 2,
        "actorFullName": "PGS.TS. Trần Thị Bích",
        "actorRoleCode": "MANAGER",
        "reason": "Hồ sơ đạt tiêu chuẩn",
        "createdAt": "2026-10-05T16:51:13.037Z"
      }
    ]
  }
}
```

---

### 2.8. Lấy danh sách Snapshot các lần nộp (Submissions)
- **Method & Route**: `GET /api/v1/achievements/:id/submissions`
- **Response**: HTTP 200 OK
```json
{
  "success": true,
  "data": {
    "achievementId": 17,
    "submissions": [
      {
        "submissionId": 1,
        "revisionNo": 1,
        "submitNote": "Kính gửi thẩm định hồ sơ",
        "snapshotData": {
          "title": "Nghiên cứu ứng dụng AI trong chẩn đoán y tế",
          "subjectType": "LECTURER",
          "contributionRole": "Tác giả chính",
          "recognitionYear": 2026
        },
        "submittedAt": "2026-10-05T16:51:09.198Z",
        "submittedBy": {
          "userId": 1,
          "displayName": "TS. Nguyễn Văn An"
        },
        "evidenceFiles": [
          {
            "frozenFileId": 1,
            "evidenceId": 8,
            "evidenceTitle": "Bài báo toàn văn Scopus Q1",
            "fileId": 8,
            "versionNo": 1,
            "originalFileName": "Bai_bao_Q1_Y_te.pdf",
            "fileSize": 102400,
            "sha256Hash": "a1b2c3...",
            "storageKey": "evidences/2026/ach_17_ev_8_v1_...pdf"
          }
        ]
      }
    ]
  }
}
```

---

## 3. Khóa Bất biến Dữ liệu khi VERIFIED (Data Immutability)

Khi một hồ sơ thành tích đạt trạng thái `VERIFIED`:
1. `PUT /api/v1/achievements/:id`: Trả về `409 ConflictError` với mã lỗi `ACHIEVEMENT_IMMUTABLE`.
2. `POST /api/v1/achievements/:id/evidences`: Trả về `409 ConflictError` với mã lỗi `ACHIEVEMENT_IMMUTABLE`.
3. `POST /api/v1/evidences/:id/files`: Trả về `409 ConflictError` với mã lỗi `ACHIEVEMENT_IMMUTABLE`.
4. `DELETE /api/v1/evidences/:id`: Trả về `409 ConflictError` với mã lỗi `ACHIEVEMENT_IMMUTABLE`.
5. `DELETE /api/v1/achievements/:id`: Trả về `409 ConflictError` với mã lỗi `ACHIEVEMENT_NOT_DRAFT`.

---

## 4. Kiểm soát Đồng thời Lạc quan (OCC - Concurrency Handling)

Khi 2 người dùng (hoặc 2 request cạnh tranh) cùng thao tác thẩm định hoặc cập nhật trên cùng một phiên bản hồ sơ:
- Request 1 đến trước: `UPDATE` thành công với `version = v`, hệ thống tăng `version = v + 1`, trả về `200 OK`.
- Request 2 đến sau: Điều kiện `WHERE version = v` không còn khớp trong cơ sở dữ liệu (`rowCount === 0`), hệ thống lập tức rollback và ném ngoại lệ `ConcurrencyConflictError` -> trả về mã HTTP `409 Conflict` kèm thông điệp:
  `"Hồ sơ đã bị thay đổi bởi phiên làm việc khác. Vui lòng làm mới trang."`
