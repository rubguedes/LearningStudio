fn main() {
    create_icon();
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "auth_status",
            "setup_password",
            "unlock",
            "lock",
            "workspace_snapshot",
            "save_area",
            "archive_area",
            "delete_area",
            "save_task",
            "delete_task",
            "save_session",
            "start_session",
            "pulse_session",
            "control_session",
            "save_goal",
            "archive_goal",
            "save_checkpoint",
            "complete_checkpoint",
            "reopen_checkpoint",
            "delete_progress",
            "user_activity",
            "library_snapshot",
            "library_action",
            "agenda_snapshot",
            "agenda_action",
            "preview_import",
            "google_begin",
            "google_status",
            "google_action",
            "tutor_snapshot",
            "tutor_action",
            "challenge_solution",
            "export_backup",
            "import_backup",
            "organizer_snapshot",
            "organizer_action",
            "tracks_snapshot",
            "tracks_action",
            "lesson_pdf",
        ]),
    ))
    .expect("Não foi possível preparar os recursos Tauri");
}

// Ícone próprio em formato ICO/BMP, gerado sem dependências de imagem.
// Cargo prepara este recurso antes de generate_context! e do empacotamento.
fn create_icon() {
    let width: u32 = 32;
    let bitmap_size = 40 + width * width * 4 + width * 4;
    let mut data = Vec::new();
    data.extend_from_slice(&[0, 0, 1, 0, 1, 0, 32, 32, 0, 0, 1, 0, 32, 0]);
    data.extend_from_slice(&bitmap_size.to_le_bytes());
    data.extend_from_slice(&22_u32.to_le_bytes());
    data.extend_from_slice(&40_u32.to_le_bytes());
    data.extend_from_slice(&(width as i32).to_le_bytes());
    data.extend_from_slice(&((width * 2) as i32).to_le_bytes());
    data.extend_from_slice(&[1, 0, 32, 0]);
    data.extend_from_slice(&[0; 24]);
    for y in (0..32).rev() {
        for x in 0..32 {
            let page = (7..=14).contains(&x) && (8..=23).contains(&y)
                || (17..=24).contains(&x) && (8..=23).contains(&y)
                || x == 15 && (11..=25).contains(&y);
            data.extend_from_slice(if page {
                &[232, 247, 238, 255]
            } else {
                &[83, 108, 36, 255]
            });
        }
    }
    data.extend_from_slice(&[0; 128]);
    let directory = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("icons");
    std::fs::create_dir_all(&directory).expect("Não foi possível preparar o ícone");
    std::fs::write(directory.join("icon.ico"), data).expect("Não foi possível gravar o ícone");
}
