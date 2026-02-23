-- migrations/0001_init.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS roles (
  role_slug TEXT PRIMARY KEY,
  role_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS missions (
  mission_id TEXT PRIMARY KEY,
  role_slug TEXT NOT NULL,
  mission_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (role_slug) REFERENCES roles(role_slug)
);

CREATE TABLE IF NOT EXISTS mission_completions (
  completion_id TEXT PRIMARY KEY,
  role_slug TEXT NOT NULL,
  mission_id TEXT,
  town TEXT,
  notes TEXT,
  contact_count INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  user_hint TEXT,
  FOREIGN KEY (role_slug) REFERENCES roles(role_slug)
);

CREATE TABLE IF NOT EXISTS help_requests (
  help_id TEXT PRIMARY KEY,
  name TEXT,
  town TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  status TEXT NOT NULL DEFAULT 'new'
);
