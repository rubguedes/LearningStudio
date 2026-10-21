use super::*;
use chrono::{Local, NaiveDate};

fn text(value: &str, min: usize, max: usize) -> AppResult<()> {
    if !(min..=max).contains(&value.trim().chars().count()) || value.contains('\0') {
        return Err(AppError::validation(
            "Preencha os campos respeitando os limites indicados.",
        ));
    }
    Ok(())
}

fn date(value: &str) -> AppResult<NaiveDate> {
    if value.len() != 10 {
        return Err(AppError::validation("Informe uma data válida."));
    }
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| AppError::validation("Informe uma data válida."))
}

fn area(connection: &Connection, id: &Option<String>) -> AppResult<()> {
    if let Some(id) = id {
        validation::id(id)?;
        let exists: bool = connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM study_areas WHERE id=?1)",
                [id],
                |r| r.get(0),
            )
            .map_err(AppError::database)?;
        if !exists {
            return Err(AppError::validation("A área selecionada não existe mais."));
        }
    }
    Ok(())
}

fn session_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<StudySession> {
    Ok(StudySession {
        id: r.get(0)?,
        title: r.get(1)?,
        notes: r.get(2)?,
        area_id: r.get(3)?,
        study_date: r.get(4)?,
        mode: r.get(5)?,
        status: r.get(6)?,
        duration_seconds: r.get(7)?,
        created_at: r.get(8)?,
        updated_at: r.get(9)?,
        completed_at: r.get(10)?,
    })
}

const SESSION_COLUMNS: &str = "id,title,notes,area_id,study_date,mode,status,duration_seconds,created_at,updated_at,completed_at";
pub(super) type ProgressRows = (
    Vec<StudySession>,
    Vec<Goal>,
    Vec<Checkpoint>,
    Vec<CheckpointEvidence>,
);

impl Store {
    pub(super) fn read_progress(connection: &Connection) -> AppResult<ProgressRows> {
        let sessions = {
            let mut query = connection.prepare(&format!("SELECT {SESSION_COLUMNS} FROM study_sessions ORDER BY study_date DESC,created_at DESC,id")).map_err(AppError::database)?;
            let rows = query
                .query_map([], session_row)
                .map_err(AppError::database)?;
            rows.collect::<rusqlite::Result<Vec<_>>>()
                .map_err(AppError::database)?
        };
        let goals = {
            let mut query = connection.prepare("SELECT id,title,area_id,mode,unit,target,manual_value,start_date,due_date,archived,created_at,updated_at FROM goals ORDER BY archived,due_date,id").map_err(AppError::database)?;
            let rows = query
                .query_map([], |r| {
                    Ok(Goal {
                        id: r.get(0)?,
                        title: r.get(1)?,
                        area_id: r.get(2)?,
                        mode: r.get(3)?,
                        unit: r.get(4)?,
                        target: r.get(5)?,
                        manual_value: r.get(6)?,
                        start_date: r.get(7)?,
                        due_date: r.get(8)?,
                        archived: r.get(9)?,
                        created_at: r.get(10)?,
                        updated_at: r.get(11)?,
                    })
                })
                .map_err(AppError::database)?;
            rows.collect::<rusqlite::Result<Vec<_>>>()
                .map_err(AppError::database)?
        };
        let checkpoints = {
            let mut query = connection.prepare("SELECT id,title,description,activity,criteria,area_id,completed_at,created_at,updated_at FROM checkpoints ORDER BY created_at,id").map_err(AppError::database)?;
            let rows = query
                .query_map([], |r| {
                    Ok(Checkpoint {
                        id: r.get(0)?,
                        title: r.get(1)?,
                        description: r.get(2)?,
                        activity: r.get(3)?,
                        criteria: r.get(4)?,
                        area_id: r.get(5)?,
                        completed_at: r.get(6)?,
                        created_at: r.get(7)?,
                        updated_at: r.get(8)?,
                    })
                })
                .map_err(AppError::database)?;
            rows.collect::<rusqlite::Result<Vec<_>>>()
                .map_err(AppError::database)?
        };
        let evidence = {
            let mut query = connection.prepare("SELECT id,checkpoint_id,content,created_at FROM checkpoint_evidence ORDER BY created_at,id").map_err(AppError::database)?;
            let rows = query
                .query_map([], |r| {
                    Ok(CheckpointEvidence {
                        id: r.get(0)?,
                        checkpoint_id: r.get(1)?,
                        content: r.get(2)?,
                        created_at: r.get(3)?,
                    })
                })
                .map_err(AppError::database)?;
            rows.collect::<rusqlite::Result<Vec<_>>>()
                .map_err(AppError::database)?
        };
        Ok((sessions, goals, checkpoints, evidence))
    }

    fn session(&self, id: &str) -> AppResult<StudySession> {
        self.connection
            .query_row(
                &format!("SELECT {SESSION_COLUMNS} FROM study_sessions WHERE id=?1"),
                [id],
                session_row,
            )
            .optional()
            .map_err(AppError::database)?
            .ok_or_else(AppError::not_found)
    }

    pub fn save_session(&mut self, input: SessionInput) -> AppResult<()> {
        self.require_auth()?;
        validation::id(&input.id)?;
        text(&input.title, 1, 160)?;
        text(&input.notes, 0, 5000)?;
        if date(&input.study_date)? > Local::now().date_naive() {
            return Err(AppError::validation(
                "Registre apenas estudos já realizados.",
            ));
        }
        if !(1..=86400).contains(&input.duration_seconds) {
            return Err(AppError::validation(
                "A duração deve ser de 1 segundo a 24 horas.",
            ));
        }
        let tx = self.connection.transaction().map_err(AppError::database)?;
        area(&tx, &input.area_id)?;
        let mode: Option<String> = tx
            .query_row(
                "SELECT mode FROM study_sessions WHERE id=?1",
                [&input.id],
                |r| r.get(0),
            )
            .optional()
            .map_err(AppError::database)?;
        if mode.as_deref().is_some_and(|m| m != "manual") {
            return Err(AppError::validation(
                "O tempo cronometrado não pode ser sobrescrito por um registro manual.",
            ));
        }
        let timestamp = now();
        tx.execute("INSERT INTO study_sessions(id,title,notes,area_id,study_date,mode,status,duration_seconds,created_at,updated_at,completed_at) VALUES (?1,?2,?3,?4,?5,'manual','completed',?6,?7,?7,?7) ON CONFLICT(id) DO UPDATE SET title=excluded.title,notes=excluded.notes,area_id=excluded.area_id,study_date=excluded.study_date,duration_seconds=excluded.duration_seconds,updated_at=excluded.updated_at",
            params![input.id,input.title.trim(),input.notes.trim(),input.area_id,input.study_date,input.duration_seconds,timestamp]).map_err(AppError::database)?;
        tx.commit().map_err(AppError::database)
    }

    pub fn start_session(&mut self, input: SessionInput) -> AppResult<()> {
        self.require_auth()?;
        validation::id(&input.id)?;
        text(&input.title, 1, 160)?;
        text(&input.notes, 0, 5000)?;
        if input.duration_seconds != 0 {
            return Err(AppError::validation("O cronômetro deve começar do zero."));
        }
        let tx = self.connection.transaction().map_err(AppError::database)?;
        area(&tx, &input.area_id)?;
        let existing: Option<String> = tx
            .query_row(
                "SELECT mode FROM study_sessions WHERE id=?1",
                [&input.id],
                |r| r.get(0),
            )
            .optional()
            .map_err(AppError::database)?;
        if let Some(mode) = existing {
            if mode != "timer" {
                return Err(AppError::validation("Identificador já utilizado."));
            }
            return Ok(());
        }
        let active: bool = tx
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM study_sessions WHERE status='running')",
                [],
                |r| r.get(0),
            )
            .map_err(AppError::database)?;
        if active {
            return Err(AppError::new(
                "ACTIVE_SESSION",
                "Pause ou finalize a sessão em andamento antes de iniciar outra.",
            ));
        }
        let timestamp = now();
        tx.execute("INSERT INTO study_sessions(id,title,notes,area_id,study_date,mode,status,duration_seconds,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,'timer','running',0,?6,?6)",
            params![input.id,input.title.trim(),input.notes.trim(),input.area_id,Local::now().date_naive().to_string(),timestamp]).map_err(AppError::database)?;
        tx.commit().map_err(AppError::database)?;
        self.running_clock = Some((input.id, Instant::now()));
        Ok(())
    }

    pub(super) fn tick_session(&mut self, id: &str, requested: &str) -> AppResult<StudySession> {
        let current = self.session(id)?;
        if current.status != "running" {
            return Ok(current);
        }
        let elapsed = self
            .running_clock
            .as_ref()
            .filter(|(active, _)| active == id)
            .map(|(_, tick)| tick.elapsed().as_secs());
        let safe = elapsed.is_some_and(|seconds| seconds <= 45);
        let added = if safe {
            elapsed
                .unwrap_or(0)
                .min((86400 - current.duration_seconds) as u64) as i64
        } else {
            0
        };
        let duration = current.duration_seconds + added;
        let status = if requested == "completed" {
            "completed"
        } else if !safe || duration >= 86400 {
            "paused"
        } else {
            requested
        };
        if status == "completed" && duration == 0 {
            return Err(AppError::validation(
                "Estude por pelo menos um segundo antes de finalizar.",
            ));
        }
        let timestamp = now();
        self.connection.execute("UPDATE study_sessions SET status=?1,duration_seconds=?2,updated_at=?3,completed_at=CASE WHEN ?1='completed' THEN ?3 ELSE NULL END WHERE id=?4",
            params![status,duration,timestamp,id]).map_err(AppError::database)?;
        if status == "running" {
            if let Some((_, tick)) = &mut self.running_clock {
                *tick += Duration::from_secs(added as u64);
            }
        } else {
            self.running_clock = None;
        }
        self.session(id)
    }

    pub fn pulse_session(&mut self, id: String) -> AppResult<StudySession> {
        validation::id(&id)?;
        // Pulsos automáticos não renovam a sessão de autenticação.
        if !self.is_unlocked() {
            self.lock()?;
            return Err(AppError::new("LOCKED", "Sua sessão está bloqueada."));
        }
        self.tick_session(&id, "running")
    }

    pub fn control_session(&mut self, id: String, action: String) -> AppResult<()> {
        self.require_auth()?;
        validation::id(&id)?;
        if !["pause", "resume", "finish"].contains(&action.as_str()) {
            return Err(AppError::validation("Ação de sessão inválida."));
        }
        let current = self.session(&id)?;
        if current.mode != "timer" {
            return Err(AppError::validation("Este registro não possui cronômetro."));
        }
        if current.status == "completed" {
            return if action == "resume" {
                Err(AppError::validation(
                    "Uma sessão finalizada não pode ser retomada.",
                ))
            } else {
                Ok(())
            };
        }
        if action == "resume" {
            if current.status == "running" {
                return Ok(());
            }
            let active: bool = self
                .connection
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM study_sessions WHERE status='running')",
                    [],
                    |r| r.get(0),
                )
                .map_err(AppError::database)?;
            if active {
                return Err(AppError::new(
                    "ACTIVE_SESSION",
                    "Já existe uma sessão em andamento.",
                ));
            }
            if current.duration_seconds >= 86400 {
                return Err(AppError::validation(
                    "Finalize esta sessão antes de iniciar outra.",
                ));
            }
            self.connection
                .execute(
                    "UPDATE study_sessions SET status='running',updated_at=?1 WHERE id=?2",
                    params![now(), id],
                )
                .map_err(AppError::database)?;
            self.running_clock = Some((id, Instant::now()));
        } else if current.status == "running" {
            self.tick_session(
                &id,
                if action == "finish" {
                    "completed"
                } else {
                    "paused"
                },
            )?;
        } else if action == "finish" {
            if current.duration_seconds == 0 {
                return Err(AppError::validation(
                    "A sessão ainda não possui tempo registrado.",
                ));
            }
            let timestamp = now();
            self.connection.execute("UPDATE study_sessions SET status='completed',completed_at=?1,updated_at=?1 WHERE id=?2",params![timestamp,id]).map_err(AppError::database)?;
        }
        Ok(())
    }

    pub fn save_goal(&mut self, input: GoalInput) -> AppResult<()> {
        self.require_auth()?;
        validation::id(&input.id)?;
        text(&input.title, 1, 160)?;
        text(&input.unit, 1, 40)?;
        if !["manual", "study_minutes", "task_count"].contains(&input.mode.as_str())
            || !(1..=1000000).contains(&input.target)
            || !(0..=1000000000).contains(&input.manual_value)
            || (input.mode != "manual" && input.manual_value != 0)
        {
            return Err(AppError::validation(
                "Confira o tipo, o alvo e o progresso da meta.",
            ));
        }
        if date(&input.due_date)? < date(&input.start_date)? {
            return Err(AppError::validation(
                "O prazo deve ser igual ou posterior à data inicial.",
            ));
        }
        let tx = self.connection.transaction().map_err(AppError::database)?;
        area(&tx, &input.area_id)?;
        let unit = match input.mode.as_str() {
            "study_minutes" => "minutos",
            "task_count" => "tarefas",
            _ => input.unit.trim(),
        };
        let timestamp = now();
        tx.execute("INSERT INTO goals(id,title,area_id,mode,unit,target,manual_value,start_date,due_date,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10) ON CONFLICT(id) DO UPDATE SET title=excluded.title,area_id=excluded.area_id,mode=excluded.mode,unit=excluded.unit,target=excluded.target,manual_value=excluded.manual_value,start_date=excluded.start_date,due_date=excluded.due_date,updated_at=excluded.updated_at",
            params![input.id,input.title.trim(),input.area_id,input.mode,unit,input.target,input.manual_value,input.start_date,input.due_date,timestamp]).map_err(AppError::database)?;
        tx.commit().map_err(AppError::database)
    }

    pub fn archive_goal(&mut self, id: String, archived: bool) -> AppResult<()> {
        self.require_auth()?;
        validation::id(&id)?;
        let changed = self
            .connection
            .execute(
                "UPDATE goals SET archived=?1,updated_at=?2 WHERE id=?3",
                params![archived, now(), id],
            )
            .map_err(AppError::database)?;
        if changed == 0 {
            return Err(AppError::not_found());
        }
        Ok(())
    }

    pub fn save_checkpoint(&mut self, input: CheckpointInput) -> AppResult<()> {
        self.require_auth()?;
        validation::id(&input.id)?;
        text(&input.title, 1, 160)?;
        text(&input.description, 0, 2000)?;
        text(&input.activity, 1, 2000)?;
        text(&input.criteria, 1, 2000)?;
        let tx = self.connection.transaction().map_err(AppError::database)?;
        area(&tx, &input.area_id)?;
        let previous: Option<(String, String, Option<String>)> = tx
            .query_row(
                "SELECT activity,criteria,completed_at FROM checkpoints WHERE id=?1",
                [&input.id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .optional()
            .map_err(AppError::database)?;
        if previous.is_some_and(|(activity, criteria, completed)| {
            completed.is_some()
                && (activity != input.activity.trim() || criteria != input.criteria.trim())
        }) {
            return Err(AppError::validation(
                "Reabra o checkpoint antes de alterar sua atividade ou critérios.",
            ));
        }
        let timestamp = now();
        tx.execute("INSERT INTO checkpoints(id,title,description,activity,criteria,area_id,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?7) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,activity=excluded.activity,criteria=excluded.criteria,area_id=excluded.area_id,updated_at=excluded.updated_at",
            params![input.id,input.title.trim(),input.description.trim(),input.activity.trim(),input.criteria.trim(),input.area_id,timestamp]).map_err(AppError::database)?;
        tx.commit().map_err(AppError::database)
    }

    pub fn complete_checkpoint(&mut self, id: String, evidence: String) -> AppResult<()> {
        self.require_auth()?;
        validation::id(&id)?;
        text(&evidence, 1, 4000)?;
        let tx = self.connection.transaction().map_err(AppError::database)?;
        let completed: Option<String> = tx
            .query_row(
                "SELECT completed_at FROM checkpoints WHERE id=?1",
                [&id],
                |r| r.get(0),
            )
            .optional()
            .map_err(AppError::database)?
            .ok_or_else(AppError::not_found)?;
        if completed.is_some() {
            return Ok(());
        }
        let timestamp = now();
        tx.execute("INSERT INTO checkpoint_evidence(id,checkpoint_id,content,created_at) VALUES (?1,?2,?3,?4)",params![uuid::Uuid::new_v4().to_string(),id,evidence.trim(),timestamp]).map_err(AppError::database)?;
        tx.execute(
            "UPDATE checkpoints SET completed_at=?1,updated_at=?1 WHERE id=?2",
            params![timestamp, id],
        )
        .map_err(AppError::database)?;
        tx.commit().map_err(AppError::database)
    }

    pub fn reopen_checkpoint(&mut self, id: String) -> AppResult<()> {
        self.require_auth()?;
        validation::id(&id)?;
        let changed = self
            .connection
            .execute(
                "UPDATE checkpoints SET completed_at=NULL,updated_at=?1 WHERE id=?2",
                params![now(), id],
            )
            .map_err(AppError::database)?;
        if changed == 0 {
            return Err(AppError::not_found());
        }
        Ok(())
    }

    pub fn delete_progress(&mut self, kind: String, id: String) -> AppResult<()> {
        self.require_auth()?;
        validation::id(&id)?;
        let sql = match kind.as_str() {
            "session" => "DELETE FROM study_sessions WHERE id=?1 AND status<>'running'",
            "goal" => "DELETE FROM goals WHERE id=?1",
            "checkpoint" => "DELETE FROM checkpoints WHERE id=?1",
            _ => return Err(AppError::validation("Tipo de registro inválido.")),
        };
        let changed = self
            .connection
            .execute(sql, [id])
            .map_err(AppError::database)?;
        if changed == 0 {
            return Err(AppError::validation("Registro não encontrado ou sessão ainda em andamento. Pause o cronômetro antes de excluir."));
        }
        Ok(())
    }
}
