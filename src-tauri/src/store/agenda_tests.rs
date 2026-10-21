use super::agenda::{expand, parse_import};
use super::tests::store;
use super::*;
fn rule() -> Recurrence {
    Recurrence {
        id: uuid::Uuid::new_v4().to_string(),
        title: "Prática".into(),
        notes: "".into(),
        weekdays: 21,
        local_time: "15:00".into(),
        timezone: "America/Sao_Paulo".into(),
        start_date: "2026-10-01".into(),
        end_date: None,
        enabled: true,
    }
}
#[test]
fn weekly_rules_obey_days_end_and_timezone() {
    let mut r = rule();
    r.end_date = Some("2026-10-22".into());
    let rows = expand(&[r], "2026-10-19", "2026-10-25").unwrap();
    assert_eq!(
        rows.iter().map(|r| r.date.as_str()).collect::<Vec<_>>(),
        vec!["2026-10-19", "2026-10-21"]
    );
    assert_eq!(
        rows[0].starts_at.as_deref(),
        Some("2026-10-19T18:00:00+00:00")
    );
}
#[test]
fn daylight_saving_gaps_and_ambiguity_are_explicit() {
    let mut r = rule();
    r.timezone = "America/New_York".into();
    r.weekdays = 64;
    r.local_time = "02:30".into();
    r.start_date = "2026-01-01".into();
    let rows = expand(&[r.clone()], "2026-03-08", "2026-03-08").unwrap();
    assert!(rows[0].starts_at.is_none());
    assert!(rows[0].warning.is_some());
    r.local_time = "01:30".into();
    let rows = expand(&[r], "2026-11-01", "2026-11-01").unwrap();
    assert_eq!(
        rows[0].starts_at.as_deref(),
        Some("2026-11-01T05:30:00+00:00")
    );
    assert!(rows[0].warning.is_some());
}
#[test]
fn materialization_is_atomic_idempotent_and_does_not_recreate_deleted_tasks() {
    let mut s = store();
    s.agenda_action(AgendaAction::SaveRecurrence { input: rule() })
        .unwrap();
    for _ in 0..2 {
        s.agenda_action(AgendaAction::Materialize {
            from: "2026-10-19".into(),
            to: "2026-10-25".into(),
        })
        .unwrap();
    }
    let rows = s.snapshot().unwrap();
    assert_eq!(rows.tasks.len(), 3);
    s.delete_task(rows.tasks[0].id.clone()).unwrap();
    s.agenda_action(AgendaAction::Materialize {
        from: "2026-10-19".into(),
        to: "2026-10-25".into(),
    })
    .unwrap();
    assert_eq!(s.snapshot().unwrap().tasks.len(), 2);
}
#[test]
fn writing_template_is_disabled_until_user_activates() {
    let mut s = store();
    let data = s
        .agenda_snapshot("2026-10-19".into(), "2026-10-25".into())
        .unwrap();
    assert_eq!(data.recurrences.len(), 1);
    assert!(!data.recurrences[0].enabled);
    assert_eq!(data.recurrences[0].weekdays, 21);
    assert!(data.occurrences.is_empty());
}
fn content() -> String {
    r#"[{"externalId":"writing","title":"Write","instructions":"Explain a decision","schedule":"Mon 15h","url":"https://chatgpt.com/","notes":"Manual"}]"#.into()
}
#[test]
fn repeated_import_and_conversion_preserve_local_edits() {
    let mut s = store();
    for _ in 0..2 {
        s.agenda_action(AgendaAction::Import {
            format: "json".into(),
            content: content(),
        })
        .unwrap();
    }
    let rows = s
        .agenda_snapshot("2026-10-19".into(), "2026-10-25".into())
        .unwrap();
    assert_eq!(rows.imported.len(), 1);
    let id = rows.imported[0].id.clone();
    for _ in 0..2 {
        s.agenda_action(AgendaAction::Convert {
            id: id.clone(),
            due_date: Some("2026-10-20".into()),
        })
        .unwrap();
    }
    assert_eq!(s.snapshot().unwrap().tasks.len(), 1);
    let task = s.snapshot().unwrap().tasks[0].id.clone();
    s.delete_task(task).unwrap();
    s.agenda_action(AgendaAction::Convert { id, due_date: None })
        .unwrap();
    assert!(s.snapshot().unwrap().tasks.is_empty());
}
#[test]
fn csv_handles_quotes_newlines_and_rejects_unsafe_or_duplicate_input() {
    let csv="externalId,title,instructions,schedule,url,notes\r\na,\"Title, with comma\",\"line 1\nline 2\",weekly,https://chatgpt.com/,manual";
    let rows = parse_import("csv", csv).unwrap();
    assert_eq!(rows[0].title, "Title, with comma");
    assert!(rows[0].instructions.contains('\n'));
    assert!(parse_import(
        "json",
        &content().replace("https://chatgpt.com/", "javascript:alert(1)")
    )
    .is_err());
    let row = &content()[1..content().len() - 1];
    assert!(parse_import("json", &format!("[{row},{row}]")).is_err());
}
#[test]
fn agenda_validates_before_writing_and_is_guarded() {
    let mut s = store();
    let mut r = rule();
    r.timezone = "invalid".into();
    assert!(s
        .agenda_action(AgendaAction::SaveRecurrence { input: r })
        .is_err());
    assert!(s
        .agenda_snapshot("2026-01-01".into(), "2026-12-31".into())
        .is_err());
    s.lock().unwrap();
    assert_eq!(
        s.preview_import("json".into(), content()).unwrap_err().code,
        "LOCKED"
    );
    assert_eq!(
        s.agenda_action(AgendaAction::Materialize {
            from: "2026-10-19".into(),
            to: "2026-10-25".into()
        })
        .unwrap_err()
        .code,
        "LOCKED"
    );
}
#[test]
fn long_imported_instructions_are_preserved_without_exceeding_task_editor_limits() {
    let mut s = store();
    let data = content().replace("Explain a decision", &"x".repeat(6000));
    s.agenda_action(AgendaAction::Import {
        format: "json".into(),
        content: data,
    })
    .unwrap();
    let item = s
        .agenda_snapshot("2026-10-19".into(), "2026-10-25".into())
        .unwrap()
        .imported
        .remove(0);
    s.agenda_action(AgendaAction::Convert {
        id: item.id,
        due_date: None,
    })
    .unwrap();
    assert!(s.snapshot().unwrap().tasks[0].notes.chars().count() < 5000);
    assert_eq!(item.input.instructions.len(), 6000);
}
