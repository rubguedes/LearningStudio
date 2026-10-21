CREATE TABLE study_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),
    notes TEXT NOT NULL DEFAULT '' CHECK(length(notes) <= 5000),
    area_id TEXT REFERENCES study_areas(id) ON DELETE SET NULL,
    study_date TEXT NOT NULL,
    mode TEXT NOT NULL CHECK(mode IN ('manual','timer')),
    status TEXT NOT NULL CHECK(status IN ('running','paused','completed')),
    duration_seconds INTEGER NOT NULL CHECK(duration_seconds BETWEEN 0 AND 86400),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    CHECK((status='completed' AND completed_at IS NOT NULL AND duration_seconds>0) OR (status<>'completed' AND completed_at IS NULL)),
    CHECK(mode='timer' OR status='completed')
);
CREATE UNIQUE INDEX one_running_session ON study_sessions(status) WHERE status='running';
CREATE INDEX sessions_date ON study_sessions(study_date,status);

CREATE TABLE goals (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),
    area_id TEXT REFERENCES study_areas(id) ON DELETE RESTRICT,
    mode TEXT NOT NULL CHECK(mode IN ('manual','study_minutes','task_count')),
    unit TEXT NOT NULL CHECK(length(trim(unit)) BETWEEN 1 AND 40),
    target INTEGER NOT NULL CHECK(target BETWEEN 1 AND 1000000),
    manual_value INTEGER NOT NULL DEFAULT 0 CHECK(manual_value BETWEEN 0 AND 1000000000),
    start_date TEXT NOT NULL,
    due_date TEXT NOT NULL CHECK(due_date>=start_date),
    archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK(mode='manual' OR manual_value=0)
);

CREATE TABLE checkpoints (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),
    description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=2000),
    activity TEXT NOT NULL CHECK(length(trim(activity)) BETWEEN 1 AND 2000),
    criteria TEXT NOT NULL CHECK(length(trim(criteria)) BETWEEN 1 AND 2000),
    area_id TEXT REFERENCES study_areas(id) ON DELETE SET NULL,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE checkpoint_evidence (
    id TEXT PRIMARY KEY NOT NULL,
    checkpoint_id TEXT NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK(length(trim(content)) BETWEEN 1 AND 4000),
    created_at TEXT NOT NULL
);
CREATE INDEX evidence_checkpoint ON checkpoint_evidence(checkpoint_id,created_at);
