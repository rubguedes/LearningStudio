use super::*;

#[test]
fn only_real_activity_can_renew_a_valid_authentication_session() {
    let mut store = authorized();
    store.authenticated_at = Some(Instant::now() - Duration::from_secs(300));
    store.user_activity().unwrap();
    assert!(store.authenticated_at.unwrap().elapsed() < Duration::from_secs(1));
    store.authenticated_at = Some(Instant::now() - IDLE_TIMEOUT - Duration::from_secs(1));
    assert_eq!(store.user_activity().unwrap_err().code, "LOCKED");
}

fn authorized() -> Store {
    let mut store = Store::open(Path::new(":memory:")).unwrap();
    store
        .setup_password(Zeroizing::new("uma frase longa segura".into()))
        .unwrap();
    store
}
fn input() -> SessionInput {
    SessionInput {
        id: uuid::Uuid::new_v4().to_string(),
        title: "Estudar SQL".into(),
        notes: "Prática real".into(),
        area_id: None,
        study_date: chrono::Local::now().date_naive().to_string(),
        duration_seconds: 60,
    }
}

#[test]
fn manual_session_upsert_is_idempotent_and_guarded() {
    let mut store = authorized();
    let mut session = input();
    store.save_session(session.clone()).unwrap();
    session.duration_seconds = 120;
    store.save_session(session.clone()).unwrap();
    let data = store.snapshot().unwrap();
    assert_eq!(data.sessions.len(), 1);
    assert_eq!(data.sessions[0].duration_seconds, 120);
    store.lock().unwrap();
    assert_eq!(store.save_session(session).unwrap_err().code, "LOCKED");
}

#[test]
fn timer_counts_native_elapsed_time_and_retries_do_not_double_count() {
    let mut store = authorized();
    let mut session = input();
    session.duration_seconds = 0;
    let id = session.id.clone();
    store.start_session(session.clone()).unwrap();
    store.start_session(session).unwrap();
    store.running_clock = Some((id.clone(), Instant::now() - Duration::from_secs(3)));
    let first = store.pulse_session(id.clone()).unwrap();
    assert_eq!(first.duration_seconds, 3);
    let repeated = store.pulse_session(id.clone()).unwrap();
    assert_eq!(repeated.duration_seconds, 3);
    store.control_session(id.clone(), "pause".into()).unwrap();
    assert_eq!(store.snapshot().unwrap().sessions[0].status, "paused");
    store.control_session(id.clone(), "finish".into()).unwrap();
    assert_eq!(store.snapshot().unwrap().sessions[0].status, "completed");
    assert!(store.control_session(id, "resume".into()).is_err());
}

#[test]
fn long_interruptions_and_automatic_pulses_do_not_invent_study_or_keep_auth_alive() {
    let mut store = authorized();
    let mut session = input();
    session.duration_seconds = 0;
    let id = session.id.clone();
    store.start_session(session).unwrap();
    store.running_clock = Some((id.clone(), Instant::now() - Duration::from_secs(3600)));
    let paused = store.pulse_session(id.clone()).unwrap();
    assert_eq!(paused.status, "paused");
    assert_eq!(paused.duration_seconds, 0);
    store.control_session(id.clone(), "resume".into()).unwrap();
    store.authenticated_at = Some(Instant::now() - IDLE_TIMEOUT - Duration::from_secs(1));
    assert_eq!(store.pulse_session(id).unwrap_err().code, "LOCKED");
    assert!(!store.auth_status().unwrap().unlocked);
}

#[test]
fn prevents_concurrent_timers_and_manual_overwrite() {
    let mut store = authorized();
    let mut first = input();
    first.duration_seconds = 0;
    store.start_session(first.clone()).unwrap();
    let mut second = input();
    second.duration_seconds = 0;
    assert_eq!(
        store.start_session(second).unwrap_err().code,
        "ACTIVE_SESSION"
    );
    first.duration_seconds = 60;
    assert!(store.save_session(first).is_err());
}

#[test]
fn restart_recovers_timer_paused_without_counting_closed_time() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("study.db");
    let id;
    {
        let mut store = Store::open(&path).unwrap();
        store
            .setup_password(Zeroizing::new("uma frase longa segura".into()))
            .unwrap();
        let mut session = input();
        session.duration_seconds = 0;
        id = session.id.clone();
        store.start_session(session).unwrap();
        store.running_clock = Some((id.clone(), Instant::now() - Duration::from_secs(2)));
        store.pulse_session(id).unwrap();
    }
    let mut store = Store::open(&path).unwrap();
    store
        .unlock(Zeroizing::new("uma frase longa segura".into()))
        .unwrap();
    let session = &store.snapshot().unwrap().sessions[0];
    assert_eq!(session.status, "paused");
    assert_eq!(session.duration_seconds, 2);
}

#[test]
fn checkpoint_completion_keeps_evidence_history_and_is_idempotent() {
    let mut store = authorized();
    let input = CheckpointInput {
        id: uuid::Uuid::new_v4().to_string(),
        title: "API".into(),
        description: "".into(),
        activity: "Criar endpoint".into(),
        criteria: "Testes aprovados".into(),
        area_id: None,
    };
    store.save_checkpoint(input.clone()).unwrap();
    assert!(store
        .complete_checkpoint(input.id.clone(), " ".into())
        .is_err());
    store
        .complete_checkpoint(input.id.clone(), "Projeto local e testes".into())
        .unwrap();
    store
        .complete_checkpoint(input.id.clone(), "Projeto local e testes".into())
        .unwrap();
    assert_eq!(store.snapshot().unwrap().checkpoint_evidence.len(), 1);
    let mut changed = input.clone();
    changed.criteria = "Novos critérios".into();
    assert!(store.save_checkpoint(changed.clone()).is_err());
    store.reopen_checkpoint(input.id.clone()).unwrap();
    store.save_checkpoint(changed).unwrap();
    store
        .complete_checkpoint(input.id.clone(), "Nova evidência".into())
        .unwrap();
    assert_eq!(store.snapshot().unwrap().checkpoint_evidence.len(), 2);
    store
        .delete_progress("checkpoint".into(), input.id)
        .unwrap();
    assert!(store.snapshot().unwrap().checkpoint_evidence.is_empty());
}

#[test]
fn goals_validate_period_and_preserve_area_scope() {
    let mut store = authorized();
    store
        .save_area(AreaInput {
            id: None,
            name: "Python".into(),
            description: "".into(),
            color: "forest".into(),
        })
        .unwrap();
    let area_id = store.snapshot().unwrap().areas[0].id.clone();
    let mut goal = GoalInput {
        id: uuid::Uuid::new_v4().to_string(),
        title: "Praticar".into(),
        area_id: Some(area_id.clone()),
        mode: "study_minutes".into(),
        unit: "minutos".into(),
        target: 60,
        manual_value: 0,
        start_date: "2026-10-19".into(),
        due_date: "2026-10-25".into(),
    };
    store.save_goal(goal.clone()).unwrap();
    store.save_goal(goal.clone()).unwrap();
    assert_eq!(store.snapshot().unwrap().goals.len(), 1);
    assert!(store.delete_area(area_id).is_err());
    goal.manual_value = 10;
    assert!(store.save_goal(goal.clone()).is_err());
    goal.manual_value = 0;
    goal.due_date = "2026-10-18".into();
    assert!(store.save_goal(goal).is_err());
}
