-- Laneway Backend Database Schema (SQLite)
-- This schema extends your existing database with tables needed for the Chrome extension

-- Meeting recordings
CREATE TABLE IF NOT EXISTS meeting_recordings (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    s3_key TEXT,
    storage_key TEXT,  -- R2/S3 storage key
    status TEXT DEFAULT 'uploading',  -- 'uploading', 'processing', 'completed', 'failed'
    duration INTEGER,
    file_size INTEGER,
    uploaded_at TEXT,
    processed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recordings_meeting_id ON meeting_recordings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_recordings_status ON meeting_recordings(status);

-- Meeting participants (enhanced from your existing table)
CREATE TABLE IF NOT EXISTS meeting_participants (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    employee_id TEXT,
    employee_name TEXT,
    employee_email TEXT,
    join_time TEXT,
    leave_time TEXT,
    camera_on_duration INTEGER DEFAULT 0,  -- in seconds
    speaking_duration INTEGER DEFAULT 0,   -- in seconds
    engagement_score REAL DEFAULT 0.0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_participants_meeting_id ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_participants_employee_id ON meeting_participants(employee_id);

-- Meeting absences
CREATE TABLE IF NOT EXISTS meeting_absences (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    employee_name TEXT,
    employee_email TEXT,
    department TEXT,
    reason TEXT NOT NULL,
    absence_type TEXT NOT NULL,  -- 'sick', 'vacation', 'conflict', 'emergency', 'other'
    expected_duration TEXT,      -- 'all_meeting', 'first_30min', 'joining_late'
    informed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    shown_in_meeting INTEGER DEFAULT 0  -- SQLite uses INTEGER for boolean
);

CREATE INDEX IF NOT EXISTS idx_absences_meeting_id ON meeting_absences(meeting_id);
CREATE INDEX IF NOT EXISTS idx_absences_employee_id ON meeting_absences(employee_id);

-- User authentication (if you don't already have an employees table)
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    department TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);

-- Meeting analytics snapshots (for real-time tracking)
CREATE TABLE IF NOT EXISTS meeting_analytics (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    data TEXT,  -- JSON stored as TEXT in SQLite
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_meeting_id ON meeting_analytics(meeting_id);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON meeting_analytics(timestamp);
