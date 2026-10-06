# W2-Q4 — Review Module Quyết định và Ghi nhận Khen thưởng (W2-P2)

- **Người thực hiện review**: Tạ Trần Vinh Quang (Phụ trách W2-Q4: Test vượt quyền và review khen thưởng)
- **Tác giả module**: Võ Nhạc Phước (Phụ trách W2-P2: Quyết định khen thưởng và AwardRecord)
- **Baseline đối chiếu**: Commit `53167d8` (W2-P2), `41b5577` (W3-P2/HEAD)
- **Trạng thái đánh giá**: **APPROVED (CHẤP THUẬN NGHIỆM THU)**

---

## 1. Mục tiêu và Tiêu chí Đánh giá Nghiệp vụ

Trong kiến trúc hệ thống quản lý khen thưởng nghiên cứu khoa học và thi đua LHU:
1. **Nguyên tắc tách biệt chức năng (Separation of Concerns)**:
   - Hồ sơ thành tích (`app.achievements`) là kê khai, nộp minh chứng và thẩm định chuyên môn (do Giảng viên kê khai, Trưởng khoa/Manager thẩm định thành `VERIFIED`).
   - Khen thưởng (`app.award_records`) là quyết định hành chính có tính pháp lý (do Hội đồng thi đua khen thưởng/Hiệu trưởng ban hành qua Quyết định chính thức).
   - **TIÊU CHÍ TIÊN QUYẾT**: Thành tích đạt trạng thái `VERIFIED` **tuyệt đối không được tự động phát sinh** bản ghi khen thưởng `AwardRecord`.
2. **Quyền hạn và Tính toàn vẹn**:
   - Chỉ người giữ vai trò `RECORDS_OFFICER` còn hiệu lực và thuộc đúng phạm vi đơn vị (`isUnitInUserScope`) mới có quyền tạo và ghi nhận (`RECORDED`) quyết định khen thưởng.
   - Không cho phép `ADMIN` bypass scope quản trị đơn vị nếu không có phân công cụ thể.
   - Bắt buộc phải có tệp đính kèm quyết định (bản scan có dấu/chữ ký số) trên Private Storage trước khi chuyển trạng thái sang `RECORDED`.

---

## 2. Kết quả Phân tích Chi tiết Module W2-P2

### 2.1. Phân định Chủ thể và Ràng buộc CSDL (XOR Constraint)
- Mã nguồn tại [awardService.js](file:///c:/DriveD/EverythingElse/LHU/PTUD_PhatTrienUngDung/backend/src/modules/awards/awardService.js) và Migration `20261005000014_w2_p2_award_decisions.sql`:
  - Thiết kế cấu trúc `app.award_records` tuân thủ nghiêm ngặt điều kiện XOR giữa Cá nhân (`user_id`) và Tập thể (`unit_id`):
    ```sql
    CONSTRAINT chk_award_recipient CHECK (
      (recipient_type = 'INDIVIDUAL' AND user_id IS NOT NULL AND unit_id IS NULL) OR
      (recipient_type = 'COLLECTIVE' AND unit_id IS NOT NULL AND user_id IS NULL)
    )
    ```
  - Partial Unique Index ngăn chặn trùng lặp cùng chủ thể nhận thưởng trên một số quyết định khi trạng thái là `RECORDED`:
    ```sql
    CREATE UNIQUE INDEX uq_award_record_individual_active 
      ON app.award_records (decision_number, user_id, award_category_id)
      WHERE status = 'RECORDED';
    CREATE UNIQUE INDEX uq_award_record_collective_active 
      ON app.award_records (decision_number, unit_id, award_category_id)
      WHERE status = 'RECORDED';
    ```
  - **Đánh giá**: Thiết kế rất chặt chẽ, ngăn chặn việc tạo trùng khen thưởng trong cùng một quyết định ở cấp cơ sở dữ liệu.

### 2.2. Kiểm soát Quyền hạn (Scope & Role Authorization)
- `AwardService` xác thực vai trò bằng cách truy vấn quyền hiện hành từ cơ sở dữ liệu thông qua `getActiveRoles(client, userId)` và kiểm tra phạm vi đơn vị bằng `isUnitInUserScope(client, userId, unitId)`.
- Không tin cậy mù quáng vào claim `roles` từ JWT token cũ, bảo đảm khi một nhân sự bị thu hồi vai trò `RECORDS_OFFICER` hoặc chuyển đơn vị, họ sẽ bị chặn ngay lập tức (HTTP 403 `FORBIDDEN`).
- Không cho phép `ADMIN` tự ý ghi nhận quyết định ngoài phạm vi nếu không có vai trò `RECORDS_OFFICER`.

### 2.3. Bắt buộc Tệp Minh chứng Quyết định (Preflight File Check)
- Khi gọi `recordAwardDecision`, hệ thống kiểm tra:
  ```javascript
  if (!decision.decisionFileId) {
    throw new ValidationError('A signed decision file must be uploaded before recording');
  }
  ```
- Tệp quyết định được lưu trữ trong Private Storage, chỉ có thể tải về thông qua endpoint được kiểm soát quyền, ngăn chặn triệt để nguy cơ lộ lọt quyết định qua URL tĩnh.

### 2.4. Xác nhận Nghiệp vụ: VERIFIED không tự sinh AwardRecord
- Kiểm tra toàn bộ mã nguồn của [achievementService.js](file:///c:/DriveD/EverythingElse/LHU/PTUD_PhatTrienUngDung/backend/src/modules/achievements/achievementService.js):
  - Hàm `verifyAchievement` chỉ thực hiện:
    1. Kiểm tra quyền Manager đúng scope và không tự duyệt.
    2. Cập nhật trạng thái thành tích thành `VERIFIED`.
    3. Ghi vết vào `app.achievement_status_histories`.
    4. Ghi kiểm toán `recordAuditLog`.
    5. Gửi thông báo `NOTIFY_ACHIEVEMENT_VERIFIED`.
  - **Hoàn toàn không có lệnh `INSERT INTO app.award_records`**.
- Đã được chứng minh bằng thực nghiệm trong bộ test tích hợp [w2-q4.integration.js](file:///c:/DriveD/EverythingElse/LHU/PTUD_PhatTrienUngDung/backend/tests/w2-q4.integration.js) (Test Case 6): Sau khi duyệt hồ sơ thành tích #1001 lên `VERIFIED`, truy vấn trực tiếp bảng `app.award_records` cho kết quả chính xác 0 bản ghi (`recordsCount === 0`).

---

## 3. Tổng hợp Kết quả Kiểm thử Tương thích (Compatibility Testing)

| Bài kiểm tra | Mô tả | Kết quả |
|---|---|---|
| `test:w2-p2` | Unit tests cho Award Decision & AwardRecord | **4/4 PASS** |
| `test:w2-p2:integration` | Kiểm thử tích hợp thật trên PostgreSQL Supabase | **27/27 Assertions PASS** |
| `test:w2-q4:integration` (Test 6) | Kiểm tra độc lập tách biệt giữa VERIFIED và AwardRecord | **ĐẠT (Không có bản ghi ngầm)** |
| File Download Security | Quyền tải tệp quyết định qua URL private | **ĐẠT (Chặn triệt để ngoài scope)** |

---

## 4. Kết luận & Đề xuất

1. **Kết luận**: Module W2-P2 của Võ Nhạc Phước đáp ứng hoàn toàn các tiêu chuẩn kỹ thuật, bảo mật và nghiệp vụ khen thưởng của dự án PTUD_PhatTrienUngDung. Thiết kế tuân thủ nguyên tắc fail-closed, kiểm soát đồng thời OCC, và tích hợp hài hòa với hệ thống Private Storage.
2. **Khuyến nghị cho giai đoạn tiếp theo (Week 3 - Hội đồng)**:
   - Khi triển khai màn hình Hội đồng xét duyệt khen thưởng (W3), liên kết giữa Thành tích (`achievement_id`) và Quyết định khen thưởng (`award_records.achievement_id`) nên được duy trì ở dạng quan hệ tham chiếu tùy chọn (optional reference), cho phép ghi nhận cả các quyết định khen thưởng đột xuất hoặc chuyên đề không xuất phát từ hồ sơ kê khai trực tuyến.
