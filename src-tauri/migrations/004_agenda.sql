CREATE TABLE recurrences (
 id TEXT PRIMARY KEY NOT NULL,
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),
 notes TEXT NOT NULL,
 weekdays INTEGER NOT NULL CHECK(weekdays BETWEEN 1 AND 127),
 local_time TEXT NOT NULL,
 timezone TEXT NOT NULL,
 start_date TEXT NOT NULL,
 end_date TEXT,
 enabled INTEGER NOT NULL CHECK(enabled IN(0,1)),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE recurrence_occurrences (
 recurrence_id TEXT NOT NULL REFERENCES recurrences(id) ON DELETE CASCADE,
 occurrence_date TEXT NOT NULL,
 starts_at TEXT NOT NULL,
 task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
 PRIMARY KEY(recurrence_id,occurrence_date)
);
CREATE TABLE imported_chatgpt_tasks (
 id TEXT PRIMARY KEY NOT NULL,
 external_id TEXT NOT NULL UNIQUE,
 title TEXT NOT NULL,
 instructions TEXT NOT NULL,
 schedule TEXT NOT NULL,
 url TEXT NOT NULL,
 notes TEXT NOT NULL,
 imported_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 local_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
 converted_at TEXT
);
