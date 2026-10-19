-- Personal calendar uses Vietnam wall-clock time, independent of database timezone.
CREATE TABLE app.personal_calendar_events (
  event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app.users(user_id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  location VARCHAR(500) NOT NULL DEFAULT '',
  category VARCHAR(20) NOT NULL CHECK (category IN ('exam','competition','task','personal')),
  starts_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITHOUT TIME ZONE NOT NULL CHECK (ends_at >= starts_at),
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX personal_calendar_owner_date ON app.personal_calendar_events(user_id, starts_at);
ALTER TABLE app.personal_calendar_events ENABLE ROW LEVEL SECURITY;
-- Access is through the authenticated Express API; no anon/authenticated Supabase access.
REVOKE ALL ON app.personal_calendar_events FROM anon, authenticated;
