-- =============================================================================
-- Migration 009: Bổ sung các cột còn thiếu trong app.achievements
-- (Schema drift fix — W6-Q1)
-- =============================================================================
-- Lý do: Các cột verified_by, verified_at, submitted_at, version đã tồn tại
-- trên schema live Supabase và được tham chiếu trong achievementRepository.js
-- nhưng không có trong migrations DDL (001–008). Migration này bổ sung chúng
-- dưới dạng ADD COLUMN IF NOT EXISTS để an toàn khi chạy lại nhiều lần.
-- Áp dụng cho: PostgreSQL (Supabase) — schema app
-- Tác giả: Tạ Trần Vinh Quang (W6-Q1) — 09/10/2026
-- =============================================================================

-- 1. Cột verified_by: người xác nhận thành tích (BIGINT → FK → app.users)
ALTER TABLE app.achievements
  ADD COLUMN IF NOT EXISTS verified_by BIGINT NULL
    REFERENCES app.users(user_id) ON DELETE SET NULL;

COMMENT ON COLUMN app.achievements.verified_by
  IS 'ID người dùng xác nhận/duyệt thành tích; NULL nếu chưa xác nhận';

-- 2. Cột verified_at: thời điểm xác nhận
ALTER TABLE app.achievements
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN app.achievements.verified_at
  IS 'Thời điểm thành tích được xác nhận/duyệt';

-- 3. Cột submitted_at: thời điểm nộp (bổ sung trực tiếp trên bảng achievements
--    để tra cứu nhanh không cần JOIN sang achievement_submissions)
ALTER TABLE app.achievements
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN app.achievements.submitted_at
  IS 'Thời điểm nộp gần nhất; cập nhật khi chuyển sang trạng thái SUBMITTED';

-- 4. Cột version: optimistic concurrency control (OCC)
ALTER TABLE app.achievements
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN app.achievements.version
  IS 'Số phiên bản OCC — tăng 1 mỗi lần cập nhật trạng thái để phát hiện xung đột';

-- 5. Index hỗ trợ tra cứu theo verified_by
CREATE INDEX IF NOT EXISTS ix_achievements_verified_by
  ON app.achievements(verified_by)
  WHERE verified_by IS NOT NULL;

-- 6. Ghi nhận migration vào bảng tracking (nếu tồn tại)
INSERT INTO app._schema_migrations (version, description, applied_at)
VALUES ('009', 'add_missing_columns_to_achievements', NOW())
ON CONFLICT (version) DO NOTHING;
