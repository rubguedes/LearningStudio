CREATE TABLE roadmaps (
 id TEXT PRIMARY KEY NOT NULL,
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),
 description TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE roadmap_items (
 checkpoint_id TEXT PRIMARY KEY REFERENCES checkpoints(id) ON DELETE CASCADE,
 roadmap_id TEXT NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
 position INTEGER NOT NULL CHECK(position >= 0)
);
CREATE INDEX roadmap_order ON roadmap_items(roadmap_id,position,checkpoint_id);
CREATE TABLE english_lessons (
 id TEXT PRIMARY KEY NOT NULL,
 content TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE english_submissions (
 id TEXT PRIMARY KEY NOT NULL,
 lesson_id TEXT NOT NULL REFERENCES english_lessons(id) ON DELETE RESTRICT,
 writing TEXT NOT NULL CHECK(length(writing) <= 20000),
 answers TEXT NOT NULL,
 submitted_at TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE learning_reviews (
 submission_id TEXT PRIMARY KEY REFERENCES english_submissions(id) ON DELETE CASCADE,
 difficulties TEXT NOT NULL CHECK(length(difficulties) <= 4000),
 revised_writing TEXT NOT NULL CHECK(length(revised_writing) <= 20000),
 next_review TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE vocabulary_items (
 id TEXT PRIMARY KEY NOT NULL,
 term TEXT NOT NULL CHECK(length(trim(term)) BETWEEN 1 AND 120),
 meaning TEXT NOT NULL CHECK(length(trim(meaning)) BETWEEN 1 AND 1000),
 example TEXT NOT NULL CHECK(length(example) <= 2000),
 stage INTEGER NOT NULL DEFAULT 0 CHECK(stage BETWEEN 0 AND 5),
 due_date TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX vocabulary_term_unique ON vocabulary_items(lower(trim(term)));
CREATE TABLE vocabulary_reviews (
 id TEXT PRIMARY KEY NOT NULL,
 vocabulary_id TEXT NOT NULL REFERENCES vocabulary_items(id) ON DELETE CASCADE,
 remembered INTEGER NOT NULL CHECK(remembered IN (0,1)),
 reviewed_at TEXT NOT NULL
);
