-- migrations/0004_admin_tiers.sql
PRAGMA foreign_keys = ON;

-- Ensure users exists with tier metadata columns.
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  tier INTEGER NOT NULL DEFAULT 1,
  tier_granted_by TEXT,
  tier_granted_at TEXT,
  tier_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- For environments that already created users with a smaller schema.
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN tier INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN tier_granted_by TEXT;
ALTER TABLE users ADD COLUMN tier_granted_at TEXT;
ALTER TABLE users ADD COLUMN tier_note TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email);

CREATE TABLE IF NOT EXISTS tier_changes (
  change_id TEXT PRIMARY KEY,
  target_user_id TEXT NOT NULL,
  old_tier INTEGER NOT NULL,
  new_tier INTEGER NOT NULL,
  granted_by_user_id TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
