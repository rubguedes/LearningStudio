use crate::{models::*, validation};
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::{SecondsFormat, Utc};
use rand_core::OsRng;
use rusqlite::{params, Connection, OptionalExtension};
use std::{
    path::Path,
    time::{Duration, Instant},
};
use zeroize::Zeroizing;

const IDLE_TIMEOUT: Duration = Duration::from_secs(15 * 60);

pub struct Store {
    connection: Connection,
    authenticated_at: Option<Instant>,
    failed_attempts: u8,
    retry_after: Option<Instant>,
    running_clock: Option<(String, Instant)>,
    pending_oauth: Option<google::PendingOAuth>,
}

fn now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

impl Store {
    pub fn open(path: &Path) -> AppResult<Self> {
        let connection = Connection::open(path).map_err(AppError::database)?;
        connection
            .busy_timeout(Duration::from_secs(5))
            .map_err(AppError::database)?;
        connection
            .execute_batch(
                "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;",
            )
            .map_err(AppError::database)?;
        let mut store = Self {
            connection,
            authenticated_at: None,
            failed_attempts: 0,
            retry_after: None,
            running_clock: None,
            pending_oauth: None,
        };
        store.migrate()?;
        store
            .connection
            .execute(
                "UPDATE study_sessions SET status='paused' WHERE status='running'",
                [],
            )
            .map_err(AppError::database)?;
        Ok(store)
    }

    fn migrate(&mut self) -> AppResult<()> {
        let tx = self.connection.transaction().map_err(AppError::database)?;
        tx.execute_batch("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);")
            .map_err(AppError::database)?;
        let latest: i64 = tx
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
                [],
                |r| r.get(0),
            )
            .map_err(AppError::database)?;
        if latest > 7 {
            return Err(AppError::new(
                "SCHEMA_VERSION",
                "O banco pertence a uma versão mais recente. Atualize o aplicativo.",
            ));
        }
        if latest < 1 {
            tx.execute_batch(include_str!("../migrations/001_foundation.sql"))
                .map_err(AppError::database)?;
            tx.execute(
                "INSERT INTO schema_migrations(version, applied_at) VALUES (1, ?1)",
                [now()],
            )
            .map_err(AppError::database)?;
        }
        if latest < 2 {
            tx.execute_batch(include_str!("../migrations/002_study_progress.sql"))
                .map_err(AppError::database)?;
            tx.execute(
                "INSERT INTO schema_migrations(version, applied_at) VALUES (2, ?1)",
                [now()],
            )
            .map_err(AppError::database)?;
        }
        if latest < 3 {
            tx.execute_batch(include_str!("../migrations/003_learning_library.sql"))
                .map_err(AppError::database)?;
            Self::seed_library(&tx)?;
            tx.execute(
                "INSERT INTO schema_migrations(version, applied_at) VALUES (3,?1)",
                [now()],
            )
            .map_err(AppError::database)?;
        }
        if latest < 4 {
            tx.execute_batch(include_str!("../migrations/004_agenda.sql"))
                .map_err(AppError::database)?;
            tx.execute("INSERT INTO recurrences VALUES (?1,'Prática de escrita em inglês','Modelo desativado. Revise dias, horário e fuso antes de ativar.',21,'15:00','America/Sao_Paulo',?2,NULL,0,?3,?3)",params!["b3087a2e-7455-49f4-97be-5db831a9b001",chrono::Local::now().date_naive().to_string(),now()]).map_err(AppError::database)?;
            tx.execute("INSERT INTO schema_migrations VALUES(4,?1)", [now()])
                .map_err(AppError::database)?;
        }
        if latest < 5 {
            tx.execute_batch(include_str!("../migrations/005_google.sql"))
                .map_err(AppError::database)?;
            tx.execute("INSERT INTO schema_migrations VALUES(5,?1)", [now()])
                .map_err(AppError::database)?;
        }
        tx.execute("UPDATE sync_records SET state='uncertain',message='O aplicativo foi interrompido durante a operação. Verifique antes de repetir.' WHERE state='sending'",[]).map_err(AppError::database)?;
        if latest < 6 {
            tx.execute_batch(include_str!("../migrations/006_tutors.sql"))
                .map_err(AppError::database)?;
            Self::seed_challenges(&tx)?;
            tx.execute("INSERT INTO schema_migrations VALUES(6,?1)", [now()])
                .map_err(AppError::database)?;
        }
        if latest < 7 {
            tx.execute_batch(include_str!("../migrations/007_tracks.sql"))
                .map_err(AppError::database)?;
            tx.execute("INSERT INTO schema_migrations VALUES(7,?1)", [now()])
                .map_err(AppError::database)?;
        }
        tx.commit().map_err(AppError::database)
    }

    fn password_hash(&self) -> AppResult<Option<String>> {
        self.connection
            .query_row(
                "SELECT value FROM app_settings WHERE key = 'password_hash'",
                [],
                |r| r.get(0),
            )
            .optional()
            .map_err(AppError::database)
    }

    fn is_unlocked(&self) -> bool {
        self.authenticated_at
            .is_some_and(|t| t.elapsed() < IDLE_TIMEOUT)
    }

    fn require_auth(&mut self) -> AppResult<()> {
        if !self.is_unlocked() {
            self.authenticated_at = None;
            return Err(AppError::new(
                "LOCKED",
                "Sua sessão está bloqueada. Digite a senha para continuar.",
            ));
        }
        self.authenticated_at = Some(Instant::now());
        Ok(())
    }

    pub fn user_activity(&mut self) -> AppResult<()> {
        self.require_auth()
    }

    pub fn auth_status(&self) -> AppResult<AuthStatus> {
        Ok(AuthStatus {
            configured: self.password_hash()?.is_some(),
            unlocked: self.is_unlocked(),
        })
    }

    pub fn setup_password(&mut self, password: Zeroizing<String>) -> AppResult<AuthStatus> {
        if self.password_hash()?.is_some() {
            return Err(AppError::new(
                "ALREADY_CONFIGURED",
                "A senha já foi configurada. Desbloqueie o aplicativo.",
            ));
        }
        if !(12..=128).contains(&password.chars().count())
            || password.trim().chars().count() < 12
            || password.contains('\0')
        {
            return Err(AppError::validation("Use uma senha de 12 a 128 caracteres, sem espaços nas extremidades como preenchimento."));
        }
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map_err(|_| AppError::new("PASSWORD", "Não foi possível proteger a senha."))?
            .to_string();
        let tx = self.connection.transaction().map_err(AppError::database)?;
        tx.execute(
            "INSERT INTO app_settings(key, value) VALUES ('password_hash', ?1)",
            [hash],
        )
        .map_err(AppError::database)?;
        tx.commit().map_err(AppError::database)?;
        self.authenticated_at = Some(Instant::now());
        self.auth_status()
    }

    pub fn unlock(&mut self, password: Zeroizing<String>) -> AppResult<AuthStatus> {
        if self.retry_after.is_some_and(|t| Instant::now() < t) {
            return Err(AppError::new(
                "RATE_LIMIT",
                "Muitas tentativas. Aguarde 30 segundos antes de tentar novamente.",
            ));
        }
        let hash = self
            .password_hash()?
            .ok_or_else(|| AppError::new("NOT_CONFIGURED", "Configure sua senha primeiro."))?;
        let parsed = PasswordHash::new(&hash)
            .map_err(|_| AppError::new("PASSWORD", "O hash da senha não pôde ser lido."))?;
        if password.len() > 1024
            || Argon2::default()
                .verify_password(password.as_bytes(), &parsed)
                .is_err()
        {
            self.failed_attempts = self.failed_attempts.saturating_add(1);
            if self.failed_attempts >= 5 {
                self.retry_after = Some(Instant::now() + Duration::from_secs(30));
                self.failed_attempts = 0;
            }
            return Err(AppError::new(
                "INVALID_PASSWORD",
                "Senha incorreta. Tente novamente.",
            ));
        }
        self.failed_attempts = 0;
        self.retry_after = None;
        self.authenticated_at = Some(Instant::now());
        self.auth_status()
    }

    pub fn lock(&mut self) -> AppResult<()> {
        self.pending_oauth = None;
        self.authenticated_at = None;
        if let Some((id, _)) = self.running_clock.clone() {
            self.tick_session(&id, "paused")?;
        }
        Ok(())
    }

    pub fn snapshot(&mut self) -> AppResult<Snapshot> {
        self.require_auth()?;
        let tx = self.connection.transaction().map_err(AppError::database)?;
        let areas = {
            let mut statement = tx.prepare("SELECT id, name, description, color, archived, created_at, updated_at FROM study_areas ORDER BY archived, name COLLATE NOCASE, id")
                .map_err(AppError::database)?;
            let rows = statement
                .query_map([], |r| {
                    Ok(StudyArea {
                        id: r.get(0)?,
                        name: r.get(1)?,
                        description: r.get(2)?,
                        color: r.get(3)?,
                        archived: r.get(4)?,
                        created_at: r.get(5)?,
                        updated_at: r.get(6)?,
                    })
                })
                .map_err(AppError::database)?;
            rows.collect::<rusqlite::Result<Vec<_>>>()
                .map_err(AppError::database)?
        };
        let tasks = {
            let mut statement = tx.prepare("SELECT id, title, notes, area_id, priority, status, due_date, estimate_minutes, created_at, updated_at, completed_at, checkpoint_id FROM tasks ORDER BY created_at DESC, id")
                .map_err(AppError::database)?;
            let rows = statement
                .query_map([], |r| {
                    Ok(Task {
                        checkpoint_id: r.get(11)?,
                        id: r.get(0)?,
                        title: r.get(1)?,
                        notes: r.get(2)?,
                        area_id: r.get(3)?,
                        priority: r.get(4)?,
                        status: r.get(5)?,
                        due_date: r.get(6)?,
                        estimate_minutes: r.get(7)?,
                        created_at: r.get(8)?,
                        updated_at: r.get(9)?,
                        completed_at: r.get(10)?,
                    })
                })
                .map_err(AppError::database)?;
            rows.collect::<rusqlite::Result<Vec<_>>>()
                .map_err(AppError::database)?
        };
        let (sessions, goals, checkpoints, checkpoint_evidence) = Self::read_progress(&tx)?;
        let roadmaps = Self::read_roadmaps(&tx)?;
        tx.commit().map_err(AppError::database)?;
        Ok(Snapshot {
            roadmaps,
            areas,
            tasks,
            sessions,
            goals,
            checkpoints,
            checkpoint_evidence,
        })
    }

    pub fn save_area(&mut self, input: AreaInput) -> AppResult<()> {
        self.require_auth()?;
        validation::area(&input)?;
        let timestamp = now();
        let tx = self.connection.transaction().map_err(AppError::database)?;
        if let Some(id) = input.id {
            let changed = tx.execute("UPDATE study_areas SET name=?1, description=?2, color=?3, updated_at=?4 WHERE id=?5",
                params![input.name.trim(), input.description.trim(), input.color, timestamp, id]).map_err(AppError::database)?;
            if changed == 0 {
                return Err(AppError::not_found());
            }
        } else {
            tx.execute("INSERT INTO study_areas(id, name, description, color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                params![uuid::Uuid::new_v4().to_string(), input.name.trim(), input.description.trim(), input.color, timestamp])
                .map_err(AppError::database)?;
        }
        tx.commit().map_err(AppError::database)
    }

    pub fn archive_area(&mut self, id: String, archived: bool) -> AppResult<()> {
        self.require_auth()?;
        validation::id(&id)?;
        let changed = self
            .connection
            .execute(
                "UPDATE study_areas SET archived=?1, updated_at=?2 WHERE id=?3",
                params![archived, now(), id],
            )
            .map_err(AppError::database)?;
        if changed == 0 {
            return Err(AppError::not_found());
        }
        Ok(())
    }

    pub fn delete_area(&mut self, id: String) -> AppResult<()> {
        self.require_auth()?;
        validation::id(&id)?;
        let tx = self.connection.transaction().map_err(AppError::database)?;
        let linked_goal: bool = tx
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM goals WHERE area_id=?1)",
                [&id],
                |r| r.get(0),
            )
            .map_err(AppError::database)?;
        if linked_goal {
            return Err(AppError::validation("Remova ou redefina o vínculo das metas desta área antes de excluí-la, para preservar o cálculo de progresso."));
        }
        let changed = tx
            .execute("DELETE FROM study_areas WHERE id=?1", [id])
            .map_err(AppError::database)?;
        if changed == 0 {
            return Err(AppError::not_found());
        }
        tx.commit().map_err(AppError::database)
    }

    pub fn save_task(&mut self, input: TaskInput) -> AppResult<()> {
        self.require_auth()?;
        if let Some(checkpoint) = &input.checkpoint_id {
            validation::id(checkpoint)?;
        }
        validation::task(&input)?;
        let timestamp = now();
        let tx = self.connection.transaction().map_err(AppError::database)?;
        if let Some(area_id) = &input.area_id {
            let archived: Option<bool> = tx
                .query_row(
                    "SELECT archived FROM study_areas WHERE id=?1",
                    [area_id],
                    |r| r.get(0),
                )
                .optional()
                .map_err(AppError::database)?;
            let prior_area: Option<String> = if let Some(task_id) = &input.id {
                tx.query_row("SELECT area_id FROM tasks WHERE id=?1", [task_id], |r| {
                    r.get(0)
                })
                .optional()
                .map_err(AppError::database)?
                .flatten()
            } else {
                None
            };
            if archived.is_none()
                || (archived == Some(true) && prior_area.as_ref() != Some(area_id))
            {
                return Err(AppError::validation("Escolha uma área ativa."));
            }
        }
        if let Some(id) = input.id {
            let changed = tx.execute(
                "UPDATE tasks SET title=?1, notes=?2, area_id=?3, priority=?4, status=?5, due_date=?6, estimate_minutes=?7, updated_at=?8, completed_at=CASE WHEN ?5='done' THEN COALESCE(completed_at, ?8) ELSE NULL END,checkpoint_id=?10 WHERE id=?9",
                params![input.title.trim(), input.notes.trim(), input.area_id, input.priority, input.status, input.due_date, input.estimate_minutes, timestamp, id, input.checkpoint_id])
                .map_err(AppError::database)?;
            if changed == 0 {
                return Err(AppError::not_found());
            }
        } else {
            let completed = if input.status == "done" {
                Some(&timestamp)
            } else {
                None
            };
            tx.execute(
                "INSERT INTO tasks(id, title, notes, area_id, priority, status, due_date, estimate_minutes, created_at, updated_at, completed_at, checkpoint_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, ?10, ?11)",
                params![uuid::Uuid::new_v4().to_string(), input.title.trim(), input.notes.trim(), input.area_id, input.priority, input.status, input.due_date, input.estimate_minutes, timestamp, completed, input.checkpoint_id])
                .map_err(AppError::database)?;
        }
        tx.commit().map_err(AppError::database)
    }

    pub fn delete_task(&mut self, id: String) -> AppResult<()> {
        self.require_auth()?;
        validation::id(&id)?;
        let changed = self
            .connection
            .execute("DELETE FROM tasks WHERE id=?1", [id])
            .map_err(AppError::database)?;
        if changed == 0 {
            return Err(AppError::not_found());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests;

mod agenda;
#[cfg(test)]
mod agenda_tests;
mod backup;
mod google;
mod library;
mod organizer;
mod progress;
mod tracks;
mod tutors;

#[cfg(test)]
mod library_tests;

#[cfg(test)]
mod progress_tests;
