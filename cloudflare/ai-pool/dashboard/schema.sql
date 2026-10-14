CREATE TABLE IF NOT EXISTS pool_cursors (
  provider TEXT PRIMARY KEY,
  cursor INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS key_states (
  provider TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0,
  until_ms INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (provider, key_hash)
);
