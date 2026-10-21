use super::*;
use chrono::{Datelike, Days, LocalResult, NaiveDate, NaiveTime, TimeZone};
fn invalid() -> AppError {
    AppError::validation("Confira o formato, os limites e os campos da agenda/importação.")
}
fn date(s: &str) -> AppResult<NaiveDate> {
    if s.len() != 10 {
        return Err(invalid());
    }
    NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(|_| invalid())
}
fn text(s: &str, min: usize, max: usize) -> AppResult<()> {
    if s.contains('\0') || !(min..=max).contains(&s.trim().chars().count()) {
        Err(invalid())
    } else {
        Ok(())
    }
}
fn recurrence(r: &Recurrence) -> AppResult<()> {
    validation::id(&r.id)?;
    text(&r.title, 1, 160)?;
    text(&r.notes, 0, 4000)?;
    if r.weekdays == 0 || r.weekdays > 127 || r.local_time.len() != 5 {
        return Err(invalid());
    }
    NaiveTime::parse_from_str(&r.local_time, "%H:%M").map_err(|_| invalid())?;
    r.timezone.parse::<chrono_tz::Tz>().map_err(|_| invalid())?;
    let start = date(&r.start_date)?;
    if let Some(end) = &r.end_date {
        if date(end)? < start {
            return Err(invalid());
        }
    }
    Ok(())
}
pub(super) fn parse_import(format: &str, content: &str) -> AppResult<Vec<ImportedTaskInput>> {
    if content.len() > 262144 || content.trim().is_empty() {
        return Err(invalid());
    }
    let rows: Vec<ImportedTaskInput> = match format {
        "json" => serde_json::from_str(content).map_err(|_| invalid())?,
        "csv" => {
            let mut reader = csv::ReaderBuilder::new()
                .trim(csv::Trim::All)
                .from_reader(content.as_bytes());
            let headers = reader.headers().map_err(|_| invalid())?;
            let expected = [
                "externalId",
                "title",
                "instructions",
                "schedule",
                "url",
                "notes",
            ];
            if headers.len() != expected.len() || headers.iter().zip(expected).any(|(a, b)| a != b)
            {
                return Err(invalid());
            }
            reader
                .deserialize()
                .collect::<Result<Vec<_>, _>>()
                .map_err(|_| invalid())?
        }
        _ => return Err(invalid()),
    };
    if rows.is_empty() || rows.len() > 200 {
        return Err(invalid());
    }
    let mut seen = std::collections::HashSet::new();
    for row in &rows {
        text(&row.external_id, 1, 120)?;
        text(&row.title, 1, 160)?;
        text(&row.instructions, 0, 12000)?;
        text(&row.schedule, 0, 2000)?;
        text(&row.notes, 0, 4000)?;
        text(&row.url, 0, 2000)?;
        if !row.url.is_empty()
            && (!row.url.starts_with("https://") || row.url.chars().any(char::is_control))
        {
            return Err(invalid());
        }
        if row.external_id.trim() != row.external_id || !seen.insert(&row.external_id) {
            return Err(invalid());
        }
    }
    Ok(rows)
}
fn rules(connection: &Connection) -> AppResult<Vec<Recurrence>> {
    let mut q=connection.prepare("SELECT id,title,notes,weekdays,local_time,timezone,start_date,end_date,enabled FROM recurrences ORDER BY created_at,id").map_err(AppError::database)?;
    let result = q
        .query_map([], |r| {
            Ok(Recurrence {
                id: r.get(0)?,
                title: r.get(1)?,
                notes: r.get(2)?,
                weekdays: r.get(3)?,
                local_time: r.get(4)?,
                timezone: r.get(5)?,
                start_date: r.get(6)?,
                end_date: r.get(7)?,
                enabled: r.get(8)?,
            })
        })
        .map_err(AppError::database)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::database)?;
    Ok(result)
}
pub(super) fn expand(rules: &[Recurrence], from: &str, to: &str) -> AppResult<Vec<Occurrence>> {
    let from = date(from)?;
    let to = date(to)?;
    if to < from || (to - from).num_days() > 61 {
        return Err(invalid());
    }
    let mut out = vec![];
    for rule in rules.iter().filter(|r| r.enabled) {
        recurrence(rule)?;
        let timezone: chrono_tz::Tz = rule.timezone.parse().map_err(|_| invalid())?;
        let time = NaiveTime::parse_from_str(&rule.local_time, "%H:%M").map_err(|_| invalid())?;
        for offset in 0..=(to - from).num_days() {
            let day = from
                .checked_add_days(Days::new(offset as u64))
                .ok_or_else(invalid)?;
            let key = day.to_string();
            if key < rule.start_date
                || rule.end_date.as_ref().is_some_and(|end| &key > end)
                || (rule.weekdays & (1 << day.weekday().num_days_from_monday())) == 0
            {
                continue;
            }
            let (starts_at, warning) = match timezone.from_local_datetime(&day.and_time(time)) {
                LocalResult::Single(value) => (Some(value.with_timezone(&Utc).to_rfc3339()), None),
                LocalResult::Ambiguous(first, _) => (
                    Some(first.with_timezone(&Utc).to_rfc3339()),
                    Some(
                        "Horário repetido por mudança de fuso: usada a primeira ocorrência.".into(),
                    ),
                ),
                LocalResult::None => (
                    None,
                    Some("Horário inexistente por mudança de fuso. Ajuste o agendamento.".into()),
                ),
            };
            out.push(Occurrence {
                recurrence_id: rule.id.clone(),
                date: key,
                starts_at,
                task_id: None,
                materialized: false,
                warning,
            });
        }
    }
    out.sort_by(|a, b| {
        (&a.date, &a.starts_at, &a.recurrence_id).cmp(&(&b.date, &b.starts_at, &b.recurrence_id))
    });
    Ok(out)
}
impl Store {
    pub fn preview_import(
        &mut self,
        format: String,
        content: String,
    ) -> AppResult<Vec<ImportedTaskInput>> {
        self.require_auth()?;
        parse_import(&format, &content)
    }
    pub fn agenda_snapshot(&mut self, from: String, to: String) -> AppResult<AgendaSnapshot> {
        self.require_auth()?;
        let recurrences = rules(&self.connection)?;
        let mut occurrences = expand(&recurrences, &from, &to)?;
        for item in &mut occurrences {
            let prior:Option<(String,Option<String>)>=self.connection.query_row("SELECT starts_at,task_id FROM recurrence_occurrences WHERE recurrence_id=?1 AND occurrence_date=?2",params![item.recurrence_id,item.date],|r|Ok((r.get(0)?,r.get(1)?))).optional().map_err(AppError::database)?;
            if let Some((time, task)) = prior {
                item.materialized = true;
                item.task_id = task;
                item.starts_at = Some(time);
            }
        }
        let mut q=self.connection.prepare("SELECT id,external_id,title,instructions,schedule,url,notes,updated_at,local_task_id,converted_at FROM imported_chatgpt_tasks ORDER BY updated_at DESC,id").map_err(AppError::database)?;
        let imported = q
            .query_map([], |r| {
                Ok(ImportedTask {
                    id: r.get(0)?,
                    input: ImportedTaskInput {
                        external_id: r.get(1)?,
                        title: r.get(2)?,
                        instructions: r.get(3)?,
                        schedule: r.get(4)?,
                        url: r.get(5)?,
                        notes: r.get(6)?,
                    },
                    updated_at: r.get(7)?,
                    local_task_id: r.get(8)?,
                    converted_at: r.get(9)?,
                })
            })
            .map_err(AppError::database)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(AppError::database)?;
        Ok(AgendaSnapshot {
            recurrences,
            occurrences,
            imported,
        })
    }
    pub fn agenda_action(&mut self, action: AgendaAction) -> AppResult<()> {
        self.require_auth()?;
        let timestamp = now();
        let tx = self.connection.transaction().map_err(AppError::database)?;
        match action {
            AgendaAction::SaveRecurrence { input } => {
                recurrence(&input)?;
                tx.execute("INSERT INTO recurrences VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10) ON CONFLICT(id) DO UPDATE SET title=excluded.title,notes=excluded.notes,weekdays=excluded.weekdays,local_time=excluded.local_time,timezone=excluded.timezone,start_date=excluded.start_date,end_date=excluded.end_date,enabled=excluded.enabled,updated_at=excluded.updated_at",params![input.id,input.title,input.notes,input.weekdays,input.local_time,input.timezone,input.start_date,input.end_date,input.enabled,timestamp]).map_err(AppError::database)?;
            }
            AgendaAction::DeleteRecurrence { id } => {
                validation::id(&id)?;
                tx.execute("DELETE FROM recurrences WHERE id=?1", [id])
                    .map_err(AppError::database)?;
            }
            AgendaAction::Materialize { from, to } => {
                let rules = rules(&tx)?;
                let items = expand(&rules, &from, &to)?;
                for item in items {
                    let exists:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM recurrence_occurrences WHERE recurrence_id=?1 AND occurrence_date=?2)",params![item.recurrence_id,item.date],|r|r.get(0)).map_err(AppError::database)?;
                    if exists || item.starts_at.is_none() {
                        continue;
                    }
                    let rule = rules
                        .iter()
                        .find(|r| r.id == item.recurrence_id)
                        .ok_or_else(invalid)?;
                    let task_id = uuid::Uuid::new_v4().to_string();
                    tx.execute("INSERT INTO tasks(id,title,notes,priority,status,due_date,created_at,updated_at) VALUES (?1,?2,?3,'medium','todo',?4,?5,?5)",params![task_id,rule.title,format!("{}\nAgenda: {} {} ({})",rule.notes,item.date,rule.local_time,rule.timezone),item.date,timestamp]).map_err(AppError::database)?;
                    tx.execute(
                        "INSERT INTO recurrence_occurrences VALUES (?1,?2,?3,?4)",
                        params![item.recurrence_id, item.date, item.starts_at, task_id],
                    )
                    .map_err(AppError::database)?;
                }
            }
            AgendaAction::Import { format, content } => {
                for row in parse_import(&format, &content)? {
                    tx.execute("INSERT INTO imported_chatgpt_tasks(id,external_id,title,instructions,schedule,url,notes,imported_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?8) ON CONFLICT(external_id) DO UPDATE SET title=excluded.title,instructions=excluded.instructions,schedule=excluded.schedule,url=excluded.url,notes=excluded.notes,updated_at=excluded.updated_at",params![uuid::Uuid::new_v4().to_string(),row.external_id,row.title,row.instructions,row.schedule,row.url,row.notes,timestamp]).map_err(AppError::database)?;
                }
            }
            AgendaAction::Convert { id, due_date } => {
                validation::id(&id)?;
                if let Some(due) = &due_date {
                    date(due)?;
                }
                let row:Option<(String,String,String,String,String,Option<String>)>=tx.query_row("SELECT title,instructions,schedule,url,notes,converted_at FROM imported_chatgpt_tasks WHERE id=?1",[&id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?))).optional().map_err(AppError::database)?;
                let (title, instructions, schedule, url, notes, converted) =
                    row.ok_or_else(AppError::not_found)?;
                if converted.is_some() {
                    return Ok(());
                }
                let task_id = uuid::Uuid::new_v4().to_string();
                let detailed_notes=format!("Origem: ChatGPT (importação manual)\n{instructions}\nAgenda informada: {schedule}\n{url}\n{notes}");
                let task_notes = if detailed_notes.chars().count() <= 5000 {
                    detailed_notes
                } else {
                    format!("Origem: ChatGPT (importação manual)\nRegistro de origem: {id}\nAs instruções completas foram preservadas em Tarefas do ChatGPT. Consulte a importação para o texto e a agenda informada.")
                };
                tx.execute("INSERT INTO tasks(id,title,notes,priority,status,due_date,created_at,updated_at) VALUES (?1,?2,?3,'medium','todo',?4,?5,?5)",params![task_id,title,task_notes,due_date,timestamp]).map_err(AppError::database)?;
                tx.execute("UPDATE imported_chatgpt_tasks SET local_task_id=?1,converted_at=?2 WHERE id=?3",params![task_id,timestamp,id]).map_err(AppError::database)?;
            }
            AgendaAction::DeleteImport { id } => {
                validation::id(&id)?;
                tx.execute("DELETE FROM imported_chatgpt_tasks WHERE id=?1", [id])
                    .map_err(AppError::database)?;
            }
        }
        tx.commit().map_err(AppError::database)
    }
}
