-- ==============================================================================
-- W2-Q1: CRUD Thành tích Cá nhân & Tập thể xuyên suốt
-- Bổ sung các trường chuẩn hóa theo OpenAPI spec, ERD, Fixtures và Data Dictionary:
-- created_by, submitted_by, contribution_role, start_date, end_date, recognition_year, replaces_achievement_id
-- ==============================================================================

-- 1. Bổ sung các cột mới vào app.achievements
ALTER TABLE app.achievements
    ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES app.users(user_id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS submitted_by BIGINT REFERENCES app.users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS contribution_role VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS start_date DATE NULL,
    ADD COLUMN IF NOT EXISTS end_date DATE NULL,
    ADD COLUMN IF NOT EXISTS recognition_year INT NULL,
    ADD COLUMN IF NOT EXISTS replaces_achievement_id BIGINT REFERENCES app.achievements(achievement_id) ON DELETE SET NULL;

-- 2. Nới lỏng các trường legacy để tương thích với OpenAPI spec (tạo mới không bắt buộc criterion_id hay achievement_date)
ALTER TABLE app.achievements
    ALTER COLUMN criterion_id DROP NOT NULL,
    ALTER COLUMN achievement_date DROP NOT NULL;

-- 3. Điền giá trị mặc định cho dữ liệu thành tích hiện có (nếu có)
UPDATE app.achievements
SET recognition_year = EXTRACT(YEAR FROM achievement_date)
WHERE recognition_year IS NULL AND achievement_date IS NOT NULL;

UPDATE app.achievements
SET recognition_year = 2024
WHERE recognition_year IS NULL;

-- 4. Cập nhật ràng buộc Status bao gồm trạng thái NEED_CORRECTION và các trạng thái workflow
ALTER TABLE app.achievements
    DROP CONSTRAINT IF EXISTS ck_achievements_status;

ALTER TABLE app.achievements
    ADD CONSTRAINT ck_achievements_status CHECK (
        status IN ('DRAFT', 'SUBMITTED', 'NEED_CORRECTION', 'VERIFIED', 'REJECTED', 'CANCELLED', 'REVOKED', 'RETURNED')
    );

-- 5. Ràng buộc ngày tháng: Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu
ALTER TABLE app.achievements
    DROP CONSTRAINT IF EXISTS ck_achievements_dates;

ALTER TABLE app.achievements
    ADD CONSTRAINT ck_achievements_dates CHECK (
        end_date IS NULL OR start_date IS NULL OR end_date >= start_date
    );

-- 6. Ràng buộc năm ghi nhận: Năm hợp lệ >= 1990
ALTER TABLE app.achievements
    DROP CONSTRAINT IF EXISTS ck_achievements_recognition_year;

ALTER TABLE app.achievements
    ADD CONSTRAINT ck_achievements_recognition_year CHECK (
        recognition_year IS NULL OR recognition_year >= 1990
    );

-- 7. Tối ưu hóa chỉ mục cho tra cứu phân trang và lọc theo ContextUnitId, Status, Năm
CREATE INDEX IF NOT EXISTS idx_achievements_recognition_year ON app.achievements (recognition_year);
CREATE INDEX IF NOT EXISTS idx_achievements_created_by ON app.achievements (created_by);
CREATE INDEX IF NOT EXISTS idx_achievements_context_filter ON app.achievements (context_unit_id, status, recognition_year);
