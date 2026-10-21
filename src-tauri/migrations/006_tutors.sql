CREATE TABLE coding_challenges (id TEXT PRIMARY KEY NOT NULL,content TEXT NOT NULL,reference TEXT NOT NULL,hidden_tests TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE code_submissions (id TEXT PRIMARY KEY NOT NULL,challenge_id TEXT NOT NULL REFERENCES coding_challenges(id) ON DELETE RESTRICT,code TEXT NOT NULL CHECK(length(code)<=30000),submitted_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE evaluation_results (
 id TEXT PRIMARY KEY NOT NULL,
 english_submission_id TEXT REFERENCES english_submissions(id) ON DELETE CASCADE,
 code_submission_id TEXT REFERENCES code_submissions(id) ON DELETE CASCADE,
 source TEXT NOT NULL CHECK(source IN('static','self','openai','ollama')),
 feedback TEXT NOT NULL,created_at TEXT NOT NULL,
 CHECK((english_submission_id IS NULL) <> (code_submission_id IS NULL))
);
CREATE TABLE ai_usage_records (
 id TEXT PRIMARY KEY NOT NULL,provider TEXT NOT NULL CHECK(provider IN('openai','ollama')),model TEXT NOT NULL,task TEXT NOT NULL,
 input_tokens INTEGER,output_tokens INTEGER,cost_micros INTEGER,reserved_micros INTEGER NOT NULL,currency TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN('reserved','confirmed','unknown','invalid')),created_at TEXT NOT NULL
);
CREATE INDEX ai_month ON ai_usage_records(provider,created_at);
ALTER TABLE tasks ADD COLUMN checkpoint_id TEXT REFERENCES checkpoints(id) ON DELETE SET NULL;
CREATE TABLE topics (id TEXT PRIMARY KEY NOT NULL,title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),notes TEXT NOT NULL,area_id TEXT REFERENCES study_areas(id) ON DELETE SET NULL,updated_at TEXT NOT NULL);
CREATE TABLE resources (id TEXT PRIMARY KEY NOT NULL,title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),notes TEXT NOT NULL,url TEXT NOT NULL,topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL,archived INTEGER NOT NULL CHECK(archived IN(0,1)),updated_at TEXT NOT NULL);
