CREATE TABLE app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

CREATE TABLE study_areas (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),
    description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 1000),
    color TEXT NOT NULL CHECK(color IN ('forest', 'blue', 'violet', 'amber', 'rose')),
    archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE tasks (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),
    notes TEXT NOT NULL DEFAULT '' CHECK(length(notes) <= 5000),
    area_id TEXT REFERENCES study_areas(id) ON DELETE SET NULL,
    priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high')),
    status TEXT NOT NULL CHECK(status IN ('todo', 'doing', 'done')),
    due_date TEXT,
    estimate_minutes INTEGER CHECK(estimate_minutes BETWEEN 1 AND 1440),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    CHECK((status = 'done' AND completed_at IS NOT NULL) OR (status <> 'done' AND completed_at IS NULL))
);
CREATE INDEX tasks_due_status ON tasks(status, due_date);
CREATE INDEX tasks_area ON tasks(area_id);
