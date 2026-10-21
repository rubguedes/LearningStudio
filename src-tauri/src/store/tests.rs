use super::*;

pub(super) fn password() -> Zeroizing<String> {
    Zeroizing::new("uma senha de teste segura".to_string())
}
fn area_input() -> AreaInput {
    AreaInput {
        id: None,
        name: " Python ".into(),
        description: "Fundamentos".into(),
        color: "forest".into(),
    }
}
pub(super) fn task_input(area_id: Option<String>) -> TaskInput {
    TaskInput {
        checkpoint_id: None,
        id: None,
        title: "Praticar funções".into(),
        notes: "Exercício offline".into(),
        area_id,
        priority: "high".into(),
        status: "todo".into(),
        due_date: Some("2026-10-19".into()),
        estimate_minutes: Some(25),
    }
}
pub(super) fn store() -> Store {
    let mut store = Store::open(Path::new(":memory:")).unwrap();
    store.setup_password(password()).unwrap();
    store
}

#[test]
fn onboarding_authentication_and_command_guard() {
    let mut s = Store::open(Path::new(":memory:")).unwrap();
    assert!(!s.auth_status().unwrap().configured);
    assert_eq!(s.snapshot().unwrap_err().code, "LOCKED");
    assert!(s.setup_password(Zeroizing::new("short".into())).is_err());
    s.setup_password(password()).unwrap();
    let hash = s.password_hash().unwrap().unwrap();
    assert!(hash.starts_with("$argon2id$"));
    assert!(!hash.contains("uma senha"));
    assert_eq!(
        s.setup_password(password()).unwrap_err().code,
        "ALREADY_CONFIGURED"
    );
    s.lock().unwrap();
    assert!(s.save_area(area_input()).is_err());
    assert!(s.save_task(task_input(None)).is_err());
    assert!(s.delete_task(uuid::Uuid::new_v4().to_string()).is_err());
    assert!(s.delete_area(uuid::Uuid::new_v4().to_string()).is_err());
    assert!(s
        .archive_area(uuid::Uuid::new_v4().to_string(), true)
        .is_err());
    assert_eq!(
        s.unlock(Zeroizing::new("errada".into())).unwrap_err().code,
        "INVALID_PASSWORD"
    );
    s.unlock(password()).unwrap();
    assert!(s.auth_status().unwrap().unlocked);
}

#[test]
fn random_salts_and_rate_limit() {
    let mut a = store();
    let b = store();
    assert_ne!(a.password_hash().unwrap(), b.password_hash().unwrap());
    a.lock().unwrap();
    for _ in 0..5 {
        assert!(a.unlock(Zeroizing::new("wrong".into())).is_err());
    }
    assert_eq!(a.unlock(password()).unwrap_err().code, "RATE_LIMIT");
    a.retry_after = Some(Instant::now() - Duration::from_secs(1));
    a.unlock(password()).unwrap();
}

#[test]
fn idle_session_expires_on_backend() {
    let mut s = store();
    s.authenticated_at = Some(Instant::now() - IDLE_TIMEOUT - Duration::from_secs(1));
    assert!(!s.auth_status().unwrap().unlocked);
    assert_eq!(s.snapshot().unwrap_err().code, "LOCKED");
}

#[test]
fn crud_and_completion_timestamps() {
    let mut s = store();
    s.save_area(area_input()).unwrap();
    let area = s.snapshot().unwrap().areas.remove(0);
    assert_eq!(area.name, "Python");
    let mut input = task_input(Some(area.id.clone()));
    s.save_task(input.clone()).unwrap();
    let task = s.snapshot().unwrap().tasks.remove(0);
    input.id = Some(task.id.clone());
    input.status = "done".into();
    s.save_task(input.clone()).unwrap();
    let completed = s.snapshot().unwrap().tasks.remove(0);
    assert!(completed.completed_at.is_some());
    s.save_task(input.clone()).unwrap();
    assert_eq!(
        s.snapshot().unwrap().tasks[0].completed_at,
        completed.completed_at
    );
    input.status = "doing".into();
    s.save_task(input).unwrap();
    assert!(s.snapshot().unwrap().tasks[0].completed_at.is_none());
    s.delete_area(area.id).unwrap();
    assert!(s.snapshot().unwrap().tasks[0].area_id.is_none());
    s.delete_task(task.id).unwrap();
    assert!(s.snapshot().unwrap().tasks.is_empty());
}

#[test]
fn invalid_inputs_and_foreign_keys_preserve_data() {
    let mut s = store();
    let mut invalid = task_input(None);
    invalid.due_date = Some("2026-02-30".into());
    assert!(s.save_task(invalid).is_err());
    let mut invalid = task_input(None);
    invalid.estimate_minutes = Some(0);
    assert!(s.save_task(invalid).is_err());
    assert!(s
        .save_task(task_input(Some(uuid::Uuid::new_v4().to_string())))
        .is_err());
    let mut invalid = area_input();
    invalid.name = " ".into();
    assert!(s.save_area(invalid).is_err());
    assert!(s.snapshot().unwrap().tasks.is_empty());
    s.save_area(area_input()).unwrap();
    let id = s.snapshot().unwrap().areas[0].id.clone();
    s.archive_area(id.clone(), true).unwrap();
    assert!(s.save_task(task_input(Some(id.clone()))).is_err());
    s.archive_area(id.clone(), false).unwrap();
    s.save_task(task_input(Some(id))).unwrap();
    assert_eq!(s.snapshot().unwrap().tasks.len(), 1);
}

#[test]
fn missing_update_does_not_create_and_sql_is_parameterized() {
    let mut s = store();
    let mut input = area_input();
    input.id = Some(uuid::Uuid::new_v4().to_string());
    assert_eq!(s.save_area(input).unwrap_err().code, "NOT_FOUND");
    let mut input = task_input(None);
    input.title = "'); DROP TABLE tasks; --".into();
    s.save_task(input).unwrap();
    assert_eq!(s.snapshot().unwrap().tasks.len(), 1);
}

#[test]
fn persists_and_migrations_are_idempotent() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("study.db");
    {
        let mut s = Store::open(&path).unwrap();
        s.setup_password(password()).unwrap();
        s.save_area(area_input()).unwrap();
        s.save_task(task_input(None)).unwrap();
    }
    let mut s = Store::open(&path).unwrap();
    assert!(s.auth_status().unwrap().configured);
    assert_eq!(s.snapshot().unwrap_err().code, "LOCKED");
    s.unlock(password()).unwrap();
    assert_eq!(s.snapshot().unwrap().areas.len(), 1);
    assert_eq!(s.snapshot().unwrap().tasks.len(), 1);
    s.migrate().unwrap();
    assert_eq!(s.snapshot().unwrap().tasks.len(), 1);
}

#[test]
fn refuses_future_schema_without_deleting_data() {
    let mut s = store();
    s.save_task(task_input(None)).unwrap();
    s.connection
        .execute("INSERT INTO schema_migrations VALUES (8, 'future')", [])
        .unwrap();
    assert_eq!(s.migrate().unwrap_err().code, "SCHEMA_VERSION");
    assert_eq!(s.snapshot().unwrap().tasks.len(), 1);
}

#[test]
fn task_checkpoint_link_survives_updates_and_detaches_without_deleting_task() {
    let mut s = store();
    let checkpoint = s.snapshot().unwrap().checkpoints[0].id.clone();
    let mut input = task_input(None);
    input.checkpoint_id = Some(checkpoint.clone());
    s.save_task(input).unwrap();
    assert_eq!(
        s.snapshot().unwrap().tasks[0].checkpoint_id.as_deref(),
        Some(checkpoint.as_str())
    );
    s.delete_progress("checkpoint".into(), checkpoint).unwrap();
    let data = s.snapshot().unwrap();
    assert_eq!(data.tasks.len(), 1);
    assert!(data.tasks[0].checkpoint_id.is_none());
}
#[test]
fn upgrades_epic_two_database_without_losing_password_or_tasks() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("legacy.db");
    let hash = store().password_hash().unwrap().unwrap();
    let task = uuid::Uuid::new_v4().to_string();
    {
        let c = Connection::open(&path).unwrap();
        c.execute_batch(include_str!("../../migrations/001_foundation.sql"))
            .unwrap();
        c.execute_batch(include_str!("../../migrations/002_study_progress.sql"))
            .unwrap();
        c.execute_batch("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL); INSERT INTO schema_migrations VALUES(1,'2026-10-19T00:00:00Z'),(2,'2026-10-19T00:00:00Z');").unwrap();
        c.execute(
            "INSERT INTO app_settings VALUES('password_hash',?1)",
            [&hash],
        )
        .unwrap();
        c.execute("INSERT INTO tasks(id,title,priority,status,created_at,updated_at) VALUES(?1,'Preservada','medium','todo',?2,?2)",params![task,now()]).unwrap();
    }
    let mut s = Store::open(&path).unwrap();
    s.unlock(password()).unwrap();
    let data = s.snapshot().unwrap();
    assert_eq!(data.tasks.len(), 1);
    assert_eq!(data.tasks[0].id, task);
    assert_eq!(s.password_hash().unwrap().unwrap(), hash);
    assert_eq!(data.roadmaps.len(), 2);
    assert_eq!(
        s.connection
            .query_row("SELECT MAX(version) FROM schema_migrations", [], |r| r
                .get::<_, i64>(0))
            .unwrap(),
        7
    );
}
