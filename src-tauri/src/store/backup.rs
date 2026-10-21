use super::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::BTreeMap,
    io::{Read, Write},
};
const LIMIT: usize = 20 * 1024 * 1024;
const TABLES: &[&str] = &[
    "study_areas",
    "topics",
    "resources",
    "tasks",
    "study_sessions",
    "goals",
    "checkpoints",
    "checkpoint_evidence",
    "roadmaps",
    "roadmap_items",
    "english_lessons",
    "english_submissions",
    "learning_reviews",
    "vocabulary_items",
    "vocabulary_reviews",
    "recurrences",
    "recurrence_occurrences",
    "imported_chatgpt_tasks",
    "coding_challenges",
    "code_submissions",
    "evaluation_results",
    "ai_usage_records",
    "language_profiles",
    "track_documents",
    "practice_errors",
    "practice_reviews",
    "lesson_pdfs",
    "pdf_reviews",
];
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Backup {
    format: String,
    version: u32,
    schema: u32,
    created_at: String,
    tables: BTreeMap<String, Vec<Vec<Value>>>,
}
fn invalid() -> AppError {
    AppError::new(
        "BACKUP",
        "O backup não passou pela validação. Nenhum dado foi alterado.",
    )
}
fn columns(connection: &Connection, table: &str) -> AppResult<Vec<String>> {
    let mut q = connection
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(AppError::database)?;
    let result = q
        .query_map([], |r| r.get(1))
        .map_err(AppError::database)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::database)?;
    Ok(result)
}
fn values(columns: &[String], row: &[Value]) -> AppResult<Vec<rusqlite::types::Value>> {
    if row.len() != columns.len() {
        return Err(invalid());
    }
    row.iter()
        .zip(columns)
        .map(|(value, column)| match value {
            Value::Null => Ok(rusqlite::types::Value::Null),
            Value::Number(number) => {
                let value = number.as_i64().ok_or_else(invalid)?;
                if (column.ends_with("tokens") || column.ends_with("micros")) && value < 0 {
                    return Err(invalid());
                }
                Ok(rusqlite::types::Value::Integer(value))
            }
            Value::String(s) => {
                if s.len() > 1_000_000 || s.contains('\0') {
                    return Err(invalid());
                }
                if column == "id" || (column.ends_with("_id") && column != "external_id") {
                    validation::id(s).map_err(|_| invalid())?;
                }
                if (column.ends_with("_date") || column == "next_review")
                    && (s.len() != 10 || chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_err())
                {
                    return Err(invalid());
                }
                if column.ends_with("_at") && chrono::DateTime::parse_from_rfc3339(s).is_err() {
                    return Err(invalid());
                }
                if column == "status" && s == "running" {
                    return Ok(rusqlite::types::Value::Text("paused".into()));
                }
                Ok(rusqlite::types::Value::Text(s.clone()))
            }
            _ => Err(invalid()),
        })
        .collect()
}
fn insert(connection: &Connection, backup: &Backup, merge: bool) -> AppResult<(usize, usize)> {
    let (mut added, mut skipped) = (0, 0);
    for table in TABLES {
        let names = columns(connection, table)?;
        let placeholders = std::iter::repeat_n("?", names.len())
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!(
            "INSERT INTO {table} VALUES ({placeholders}) {}",
            if merge { "ON CONFLICT DO NOTHING" } else { "" }
        );
        for row in backup.tables.get(*table).ok_or_else(invalid)? {
            let value = values(&names, row)?;
            let count = connection
                .execute(&sql, rusqlite::params_from_iter(value))
                .map_err(|_| invalid())?;
            added += count;
            skipped += usize::from(count == 0);
        }
    }
    Ok((added, skipped))
}
impl Store {
    fn backup_json(&mut self) -> AppResult<String> {
        self.require_auth()?;
        if let Some((id, _)) = self.running_clock.clone() {
            self.tick_session(&id, "running")?;
        }
        let tx = self.connection.transaction().map_err(AppError::database)?;
        let mut tables = BTreeMap::new();
        for table in TABLES {
            let mut query = tx
                .prepare(&format!("SELECT * FROM {table}"))
                .map_err(AppError::database)?;
            let count = query.column_count();
            let rows = query
                .query_map([], |row| {
                    let mut values = vec![];
                    for index in 0..count {
                        values.push(match row.get_ref(index)? {
                            rusqlite::types::ValueRef::Null => Value::Null,
                            rusqlite::types::ValueRef::Integer(i) => Value::from(i),
                            rusqlite::types::ValueRef::Text(s) => {
                                Value::String(String::from_utf8_lossy(s).into_owned())
                            }
                            _ => return Err(rusqlite::Error::InvalidQuery),
                        });
                    }
                    Ok(values)
                })
                .map_err(AppError::database)?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(AppError::database)?;
            tables.insert((*table).to_string(), rows);
        }
        tx.commit().map_err(AppError::database)?;
        let result = serde_json::to_string(&Backup {
            format: "LearningStudio".into(),
            version: 1,
            schema: 7,
            created_at: now(),
            tables,
        })
        .map_err(|_| invalid())?;
        if result.len() > LIMIT {
            return Err(AppError::validation(
                "O backup excede o limite de 20 MiB desta versão.",
            ));
        }
        Ok(result)
    }
    fn merge_backup(&mut self, content: &str) -> AppResult<(usize, usize)> {
        self.require_auth()?;
        if content.len() > LIMIT {
            return Err(invalid());
        }
        let mut backup: Backup = serde_json::from_str(content).map_err(|_| invalid())?;
        if backup.schema == 6 {
            for table in [
                "language_profiles",
                "track_documents",
                "practice_errors",
                "practice_reviews",
                "lesson_pdfs",
                "pdf_reviews",
            ] {
                backup.tables.entry(table.into()).or_default();
            }
        }
        if backup.format != "LearningStudio"
            || backup.version != 1
            || ![6, 7].contains(&backup.schema)
            || backup.tables.len() != TABLES.len()
            || backup
                .tables
                .keys()
                .any(|key| !TABLES.contains(&key.as_str()))
        {
            return Err(invalid());
        }
        let shadow = Connection::open_in_memory().map_err(AppError::database)?;
        shadow
            .execute_batch("PRAGMA foreign_keys=ON;")
            .map_err(AppError::database)?;
        for migration in [
            include_str!("../../migrations/001_foundation.sql"),
            include_str!("../../migrations/002_study_progress.sql"),
            include_str!("../../migrations/003_learning_library.sql"),
            include_str!("../../migrations/004_agenda.sql"),
            include_str!("../../migrations/005_google.sql"),
            include_str!("../../migrations/006_tutors.sql"),
            include_str!("../../migrations/007_tracks.sql"),
        ] {
            shadow
                .execute_batch(migration)
                .map_err(AppError::database)?;
        }
        shadow
            .execute_batch("BEGIN; PRAGMA defer_foreign_keys=ON;")
            .map_err(AppError::database)?;
        insert(&shadow, &backup, false)?;
        shadow.execute_batch("COMMIT;").map_err(|_| invalid())?;
        super::tracks::validate_backup(&shadow)?;
        for (table, column) in [
            ("english_lessons", "content"),
            ("coding_challenges", "content"),
            ("evaluation_results", "feedback"),
            ("english_submissions", "answers"),
        ] {
            let mut q = shadow
                .prepare(&format!("SELECT {column} FROM {table}"))
                .map_err(AppError::database)?;
            let raw = q
                .query_map([], |r| r.get::<_, String>(0))
                .map_err(AppError::database)?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(AppError::database)?;
            for value in raw {
                match table {
                    "english_lessons" => {
                        serde_json::from_str::<EnglishLesson>(&value).map_err(|_| invalid())?;
                    }
                    "coding_challenges" => {
                        serde_json::from_str::<CodingChallenge>(&value).map_err(|_| invalid())?;
                    }
                    "evaluation_results" => {
                        serde_json::from_str::<Feedback>(&value).map_err(|_| invalid())?;
                    }
                    _ => {
                        serde_json::from_str::<Vec<Option<usize>>>(&value)
                            .map_err(|_| invalid())?;
                    }
                }
            }
        }
        let tx = self.connection.transaction().map_err(AppError::database)?;
        tx.execute_batch("PRAGMA defer_foreign_keys=ON;")
            .map_err(AppError::database)?;
        let result = insert(&tx, &backup, true)?;
        tx.commit().map_err(|_| invalid())?;
        Ok(result)
    }
    pub fn export_backup(&mut self) -> AppResult<String> {
        self.require_auth()?;
        let path = rfd::FileDialog::new()
            .set_title("Exportar dados do LearningStudio")
            .add_filter("Backup LearningStudio", &["json"])
            .set_file_name(format!(
                "LearningStudio-{}.json",
                Utc::now().format("%Y%m%d-%H%M%S")
            ))
            .save_file();
        let Some(path) = path else {
            return Ok("Exportação cancelada.".into());
        };
        let content = self.backup_json()?;
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .map_err(|_| {
                AppError::new(
                    "FILE",
                    "Escolha um nome novo e uma pasta com permissão de gravação.",
                )
            })?;
        file.write_all(content.as_bytes()).and_then(|_|file.sync_all()).map_err(|_|AppError::new("FILE","Não foi possível concluir a gravação. O arquivo incompleto não deve ser usado."))?;
        Ok(format!("Backup salvo em {}", path.display()))
    }
    pub fn import_backup(&mut self) -> AppResult<String> {
        self.require_auth()?;
        let path = rfd::FileDialog::new()
            .set_title("Mesclar backup do LearningStudio")
            .add_filter("Backup LearningStudio", &["json"])
            .pick_file();
        let Some(path) = path else {
            return Ok("Importação cancelada.".into());
        };
        let file = std::fs::File::open(path).map_err(|_| invalid())?;
        let mut content = String::new();
        file.take((LIMIT + 1) as u64)
            .read_to_string(&mut content)
            .map_err(|_| invalid())?;
        let (added, skipped) = self.merge_backup(&content)?;
        Ok(format!(
            "{added} registros adicionados. {skipped} registros já existentes foram preservados."
        ))
    }
}
#[cfg(test)]
mod tests {
    use super::super::tests::{store, task_input};
    use super::*;
    #[test]
    fn restores_version_six_backup_and_validates_new_track_content() {
        let mut source = store();
        source.save_task(task_input(None)).unwrap();
        let mut old: Value = serde_json::from_str(&source.backup_json().unwrap()).unwrap();
        old["schema"] = Value::from(6);
        for table in [
            "language_profiles",
            "track_documents",
            "practice_errors",
            "practice_reviews",
            "lesson_pdfs",
            "pdf_reviews",
        ] {
            old["tables"].as_object_mut().unwrap().remove(table);
        }
        let mut destination = store();
        destination.merge_backup(&old.to_string()).unwrap();
        assert_eq!(destination.snapshot().unwrap().tasks.len(), 1);
        let mut malformed: Value = serde_json::from_str(&source.backup_json().unwrap()).unwrap();
        malformed["tables"]["language_profiles"] =
            serde_json::json!([[uuid::Uuid::new_v4().to_string(), "{\"id\":\"bad\"}", now()]]);
        assert!(destination.merge_backup(&malformed.to_string()).is_err());
        assert_eq!(destination.snapshot().unwrap().tasks.len(), 1);
    }
    #[test]
    fn backup_excludes_password_secrets_and_outbound_queue() {
        let mut s = store();
        s.connection
            .execute(
                "INSERT INTO app_settings VALUES('fixture-api-key','secret-value')",
                [],
            )
            .unwrap();
        s.save_task(task_input(None)).unwrap();
        let json = s.backup_json().unwrap();
        assert!(!json.contains("argon2"));
        assert!(!json.contains("secret-value"));
        assert!(!json.contains("app_settings"));
        assert!(!json.contains("sync_records"));
        assert!(json.contains("Praticar funções"));
    }
    #[test]
    fn merge_is_idempotent_preserves_local_rows_and_keeps_password() {
        let mut source = store();
        source.save_task(task_input(None)).unwrap();
        let data = source.backup_json().unwrap();
        let mut target = store();
        target.save_task(task_input(None)).unwrap();
        let hash = target.password_hash().unwrap();
        target.merge_backup(&data).unwrap();
        target.merge_backup(&data).unwrap();
        assert_eq!(target.snapshot().unwrap().tasks.len(), 2);
        assert_eq!(target.password_hash().unwrap(), hash);
    }
    #[test]
    fn malformed_or_unknown_tables_roll_back_without_data_loss() {
        let mut s = store();
        s.save_task(task_input(None)).unwrap();
        let mut backup: Backup = serde_json::from_str(&s.backup_json().unwrap()).unwrap();
        backup.tables.insert("app_settings".into(), vec![]);
        assert!(s
            .merge_backup(&serde_json::to_string(&backup).unwrap())
            .is_err());
        assert_eq!(s.snapshot().unwrap().tasks.len(), 1);
    }
    #[test]
    fn dangling_foreign_key_is_rejected_before_merging() {
        let mut s = store();
        s.save_task(task_input(None)).unwrap();
        let mut backup: Backup = serde_json::from_str(&s.backup_json().unwrap()).unwrap();
        let columns = columns(&s.connection, "tasks").unwrap();
        let index = columns.iter().position(|name| name == "area_id").unwrap();
        backup.tables.get_mut("tasks").unwrap()[0][index] =
            Value::String(uuid::Uuid::new_v4().to_string());
        assert!(s
            .merge_backup(&serde_json::to_string(&backup).unwrap())
            .is_err());
        assert!(s.snapshot().unwrap().tasks[0].area_id.is_none());
    }
}
