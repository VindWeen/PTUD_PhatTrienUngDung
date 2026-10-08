-- W5-P1: deterministic page order on equal timestamps; measured on 5,000 synthetic rows.
-- Ordering probe: Sort 3.268ms -> Index Only Scan 0.092ms (not HTTP p95).
CREATE INDEX IF NOT EXISTS idx_achievements_updated_id
 ON app.achievements(updated_at DESC, achievement_id DESC);
