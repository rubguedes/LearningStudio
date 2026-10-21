mod ai;
mod models;
mod network;
mod pdf;
mod store;
mod validation;
mod vault;

use models::*;
use std::sync::{Arc, Mutex};
use store::Store;
use tauri::{Manager, State};
use zeroize::Zeroizing;

type SharedStore = Arc<Mutex<Store>>;

#[tauri::command]
async fn tracks_snapshot(state: State<'_, SharedStore>) -> AppResult<TracksSnapshot> {
    with_store(&state, |s| s.tracks_snapshot()).await
}
#[tauri::command]
async fn tracks_action(state: State<'_, SharedStore>, action: TracksAction) -> AppResult<()> {
    with_store(&state, move |s| s.tracks_action(action)).await
}
#[tauri::command]
async fn lesson_pdf(
    state: State<'_, SharedStore>,
    lesson_id: String,
    import: bool,
) -> AppResult<String> {
    with_store(&state, move |s| s.lesson_pdf(&lesson_id, import)).await
}

async fn with_store<T: Send + 'static>(
    state: &SharedStore,
    action: impl FnOnce(&mut Store) -> AppResult<T> + Send + 'static,
) -> AppResult<T> {
    let shared = Arc::clone(state);
    tauri::async_runtime::spawn_blocking(move || {
        let mut store = shared
            .lock()
            .map_err(|_| AppError::new("INTERNAL", "Reinicie o aplicativo para continuar."))?;
        action(&mut store)
    })
    .await
    .map_err(|_| AppError::new("INTERNAL", "A operação não pôde ser concluída."))?
}

#[tauri::command]
async fn auth_status(state: State<'_, SharedStore>) -> AppResult<AuthStatus> {
    with_store(&state, |s| s.auth_status()).await
}

#[tauri::command]
async fn setup_password(state: State<'_, SharedStore>, password: String) -> AppResult<AuthStatus> {
    let password = Zeroizing::new(password);
    with_store(&state, move |s| s.setup_password(password)).await
}

#[tauri::command]
async fn unlock(state: State<'_, SharedStore>, password: String) -> AppResult<AuthStatus> {
    let password = Zeroizing::new(password);
    with_store(&state, move |s| s.unlock(password)).await
}

#[tauri::command]
async fn lock(state: State<'_, SharedStore>) -> AppResult<()> {
    with_store(&state, |s| s.lock()).await
}

#[tauri::command]
async fn user_activity(state: State<'_, SharedStore>) -> AppResult<()> {
    with_store(&state, |s| s.user_activity()).await
}

#[tauri::command]
async fn workspace_snapshot(state: State<'_, SharedStore>) -> AppResult<Snapshot> {
    with_store(&state, |s| s.snapshot()).await
}

#[tauri::command]
async fn save_area(state: State<'_, SharedStore>, input: AreaInput) -> AppResult<()> {
    with_store(&state, move |s| s.save_area(input)).await
}

#[tauri::command]
async fn archive_area(state: State<'_, SharedStore>, id: String, archived: bool) -> AppResult<()> {
    with_store(&state, move |s| s.archive_area(id, archived)).await
}

#[tauri::command]
async fn delete_area(state: State<'_, SharedStore>, id: String) -> AppResult<()> {
    with_store(&state, move |s| s.delete_area(id)).await
}

#[tauri::command]
async fn save_task(state: State<'_, SharedStore>, input: TaskInput) -> AppResult<()> {
    with_store(&state, move |s| s.save_task(input)).await
}

#[tauri::command]
async fn delete_task(state: State<'_, SharedStore>, id: String) -> AppResult<()> {
    with_store(&state, move |s| s.delete_task(id)).await
}

#[tauri::command]
async fn save_session(state: State<'_, SharedStore>, input: SessionInput) -> AppResult<()> {
    with_store(&state, move |s| s.save_session(input)).await
}

#[tauri::command]
async fn start_session(state: State<'_, SharedStore>, input: SessionInput) -> AppResult<()> {
    with_store(&state, move |s| s.start_session(input)).await
}

#[tauri::command]
async fn pulse_session(state: State<'_, SharedStore>, id: String) -> AppResult<StudySession> {
    with_store(&state, move |s| s.pulse_session(id)).await
}

#[tauri::command]
async fn control_session(
    state: State<'_, SharedStore>,
    id: String,
    action: String,
) -> AppResult<()> {
    with_store(&state, move |s| s.control_session(id, action)).await
}

#[tauri::command]
async fn save_goal(state: State<'_, SharedStore>, input: GoalInput) -> AppResult<()> {
    with_store(&state, move |s| s.save_goal(input)).await
}

#[tauri::command]
async fn archive_goal(state: State<'_, SharedStore>, id: String, archived: bool) -> AppResult<()> {
    with_store(&state, move |s| s.archive_goal(id, archived)).await
}

#[tauri::command]
async fn save_checkpoint(state: State<'_, SharedStore>, input: CheckpointInput) -> AppResult<()> {
    with_store(&state, move |s| s.save_checkpoint(input)).await
}

#[tauri::command]
async fn complete_checkpoint(
    state: State<'_, SharedStore>,
    id: String,
    evidence: String,
) -> AppResult<()> {
    with_store(&state, move |s| s.complete_checkpoint(id, evidence)).await
}

#[tauri::command]
async fn reopen_checkpoint(state: State<'_, SharedStore>, id: String) -> AppResult<()> {
    with_store(&state, move |s| s.reopen_checkpoint(id)).await
}

#[tauri::command]
async fn delete_progress(state: State<'_, SharedStore>, kind: String, id: String) -> AppResult<()> {
    with_store(&state, move |s| s.delete_progress(kind, id)).await
}

#[tauri::command]
async fn library_snapshot(state: State<'_, SharedStore>) -> AppResult<LibrarySnapshot> {
    with_store(&state, |s| s.library_snapshot()).await
}
#[tauri::command]
async fn library_action(state: State<'_, SharedStore>, action: LibraryAction) -> AppResult<()> {
    with_store(&state, move |s| s.library_action(action)).await
}

#[tauri::command]
async fn agenda_snapshot(
    state: State<'_, SharedStore>,
    from: String,
    to: String,
) -> AppResult<AgendaSnapshot> {
    with_store(&state, move |s| s.agenda_snapshot(from, to)).await
}
#[tauri::command]
async fn agenda_action(state: State<'_, SharedStore>, action: AgendaAction) -> AppResult<()> {
    with_store(&state, move |s| s.agenda_action(action)).await
}
#[tauri::command]
async fn preview_import(
    state: State<'_, SharedStore>,
    format: String,
    content: String,
) -> AppResult<Vec<ImportedTaskInput>> {
    with_store(&state, move |s| s.preview_import(format, content)).await
}

#[tauri::command]
async fn google_begin(state: State<'_, SharedStore>, input: GoogleConnect) -> AppResult<()> {
    with_store(&state, move |s| s.google_begin(input)).await
}
#[tauri::command]
async fn google_status(state: State<'_, SharedStore>) -> AppResult<GoogleStatus> {
    with_store(&state, |s| s.google_status()).await
}
#[tauri::command]
async fn google_action(state: State<'_, SharedStore>, action: GoogleAction) -> AppResult<()> {
    with_store(&state, move |s| s.google_action(action)).await
}

#[tauri::command]
async fn tutor_snapshot(state: State<'_, SharedStore>) -> AppResult<TutorSnapshot> {
    with_store(&state, |s| s.tutor_snapshot()).await
}
#[tauri::command]
async fn tutor_action(state: State<'_, SharedStore>, action: TutorAction) -> AppResult<()> {
    with_store(&state, move |s| s.tutor_action(action)).await
}
#[tauri::command]
async fn challenge_solution(state: State<'_, SharedStore>, id: String) -> AppResult<String> {
    with_store(&state, move |s| s.challenge_solution(id)).await
}

#[tauri::command]
async fn export_backup(state: State<'_, SharedStore>) -> AppResult<String> {
    with_store(&state, |s| s.export_backup()).await
}
#[tauri::command]
async fn import_backup(state: State<'_, SharedStore>) -> AppResult<String> {
    with_store(&state, |s| s.import_backup()).await
}

#[tauri::command]
async fn organizer_snapshot(state: State<'_, SharedStore>) -> AppResult<OrganizerSnapshot> {
    with_store(&state, |s| s.organizer_snapshot()).await
}
#[tauri::command]
async fn organizer_action(state: State<'_, SharedStore>, action: OrganizerAction) -> AppResult<()> {
    with_store(&state, move |s| s.organizer_action(action)).await
}

pub fn run() {
    #[cfg(not(target_os = "windows"))]
    compile_error!("LearningStudio suporta exclusivamente Windows.");

    tauri::Builder::default()
        .setup(|app| {
            let directory = app.path().app_local_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            let store = Store::open(&directory.join("learningstudio.db"))
                .map_err(|e| std::io::Error::other(e.message))?;
            app.manage(Arc::new(Mutex::new(store)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth_status,
            setup_password,
            unlock,
            lock,
            workspace_snapshot,
            save_area,
            archive_area,
            delete_area,
            save_task,
            delete_task,
            save_session,
            start_session,
            pulse_session,
            control_session,
            save_goal,
            archive_goal,
            save_checkpoint,
            complete_checkpoint,
            reopen_checkpoint,
            delete_progress,
            user_activity,
            library_snapshot,
            library_action,
            agenda_snapshot,
            agenda_action,
            preview_import,
            google_begin,
            google_status,
            google_action,
            tutor_snapshot,
            tutor_action,
            challenge_solution,
            export_backup,
            import_backup,
            organizer_snapshot,
            organizer_action,
            tracks_snapshot,
            tracks_action,
            lesson_pdf
        ])
        .run(tauri::generate_context!())
        .expect("Não foi possível iniciar o LearningStudio");
}
