ALTER TABLE app.achievements ADD deleted_at DATETIME2(3) NULL, deleted_by BIGINT NULL;
GO
ALTER TABLE app.achievements ADD CONSTRAINT fk_achievements_deleted_by FOREIGN KEY (deleted_by) REFERENCES app.users(user_id);
CREATE INDEX idx_achievements_deleted_at ON app.achievements(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE TABLE app.achievement_trash_file_cleanup (storage_key NVARCHAR(450) PRIMARY KEY);
