"""Verifica o SQL real, sem substituir os testes do serviço Rust."""
from pathlib import Path
import sqlite3
import unittest

MIGRATION = (Path(__file__).resolve().parents[1] / "src-tauri/migrations/001_foundation.sql").read_text(encoding="utf-8")
PROGRESS_MIGRATION = (Path(__file__).resolve().parents[1] / "src-tauri/migrations/002_study_progress.sql").read_text(encoding="utf-8")
STAMP = "2026-10-19T12:00:00Z"


class FoundationSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.executescript(MIGRATION)

    def tearDown(self):
        self.db.close()

    def area(self, identifier="area-1"):
        self.db.execute("INSERT INTO study_areas(id,name,color,created_at,updated_at) VALUES (?,?,?,?,?)", (identifier, "Python", "forest", STAMP, STAMP))
        self.db.commit()

    def task(self, identifier="task-1", area_id=None, status="todo", completed_at=None):
        self.db.execute("INSERT INTO tasks(id,title,area_id,priority,status,created_at,updated_at,completed_at) VALUES (?,?,?,?,?,?,?,?)", (identifier, "Praticar", area_id, "high", status, STAMP, STAMP, completed_at))
        self.db.commit()

    def test_delete_area_preserves_tasks(self):
        self.area()
        self.task(area_id="area-1")
        self.db.execute("DELETE FROM study_areas WHERE id=?", ("area-1",))
        self.assertEqual(self.db.execute("SELECT id,area_id FROM tasks").fetchall(), [("task-1", None)])

    def test_foreign_key_rejects_missing_area(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.task(area_id="missing")

    def test_duplicate_ids_are_rejected(self):
        self.task()
        with self.assertRaises(sqlite3.IntegrityError):
            self.task()
        self.assertEqual(self.db.execute("SELECT count(*) FROM tasks").fetchone()[0], 1)

    def test_completion_requires_timestamp(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.task(status="done")
        self.db.rollback()
        self.task(status="done", completed_at=STAMP)
        self.assertEqual(self.db.execute("SELECT completed_at FROM tasks").fetchone()[0], STAMP)

    def test_open_task_cannot_have_completion_timestamp(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.task(completed_at=STAMP)

    def test_invalid_priority_and_duration_are_rejected(self):
        self.task()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE tasks SET priority='urgent'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE tasks SET estimate_minutes=0")
        self.assertEqual(self.db.execute("SELECT priority FROM tasks").fetchone()[0], "high")

    def test_transaction_rolls_back_related_changes(self):
        with self.assertRaises(sqlite3.IntegrityError):
            with self.db:
                self.db.execute("INSERT INTO study_areas VALUES (?,?,?,?,?,?,?)", ("new", "IA", "", "blue", 0, STAMP, STAMP))
                self.db.execute("INSERT INTO tasks(id,title,priority,status,created_at,updated_at) VALUES (?,?,?,?,?,?)", ("invalid", "", "high", "todo", STAMP, STAMP))
        self.assertEqual(self.db.execute("SELECT count(*) FROM study_areas").fetchone()[0], 0)

    def test_no_tables_for_unimplemented_epics(self):
        tables = {row[0] for row in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        self.assertEqual(tables, {"app_settings", "study_areas", "tasks"})


class ProgressSchemaTests(FoundationSchemaTests):
    def setUp(self):
        super().setUp()
        self.db.executescript(PROGRESS_MIGRATION)

    def test_no_tables_for_unimplemented_epics(self):
        tables = {row[0] for row in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        self.assertEqual(tables, {"app_settings", "study_areas", "tasks", "study_sessions", "goals", "checkpoints", "checkpoint_evidence"})

    def session(self, identifier="session-1", status="completed", seconds=60, mode="manual", area_id=None):
        self.db.execute("INSERT INTO study_sessions(id,title,area_id,study_date,mode,status,duration_seconds,created_at,updated_at,completed_at) VALUES (?,?,?,?,?,?,?,?,?,?)", (identifier,"Praticar SQL",area_id,"2026-10-19",mode,status,seconds,STAMP,STAMP,STAMP if status=="completed" else None))
        self.db.commit()

    def checkpoint(self):
        self.db.execute("INSERT INTO checkpoints(id,title,activity,criteria,created_at,updated_at) VALUES (?,?,?,?,?,?)", ("checkpoint-1","API","Implementar endpoint","Testes aprovados",STAMP,STAMP))
        self.db.commit()

    def test_migration_preserves_epic1_rows(self):
        legacy = sqlite3.connect(":memory:")
        try:
            legacy.executescript(MIGRATION)
            legacy.execute("INSERT INTO app_settings VALUES (?,?)", ("password_hash","hash-fixture"))
            legacy.execute("INSERT INTO tasks(id,title,priority,status,created_at,updated_at) VALUES (?,?,?,?,?,?)", ("old-task","Estudar","high","todo",STAMP,STAMP))
            legacy.commit()
            legacy.executescript(PROGRESS_MIGRATION)
            self.assertEqual(legacy.execute("SELECT id,title FROM tasks").fetchall(), [("old-task","Estudar")])
            self.assertEqual(legacy.execute("SELECT value FROM app_settings").fetchone()[0], "hash-fixture")
        finally:
            legacy.close()

    def test_only_one_running_session(self):
        self.session(status="running", seconds=0, mode="timer")
        with self.assertRaises(sqlite3.IntegrityError):
            self.session("second", status="running", seconds=0, mode="timer")

    def test_incomplete_or_invalid_duration_rejected(self):
        for seconds in (0, -1, 86401):
            with self.subTest(seconds=seconds):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.session(seconds=seconds)
                self.db.rollback()

    def test_automatic_goal_cannot_claim_manual_progress(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO goals(id,title,mode,unit,target,manual_value,start_date,due_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)", ("g1","Estudar","study_minutes","minutos",60,10,"2026-10-19","2026-10-25",STAMP,STAMP))

    def test_area_cannot_be_deleted_and_broaden_goal_scope(self):
        self.area()
        self.db.execute("INSERT INTO goals(id,title,area_id,mode,unit,target,start_date,due_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)", ("g1","Estudar","area-1","study_minutes","minutos",60,"2026-10-19","2026-10-25",STAMP,STAMP))
        self.db.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM study_areas WHERE id='area-1'")
        self.assertEqual(self.db.execute("SELECT area_id FROM goals").fetchone()[0], "area-1")

    def test_evidence_and_completion_are_atomic(self):
        self.checkpoint()
        with self.assertRaises(sqlite3.IntegrityError):
            with self.db:
                self.db.execute("INSERT INTO checkpoint_evidence VALUES (?,?,?,?)", ("e1","checkpoint-1","Projeto local",STAMP))
                self.db.execute("UPDATE checkpoints SET criteria='' WHERE id='checkpoint-1'")
        self.assertEqual(self.db.execute("SELECT count(*) FROM checkpoint_evidence").fetchone()[0], 0)
        self.assertIsNone(self.db.execute("SELECT completed_at FROM checkpoints").fetchone()[0])

    def test_evidence_cascade_on_explicit_checkpoint_deletion(self):
        self.checkpoint()
        self.db.execute("INSERT INTO checkpoint_evidence VALUES (?,?,?,?)", ("e1","checkpoint-1","Projeto local",STAMP))
        self.db.execute("DELETE FROM checkpoints WHERE id='checkpoint-1'")
        self.assertEqual(self.db.execute("SELECT count(*) FROM checkpoint_evidence").fetchone()[0], 0)

    def test_area_deletion_keeps_session_duration(self):
        self.area()
        self.session(area_id="area-1")
        self.db.execute("DELETE FROM study_areas WHERE id='area-1'")
        self.assertEqual(self.db.execute("SELECT area_id,duration_seconds FROM study_sessions").fetchall(), [(None,60)])


if __name__ == "__main__":
    unittest.main(verbosity=2)
