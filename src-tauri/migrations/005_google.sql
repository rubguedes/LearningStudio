CREATE TABLE sync_records (
 id TEXT PRIMARY KEY NOT NULL,
 account_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN('calendar_upsert','calendar_delete','gmail_send')),
 local_id TEXT NOT NULL,
 payload TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN('pending','sending','done','failed','uncertain','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TEXT NOT NULL,
 message TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX pending_sync_unique ON sync_records(account_id,kind,local_id) WHERE state IN('pending','sending');
CREATE TABLE google_events (
 account_id TEXT NOT NULL,
 local_id TEXT NOT NULL,
 event_id TEXT NOT NULL,
 deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN(0,1)),
 etag TEXT,
 PRIMARY KEY(account_id,local_id)
);
