CREATE TABLE app.lecturer_cvs (
  lecturer_id BIGINT PRIMARY KEY REFERENCES app.lecturers(lecturer_id) ON DELETE CASCADE,
  public_id VARCHAR(32) NOT NULL UNIQUE,
  draft JSONB NOT NULL DEFAULT '{}'::jsonb,
  published JSONB,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE app.lecturer_cvs ENABLE ROW LEVEL SECURITY;
