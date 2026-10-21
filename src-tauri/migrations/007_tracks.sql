CREATE TABLE language_profiles (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL CHECK(json_valid(content)),
    updated_at TEXT NOT NULL
);
CREATE TABLE track_documents (
    id TEXT PRIMARY KEY,
    profile_id TEXT REFERENCES language_profiles(id) ON DELETE RESTRICT,
    kind TEXT NOT NULL CHECK(kind IN ('plan','career','career_preferences','resume','resume_proposal','job','source','github')),
    content TEXT NOT NULL CHECK(json_valid(content)),
    created_at TEXT NOT NULL
);
CREATE TABLE practice_errors (
    id TEXT PRIMARY KEY,
    evaluation_id TEXT REFERENCES evaluation_results(id) ON DELETE RESTRICT,
    topic TEXT NOT NULL,
    category TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    correction TEXT NOT NULL,
    explanation TEXT NOT NULL,
    severity INTEGER NOT NULL CHECK(severity BETWEEN 1 AND 3),
    classification TEXT NOT NULL CHECK(classification IN ('unconfirmed','error','style','dismissed')),
    created_at TEXT NOT NULL,
    UNIQUE(evaluation_id,category,excerpt)
);
CREATE TABLE practice_reviews (
    id TEXT PRIMARY KEY,
    error_id TEXT NOT NULL REFERENCES practice_errors(id) ON DELETE RESTRICT,
    answer TEXT NOT NULL,
    recalled INTEGER NOT NULL CHECK(recalled IN (0,1)),
    reviewed_date TEXT NOT NULL,
    next_review TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(error_id,reviewed_date)
);
CREATE TABLE lesson_pdfs (
    id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL REFERENCES english_lessons(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    base64 TEXT NOT NULL,
    transcription TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE TABLE pdf_reviews (
    id TEXT PRIMARY KEY,
    pdf_id TEXT NOT NULL REFERENCES lesson_pdfs(id) ON DELETE RESTRICT,
    transcription TEXT NOT NULL,
    feedback TEXT NOT NULL CHECK(json_valid(feedback)),
    created_at TEXT NOT NULL
);
