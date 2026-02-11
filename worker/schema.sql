-- D1 schema for Laneway analytics
-- Run: npx wrangler@latest d1 execute laneway-analytics --remote --file=worker/schema.sql

CREATE TABLE IF NOT EXISTS meeting_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_meeting_id ON meeting_analytics(meeting_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON meeting_analytics(created_at);
