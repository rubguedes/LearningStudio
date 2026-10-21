use super::*;
use chrono::{Days, Local, NaiveDate};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::{json, Value};

pub(super) fn validate_backup(connection: &Connection) -> AppResult<()> {
    let mut q = connection
        .prepare("SELECT content FROM language_profiles")
        .map_err(AppError::database)?;
    for raw in q
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(AppError::database)?
    {
        profile_valid(&parse::<LanguageProfile>(
            &raw.map_err(AppError::database)?,
        )?)?;
    }
    let mut q = connection
        .prepare("SELECT kind,content FROM track_documents")
        .map_err(AppError::database)?;
    for raw in q
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(AppError::database)?
    {
        let (kind, s) = raw.map_err(AppError::database)?;
        match kind.as_str() {
            "plan" => plan_valid(&parse::<TrackPlan>(&s)?)?,
            "career" => {
                parse::<CareerContent>(&s)?;
            }
            "career_preferences" => {
                let value: Value = parse(&s)?;
                text(
                    value
                        .get("targetRole")
                        .and_then(Value::as_str)
                        .ok_or_else(invalid)?,
                    1,
                    160,
                )?;
                text(
                    value
                        .get("region")
                        .and_then(Value::as_str)
                        .ok_or_else(invalid)?,
                    0,
                    160,
                )?;
            }
            "resume" => {
                let r = parse::<ResumeVersion>(&s)?;
                text(&r.text, 1, 30000)?;
                list(&r.skills, 0, 100)?;
                if !(1..=365).contains(&r.review_days) {
                    return Err(invalid());
                }
            }
            "resume_proposal" => {
                let p = parse::<ResumeProposal>(&s)?;
                validation::id(&p.original_id)?;
                list(&p.suggestions, 1, 20)?;
                list(&p.uncertainties, 1, 10)?;
            }
            "job" => {
                let j = parse::<JobRecord>(&s)?;
                https(&j.url)?;
                date(&j.date)?;
                list(&j.requirements, 1, 100)?;
            }
            "source" => {
                let source = parse::<SourceRecord>(&s)?;
                https(&source.url)?;
                date(&source.date)?;
                text(&source.claim, 1, 4000)?;
            }
            "github" => {
                let v = parse::<Value>(&s)?;
                if v.get("repository").and_then(Value::as_str).is_none() {
                    return Err(invalid());
                }
            }
            _ => return Err(invalid()),
        }
    }
    let mut q = connection
        .prepare("SELECT base64 FROM lesson_pdfs")
        .map_err(AppError::database)?;
    for raw in q
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(AppError::database)?
    {
        use base64::Engine;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(raw.map_err(AppError::database)?)
            .map_err(|_| invalid())?;
        if bytes.len() > 524288 || !bytes.starts_with(b"%PDF-") {
            return Err(invalid());
        }
    }
    let mut q = connection
        .prepare("SELECT feedback FROM pdf_reviews")
        .map_err(AppError::database)?;
    for raw in q
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(AppError::database)?
    {
        parse::<Feedback>(&raw.map_err(AppError::database)?)?;
    }
    Ok(())
}

fn invalid() -> AppError {
    AppError::validation("Confira os campos da trilha e os limites indicados.")
}
fn text(s: &str, min: usize, max: usize) -> AppResult<()> {
    if s.contains('\0') || !(min..=max).contains(&s.trim().chars().count()) {
        Err(invalid())
    } else {
        Ok(())
    }
}
fn parse<T: DeserializeOwned>(s: &str) -> AppResult<T> {
    serde_json::from_str(s).map_err(|_| invalid())
}
fn encode<T: Serialize>(value: &T) -> AppResult<String> {
    serde_json::to_string(value).map_err(|_| invalid())
}
fn date(s: &str) -> AppResult<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(|_| invalid())
}
fn list(v: &[String], min: usize, max: usize) -> AppResult<()> {
    if !(min..=max).contains(&v.len()) {
        return Err(invalid());
    }
    for s in v {
        text(s, 1, 2000)?;
    }
    Ok(())
}
fn https(s: &str) -> AppResult<()> {
    let u = reqwest::Url::parse(s).map_err(|_| invalid())?;
    if s.len() > 2000
        || u.scheme() != "https"
        || u.host_str().is_none()
        || !u.username().is_empty()
        || u.password().is_some()
    {
        return Err(invalid());
    }
    Ok(())
}
pub(super) fn profile_valid(p: &LanguageProfile) -> AppResult<()> {
    validation::id(&p.id)?;
    text(&p.language, 1, 80)?;
    for l in [&p.current_level, &p.target_level] {
        if !["A1", "A2", "B1", "B2", "C1", "C2"].contains(&l.as_str()) {
            return Err(invalid());
        }
    }
    if p.current_level >= p.target_level
        || !(5..=480).contains(&p.minutes_per_day)
        || p.weekdays.is_empty()
        || p.weekdays.len() > 7
        || p.weekdays.iter().any(|d| *d > 6)
    {
        return Err(invalid());
    }
    let mut days = p.weekdays.clone();
    days.sort();
    days.dedup();
    if days.len() != p.weekdays.len() {
        return Err(invalid());
    }
    date(&p.deadline)?;
    Ok(())
}
fn plan_valid(plan: &TrackPlan) -> AppResult<()> {
    text(&plan.title, 1, 160)?;
    list(&plan.assumptions, 1, 10)?;
    if plan.steps.is_empty() || plan.steps.len() > 30 {
        return Err(invalid());
    }
    for s in &plan.steps {
        text(&s.title, 1, 160)?;
        text(&s.activity, 1, 2000)?;
        text(&s.criteria, 1, 2000)?;
        text(&s.review, 1, 2000)?;
        if !(5..=10000).contains(&s.minutes) {
            return Err(invalid());
        }
    }
    Ok(())
}
fn capacity(p: &LanguageProfile) -> AppResult<u64> {
    use chrono::Datelike;
    let mut day = Local::now().date_naive();
    let end = date(&p.deadline)?;
    let mut total = 0;
    if end < day || (end - day).num_days() > 3650 {
        return Err(AppError::validation(
            "Escolha um prazo futuro de até dez anos.",
        ));
    }
    while day <= end {
        if p.weekdays.contains(&day.weekday().num_days_from_monday()) {
            total += p.minutes_per_day as u64;
        }
        day = day.checked_add_days(Days::new(1)).ok_or_else(invalid)?;
    }
    Ok(total)
}
fn feasible(p: &LanguageProfile, plan: &TrackPlan) -> AppResult<()> {
    plan_valid(plan)?;
    if plan.steps.iter().map(|s| s.minutes as u64).sum::<u64>() > capacity(p)? {
        return Err(AppError::validation("A carga proposta excede sua disponibilidade até o prazo. Aumente o prazo ou reduza a carga antes de salvar."));
    }
    Ok(())
}

impl Store {
    pub fn lesson_pdf(&mut self, lesson_id: &str, import: bool) -> AppResult<String> {
        use base64::Engine;
        use std::io::{Read, Write};
        self.require_auth()?;
        validation::id(lesson_id)?;
        let content: String = self
            .connection
            .query_row(
                "SELECT content FROM english_lessons WHERE id=?1",
                [lesson_id],
                |r| r.get(0),
            )
            .optional()
            .map_err(AppError::database)?
            .ok_or_else(AppError::not_found)?;
        let lesson: EnglishLesson = parse(&content)?;
        if import {
            let Some(path) = rfd::FileDialog::new()
                .set_title("Importar versão anotada (até 512 KiB)")
                .add_filter("PDF", &["pdf"])
                .pick_file()
            else {
                return Ok("Importação cancelada.".into());
            };
            let mut bytes = vec![];
            std::fs::File::open(&path)
                .map_err(|_| invalid())?
                .take(524289)
                .read_to_end(&mut bytes)
                .map_err(|_| invalid())?;
            if bytes.len() > 524288
                || !bytes.starts_with(b"%PDF-")
                || !bytes.windows(5).any(|b| b == b"%%EOF")
            {
                return Err(AppError::validation("Escolha um PDF padrão de até 512 KiB. O arquivo não será executado nem aberto automaticamente."));
            }
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Lição anotada.pdf");
            text(name, 1, 255)?;
            self.connection
                .execute(
                    "INSERT INTO lesson_pdfs VALUES(?1,?2,?3,?4,'',?5)",
                    params![
                        uuid::Uuid::new_v4().to_string(),
                        lesson_id,
                        name,
                        base64::engine::general_purpose::STANDARD.encode(&bytes),
                        now()
                    ],
                )
                .map_err(AppError::database)?;
            Ok("Versão anotada preservada. Para corrigir, confirme sua transcrição; OCR manuscrito não está configurado.".into())
        } else {
            let encoded = encode(&lesson)?;
            if encoded.chars().any(|c| {
                c as u32 > 255
                    && !matches!(
                        c,
                        '\u{2019}' | '\u{201c}' | '\u{201d}' | '\u{2013}' | '\u{2014}'
                    )
            }) {
                return Err(AppError::validation("O PDF desta versão suporta alfabeto latino. Esta lição contém caracteres ainda não suportados; seu conteúdo permanece salvo no aplicativo."));
            }
            let Some(path) = rfd::FileDialog::new()
                .set_title("Exportar lição A4")
                .set_file_name(format!("Licao-{lesson_id}.pdf"))
                .add_filter("PDF", &["pdf"])
                .save_file()
            else {
                return Ok("Exportação cancelada.".into());
            };
            let bytes = crate::pdf::lesson(&lesson);
            std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(path)
                .and_then(|mut f| {
                    f.write_all(&bytes)?;
                    f.sync_all()
                })
                .map_err(|_| {
                    AppError::validation("Escolha um novo nome em uma pasta gravável para o PDF.")
                })?;
            Ok("Lição PDF A4 exportada. Compatibilidade específica com Samsung Notes/S Pen ainda não testada.".into())
        }
    }
    fn document<T: Serialize>(
        &self,
        kind: &str,
        profile: Option<&str>,
        value: &T,
    ) -> AppResult<()> {
        self.connection
            .execute(
                "INSERT INTO track_documents VALUES(?1,?2,?3,?4,?5)",
                params![
                    uuid::Uuid::new_v4().to_string(),
                    profile,
                    kind,
                    encode(value)?,
                    now()
                ],
            )
            .map_err(AppError::database)?;
        Ok(())
    }
    fn document_value<T: DeserializeOwned>(&self, id: &str, kind: &str) -> AppResult<T> {
        validation::id(id)?;
        let raw: String = self
            .connection
            .query_row(
                "SELECT content FROM track_documents WHERE id=?1 AND kind=?2",
                params![id, kind],
                |r| r.get(0),
            )
            .optional()
            .map_err(AppError::database)?
            .ok_or_else(AppError::not_found)?;
        parse(&raw)
    }
    fn profile(&self, id: &str) -> AppResult<LanguageProfile> {
        validation::id(id)?;
        let raw: String = self
            .connection
            .query_row(
                "SELECT content FROM language_profiles WHERE id=?1",
                [id],
                |r| r.get(0),
            )
            .optional()
            .map_err(AppError::database)?
            .ok_or_else(AppError::not_found)?;
        parse(&raw)
    }
    pub fn tracks_snapshot(&mut self) -> AppResult<TracksSnapshot> {
        self.require_auth()?;
        // Import feedback idempotently; AI findings require the student's confirmation.
        let evaluations: Vec<(String, String, String)> = {
            let mut q=self.connection.prepare("SELECT e.id,e.feedback,COALESCE(l.content,c.content,'{}') FROM evaluation_results e LEFT JOIN english_submissions s ON s.id=e.english_submission_id LEFT JOIN english_lessons l ON l.id=s.lesson_id LEFT JOIN code_submissions cs ON cs.id=e.code_submission_id LEFT JOIN coding_challenges c ON c.id=cs.challenge_id WHERE e.source IN ('openai','ollama')").map_err(AppError::database)?;
            let rows = q
                .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
                .map_err(AppError::database)?
                .collect::<rusqlite::Result<_>>()
                .map_err(AppError::database)?;
            rows
        };
        for (id, raw, context) in evaluations {
            let f: Feedback = parse(&raw)?;
            let v: Value = parse(&context)?;
            let topic = v.get("title").and_then(Value::as_str).unwrap_or("Prática");
            for finding in f.findings {
                self.connection.execute("INSERT INTO practice_errors VALUES(?1,?2,?3,?4,?5,?6,?7,2,'unconfirmed',?8) ON CONFLICT(evaluation_id,category,excerpt) DO NOTHING",params![uuid::Uuid::new_v4().to_string(),id,topic,finding.category,finding.excerpt,finding.suggestion,finding.explanation,now()]).map_err(AppError::database)?;
            }
        }
        let profiles = {
            let mut q = self
                .connection
                .prepare("SELECT content FROM language_profiles ORDER BY updated_at DESC,id")
                .map_err(AppError::database)?;
            let rows = q
                .query_map([], |r| r.get::<_, String>(0))
                .map_err(AppError::database)?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(AppError::database)?;
            rows.iter()
                .map(|s| parse(s))
                .collect::<AppResult<Vec<_>>>()?
        };
        let documents = {
            let mut q=self.connection.prepare("SELECT id,profile_id,kind,content,created_at FROM track_documents ORDER BY created_at DESC,id").map_err(AppError::database)?;
            let rows = q
                .query_map([], |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, Option<String>>(1)?,
                        r.get::<_, String>(2)?,
                        r.get::<_, String>(3)?,
                        r.get::<_, String>(4)?,
                    ))
                })
                .map_err(AppError::database)?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(AppError::database)?;
            rows.into_iter()
                .map(|(id, profile_id, kind, s, created_at)| {
                    Ok(TrackDocument {
                        id,
                        profile_id,
                        kind,
                        content: parse(&s)?,
                        created_at,
                    })
                })
                .collect::<AppResult<Vec<_>>>()?
        };
        let errors = {
            let mut q=self.connection.prepare("SELECT e.id,e.topic,e.category,e.excerpt,e.correction,e.explanation,e.severity,e.classification,(SELECT COUNT(*) FROM practice_errors p WHERE lower(p.category)=lower(e.category) AND lower(p.topic)=lower(e.topic) AND p.classification='error'),(SELECT COUNT(*) FROM practice_reviews r WHERE r.error_id=e.id),(SELECT COALESCE(SUM(recalled),0) FROM practice_reviews r WHERE r.error_id=e.id),COALESCE((SELECT next_review FROM practice_reviews r WHERE r.error_id=e.id ORDER BY reviewed_date DESC LIMIT 1),substr(e.created_at,1,10)) FROM practice_errors e ORDER BY e.severity DESC,e.created_at").map_err(AppError::database)?;
            let rows = q
                .query_map([], |r| {
                    Ok(PracticeError {
                        id: r.get(0)?,
                        topic: r.get(1)?,
                        category: r.get(2)?,
                        excerpt: r.get(3)?,
                        correction: r.get(4)?,
                        explanation: r.get(5)?,
                        severity: r.get(6)?,
                        classification: r.get(7)?,
                        repetitions: r.get(8)?,
                        reviews: r.get(9)?,
                        successes: r.get(10)?,
                        next_review: r.get(11)?,
                    })
                })
                .map_err(AppError::database)?
                .collect::<rusqlite::Result<_>>()
                .map_err(AppError::database)?;
            rows
        };
        let pdfs = {
            let mut q = self
                .connection
                .prepare(
                    "SELECT id,lesson_id,name,created_at FROM lesson_pdfs ORDER BY created_at DESC",
                )
                .map_err(AppError::database)?;
            let rows = q
                .query_map([], |r| {
                    Ok(LessonPdf {
                        id: r.get(0)?,
                        lesson_id: r.get(1)?,
                        name: r.get(2)?,
                        created_at: r.get(3)?,
                    })
                })
                .map_err(AppError::database)?
                .collect::<rusqlite::Result<_>>()
                .map_err(AppError::database)?;
            rows
        };
        let pdf_reviews = {
            let mut q=self.connection.prepare("SELECT id,pdf_id,transcription,feedback,created_at FROM pdf_reviews ORDER BY created_at DESC,id").map_err(AppError::database)?;
            let rows = q
                .query_map([], |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, String>(2)?,
                        r.get::<_, String>(3)?,
                        r.get::<_, String>(4)?,
                    ))
                })
                .map_err(AppError::database)?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(AppError::database)?;
            rows.into_iter()
                .map(|(id, pdf_id, transcription, raw, created_at)| {
                    Ok(PdfReview {
                        id,
                        pdf_id,
                        transcription,
                        feedback: parse(&raw)?,
                        created_at,
                    })
                })
                .collect::<AppResult<Vec<_>>>()?
        };
        Ok(TracksSnapshot {
            profiles,
            documents,
            errors,
            pdfs,
            pdf_reviews,
        })
    }
    pub fn tracks_action(&mut self, action: TracksAction) -> AppResult<()> {
        self.require_auth()?;
        match action {
            TracksAction::ExportPdf { id } => {
                use base64::Engine;
                use std::io::Write;
                validation::id(&id)?;
                let (name, encoded): (String, String) = self
                    .connection
                    .query_row(
                        "SELECT name,base64 FROM lesson_pdfs WHERE id=?1",
                        [id],
                        |r| Ok((r.get(0)?, r.get(1)?)),
                    )
                    .optional()
                    .map_err(AppError::database)?
                    .ok_or_else(AppError::not_found)?;
                let bytes = base64::engine::general_purpose::STANDARD
                    .decode(encoded)
                    .map_err(|_| invalid())?;
                let Some(path) = rfd::FileDialog::new()
                    .set_title("Exportar versão anotada preservada")
                    .set_file_name(name)
                    .add_filter("PDF", &["pdf"])
                    .save_file()
                else {
                    return Ok(());
                };
                std::fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(path)
                    .and_then(|mut f| {
                        f.write_all(&bytes)?;
                        f.sync_all()
                    })
                    .map_err(|_| {
                        AppError::validation("Escolha um novo nome em uma pasta gravável.")
                    })?;
            }
            TracksAction::SaveCareerPreferences {
                target_role,
                region,
            } => {
                text(&target_role, 1, 160)?;
                text(&region, 0, 160)?;
                self.document(
                    "career_preferences",
                    None,
                    &json!({"targetRole":target_role,"region":region}),
                )?;
            }
            TracksAction::GenerateLanguageLesson {
                profile_id,
                topic,
                consent,
            } => {
                text(&topic, 1, 160)?;
                let profile = self.profile(&profile_id)?;
                let mut lesson:EnglishLesson=self.request("language_lesson",json!({"task":"Crie uma lição original no idioma especificado, com objetivos, texto de leitura, questões de múltipla escolha com índice de resposta começando em zero, redação, vocabulário e revisão. Explicações em português; nível estimado, sem certificação. ID será substituído pelo aplicativo.","profile":profile,"topic":topic}),consent)?;
                super::tutors::lesson_valid(&lesson)?;
                lesson.id = uuid::Uuid::new_v4().to_string();
                self.connection
                    .execute(
                        "INSERT INTO english_lessons VALUES(?1,?2,?3)",
                        params![lesson.id, encode(&lesson)?, now()],
                    )
                    .map_err(AppError::database)?;
            }
            TracksAction::SaveProfile { input } => {
                profile_valid(&input)?;
                capacity(&input)?;
                self.connection.execute("INSERT INTO language_profiles VALUES(?1,?2,?3) ON CONFLICT(id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at",params![input.id,encode(&input)?,now()]).map_err(AppError::database)?;
            }
            TracksAction::SuggestPlan {
                profile_id,
                consent,
            } => {
                let p = self.profile(&profile_id)?;
                let available = capacity(&p)?;
                let plan:TrackPlan=self.request("track_plan",json!({"task":"Proponha etapas editáveis para o idioma configurado, minutos incluindo revisão, critérios observáveis e marcos. Não prometa fluência. Explicite que nível não foi medido e hipóteses de viabilidade. Não exceda os minutos disponíveis.","profile":p,"availableMinutes":available}),consent)?;
                feasible(&p, &plan)?;
                self.document("plan", Some(&profile_id), &plan)?;
            }
            TracksAction::SavePlan {
                id,
                profile_id,
                input,
            } => {
                validation::id(&id)?;
                let p = self.profile(&profile_id)?;
                feasible(&p, &input)?;
                // Editing creates a separate version; previous proposals remain intact.
                self.document("plan", Some(&profile_id), &input)?;
            }
            TracksAction::ApplyPlan { id } => {
                let plan: TrackPlan = self.document_value(&id, "plan")?;
                let profile_id: String = self
                    .connection
                    .query_row(
                        "SELECT profile_id FROM track_documents WHERE id=?1",
                        [&id],
                        |r| r.get(0),
                    )
                    .map_err(AppError::database)?;
                feasible(&self.profile(&profile_id)?, &plan)?;
                let tx = self.connection.transaction().map_err(AppError::database)?;
                let exists: bool = tx
                    .query_row(
                        "SELECT EXISTS(SELECT 1 FROM roadmaps WHERE id=?1)",
                        [&id],
                        |r| r.get(0),
                    )
                    .map_err(AppError::database)?;
                if exists {
                    return Err(AppError::validation(
                        "Esta versão já foi adicionada à trilha. Nenhuma etapa duplicada.",
                    ));
                }
                tx.execute(
                    "INSERT INTO roadmaps VALUES(?1,?2,?3,?4,?4)",
                    params![id, plan.title, plan.assumptions.join("\n"), now()],
                )
                .map_err(AppError::database)?;
                for (position, s) in plan.steps.iter().enumerate() {
                    let checkpoint = uuid::Uuid::new_v4().to_string();
                    tx.execute("INSERT INTO checkpoints(id,title,description,activity,criteria,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?6)",params![checkpoint,s.title,format!("{} min · Revisão: {}",s.minutes,s.review),s.activity,s.criteria,now()]).map_err(AppError::database)?;
                    tx.execute(
                        "INSERT INTO roadmap_items VALUES(?1,?2,?3)",
                        params![checkpoint, id, position],
                    )
                    .map_err(AppError::database)?;
                }
                tx.commit().map_err(AppError::database)?;
            }
            TracksAction::Classify {
                id,
                classification,
                severity,
            } => {
                validation::id(&id)?;
                if !["error", "style", "dismissed", "unconfirmed"]
                    .contains(&classification.as_str())
                    || !(1..=3).contains(&severity)
                {
                    return Err(invalid());
                }
                if self
                    .connection
                    .execute(
                        "UPDATE practice_errors SET classification=?1,severity=?2 WHERE id=?3",
                        params![classification, severity, id],
                    )
                    .map_err(AppError::database)?
                    == 0
                {
                    return Err(AppError::not_found());
                }
            }
            TracksAction::Recall {
                id,
                answer,
                recalled,
            } => {
                validation::id(&id)?;
                text(&answer, 1, 4000)?;
                let status: String = self
                    .connection
                    .query_row(
                        "SELECT classification FROM practice_errors WHERE id=?1",
                        [&id],
                        |r| r.get(0),
                    )
                    .optional()
                    .map_err(AppError::database)?
                    .ok_or_else(AppError::not_found)?;
                if status != "error" {
                    return Err(AppError::validation(
                        "Confirme a classificação do erro antes da revisão.",
                    ));
                }
                let today = Local::now().date_naive();
                let previous:Option<(bool,String)>=self.connection.query_row("SELECT recalled,next_review FROM practice_reviews WHERE error_id=?1 ORDER BY reviewed_date DESC LIMIT 1",[&id],|r|Ok((r.get(0)?,r.get(1)?))).optional().map_err(AppError::database)?;
                if previous
                    .as_ref()
                    .is_some_and(|(_, due)| date(due).is_ok_and(|d| d > today))
                {
                    return Err(AppError::validation("A próxima revisão ainda não venceu."));
                }
                let count: u64 = self
                    .connection
                    .query_row(
                        "SELECT COUNT(*) FROM practice_reviews WHERE error_id=?1 AND recalled=1 AND reviewed_date>COALESCE((SELECT MAX(reviewed_date) FROM practice_reviews WHERE error_id=?1 AND recalled=0),'')",
                        [&id],
                        |r| r.get(0),
                    )
                    .map_err(AppError::database)?;
                let interval = if recalled {
                    [1, 3, 7, 14, 30][count.min(4) as usize]
                } else {
                    1
                };
                let due = today
                    .checked_add_days(Days::new(interval))
                    .ok_or_else(invalid)?;
                self.connection
                    .execute(
                        "INSERT INTO practice_reviews VALUES(?1,?2,?3,?4,?5,?6,?7)",
                        params![
                            uuid::Uuid::new_v4().to_string(),
                            id,
                            answer,
                            recalled,
                            today.to_string(),
                            due.to_string(),
                            now()
                        ],
                    )
                    .map_err(|_| AppError::validation("A revisão de hoje já foi registrada."))?;
            }
            TracksAction::SaveSource { input } => {
                text(&input.title, 1, 200)?;
                text(&input.institution, 1, 160)?;
                https(&input.url)?;
                date(&input.date)?;
                text(&input.claim, 1, 4000)?;
                self.document("source", None, &input)?;
            }
            TracksAction::SuggestTopic { topic, consent } => {
                text(&topic, 1, 160)?;
                let sources: Vec<TrackDocument> = self
                    .tracks_snapshot()?
                    .documents
                    .into_iter()
                    .filter(|d| d.kind == "source")
                    .collect();
                let content:CareerContent=self.request("career_topic",json!({"task":"Sugira conteúdo de carreira e inserção no roadmap sem alterá-lo. Inclua teoria, conceitos, exemplo verificável, explicação, desafio, critérios e artefato publicável com README. Use SOMENTE sourceIds fornecidos para fatos sustentados. Não invente URLs, fontes, mercado, citações ou alegações. Sem fontes, declare conteúdo como sugestão não verificada e inclua limitação. Não alegue execução de código.","topic":topic,"sources":sources}),consent)?;
                text(&content.topic, 1, 160)?;
                text(&content.theory, 1, 12000)?;
                text(&content.example, 1, 12000)?;
                text(&content.explanation, 1, 6000)?;
                text(&content.challenge, 1, 4000)?;
                text(&content.priority, 1, 2000)?;
                text(&content.artifact, 1, 2000)?;
                list(&content.prerequisites, 0, 15)?;
                list(&content.concepts, 1, 15)?;
                list(&content.acceptance, 1, 15)?;
                list(&content.uncertainties, 1, 10)?;
                if content.source_ids.len() > 30
                    || content
                        .source_ids
                        .iter()
                        .any(|id| !sources.iter().any(|s| &s.id == id))
                {
                    return Err(AppError::validation(
                        "O conteúdo citou uma fonte que não foi fornecida e foi recusado.",
                    ));
                }
                self.document("career", None, &content)?;
            }
            TracksAction::SaveResume { input } => {
                text(&input.text, 1, 30000)?;
                list(&input.skills, 0, 100)?;
                if !(1..=365).contains(&input.review_days) {
                    return Err(invalid());
                }
                self.document("resume", None, &input)?;
            }
            TracksAction::ReviewResume { id, consent } => {
                let resume: ResumeVersion = self.document_value(&id, "resume")?;
                let mut proposal:ResumeProposal=self.request("resume_review",json!({"task":"Revise o currículo sem inventar experiências, resultados, certificações ou competências. Proponha apenas sugestões, dúvidas e lacunas verificáveis. Não substitua o original. originalId deve ser o fornecido.","originalId":id,"resume":resume}),consent)?;
                proposal.original_id = id;
                list(&proposal.suggestions, 1, 20)?;
                list(&proposal.uncertainties, 1, 10)?;
                self.document("resume_proposal", None, &proposal)?;
            }
            TracksAction::SaveJob { input } => {
                text(&input.title, 1, 200)?;
                https(&input.url)?;
                date(&input.date)?;
                text(&input.location, 1, 160)?;
                text(&input.modality, 1, 80)?;
                text(&input.seniority, 1, 80)?;
                list(&input.requirements, 1, 100)?;
                text(&input.evidence, 1, 6000)?;
                self.document("job", None, &input)?;
            }
            TracksAction::FetchGithub {
                repository,
                consent,
            } => {
                if !consent {
                    return Err(AppError::validation(
                        "Autorize consultar o repositório na API GitHub.",
                    ));
                }
                let parts: Vec<_> = repository.split('/').collect();
                if parts.len() != 2
                    || parts.iter().any(|s| {
                        s.is_empty()
                            || s.len() > 100
                            || s.starts_with('.')
                            || s.chars().any(|c| {
                                !c.is_ascii_alphanumeric() && !['-', '_', '.'].contains(&c)
                            })
                    })
                {
                    return Err(invalid());
                }
                let client = crate::network::client()?;
                let fetch = |path: &str| -> AppResult<Value> {
                    crate::network::json(
                        client
                            .get(format!("https://api.github.com/repos/{repository}{path}"))
                            .header("User-Agent", "LearningStudio")
                            .header("Accept", "application/vnd.github+json")
                            .send()
                            .map_err(|_| crate::network::error())?,
                    )
                };
                let commits = fetch("/commits?per_page=5")?;
                let runs = fetch("/actions/runs?per_page=5")?;
                let evidence = json!({"repository":repository,"commits":commits,"workflowRuns":runs,"verifiedAt":now(),"scope":"Consulta pública somente leitura; resultados de CI pertencem aos SHAs indicados, não à cópia local."});
                self.document("github", None, &evidence)?;
            }
            TracksAction::ReviewPdf {
                id,
                transcription,
                consent,
            } => {
                validation::id(&id)?;
                text(&transcription, 1, 20000)?;
                let exists: bool = self
                    .connection
                    .query_row(
                        "SELECT EXISTS(SELECT 1 FROM lesson_pdfs WHERE id=?1)",
                        [&id],
                        |r| r.get(0),
                    )
                    .map_err(AppError::database)?;
                if !exists {
                    return Err(AppError::not_found());
                }
                // Only the explicitly confirmed transcription is transmitted; handwritten PDFs are not guessed.
                let feedback:Feedback=self.request("pdf_transcription_review",json!({"task":"Corrija a transcrição confirmada pelo estudante. O PDF manuscrito NÃO foi lido; declare esta incerteza. Cite somente trechos exatos da transcrição. Distingua sugestões estilísticas de erros.","original":transcription}),consent)?;
                super::tutors::feedback_valid(&feedback, &transcription)?;
                let tx = self.connection.transaction().map_err(AppError::database)?;
                tx.execute(
                    "INSERT INTO pdf_reviews VALUES(?1,?2,?3,?4,?5)",
                    params![
                        uuid::Uuid::new_v4().to_string(),
                        id,
                        transcription,
                        encode(&feedback)?,
                        now()
                    ],
                )
                .map_err(AppError::database)?;
                for f in feedback.findings {
                    tx.execute("INSERT INTO practice_errors VALUES(?1,NULL,?2,?3,?4,?5,?6,2,'unconfirmed',?7)",params![uuid::Uuid::new_v4().to_string(),format!("PDF {id}"),f.category,f.excerpt,f.suggestion,f.explanation,now()]).map_err(AppError::database)?;
                }
                tx.commit().map_err(AppError::database)?;
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn review_requires_confirmation_and_preserves_daily_history() {
        let mut s = store();
        let id = uuid::Uuid::new_v4().to_string();
        s.connection.execute("INSERT INTO practice_errors VALUES(?1,NULL,'Gramática','Concordância','I has','I have','Use have com I',2,'unconfirmed',?2)",params![id,now()]).unwrap();
        assert!(s
            .tracks_action(TracksAction::Recall {
                id: id.clone(),
                answer: "I have".into(),
                recalled: true
            })
            .is_err());
        s.tracks_action(TracksAction::Classify {
            id: id.clone(),
            classification: "error".into(),
            severity: 2,
        })
        .unwrap();
        s.tracks_action(TracksAction::Recall {
            id: id.clone(),
            answer: "I have".into(),
            recalled: true,
        })
        .unwrap();
        assert!(s
            .tracks_action(TracksAction::Recall {
                id: id.clone(),
                answer: "Repeated".into(),
                recalled: true
            })
            .is_err());
        let error = s.tracks_snapshot().unwrap().errors.remove(0);
        assert_eq!(error.reviews, 1);
        assert_eq!(error.successes, 1);
        assert_eq!(
            date(&error.next_review).unwrap(),
            Local::now().date_naive() + Days::new(1)
        );
        s.tracks_action(TracksAction::Classify {
            id,
            classification: "style".into(),
            severity: 1,
        })
        .unwrap();
        assert_eq!(s.tracks_snapshot().unwrap().errors[0].reviews, 1);
    }
    fn profile() -> LanguageProfile {
        LanguageProfile {
            id: uuid::Uuid::new_v4().to_string(),
            language: "Inglês".into(),
            current_level: "B1".into(),
            target_level: "C1".into(),
            deadline: (Local::now().date_naive() + Days::new(30)).to_string(),
            minutes_per_day: 30,
            weekdays: vec![0, 2, 4],
        }
    }
    fn store() -> Store {
        let mut s = Store::open(std::path::Path::new(":memory:")).unwrap();
        s.authenticated_at = Some(Instant::now());
        s
    }
    #[test]
    fn validates_levels_and_duplicate_days() {
        let mut p = profile();
        assert!(profile_valid(&p).is_ok());
        p.weekdays = vec![0, 0];
        assert!(profile_valid(&p).is_err());
        p.weekdays = vec![0];
        p.target_level = "A1".into();
        assert!(profile_valid(&p).is_err());
    }
    #[test]
    fn profiles_persist_and_require_authentication() {
        let mut s = store();
        let p = profile();
        s.tracks_action(TracksAction::SaveProfile { input: p.clone() })
            .unwrap();
        assert_eq!(s.tracks_snapshot().unwrap().profiles[0].id, p.id);
        s.authenticated_at = None;
        assert!(s.tracks_snapshot().is_err());
    }
    #[test]
    fn plan_capacity_and_application_are_checked() {
        let mut s = store();
        let p = profile();
        s.tracks_action(TracksAction::SaveProfile { input: p.clone() })
            .unwrap();
        let mut plan = TrackPlan {
            title: "Plano".into(),
            assumptions: vec!["Nível estimado".into()],
            steps: vec![PlanStep {
                title: "Leitura".into(),
                minutes: 30,
                activity: "Ler texto".into(),
                criteria: "Explicar argumento".into(),
                review: "Em três dias".into(),
            }],
        };
        assert!(feasible(&p, &plan).is_ok());
        plan.steps[0].minutes = 10000;
        assert!(feasible(&p, &plan).is_err());
        plan.steps[0].minutes = 30;
        s.document("plan", Some(&p.id), &plan).unwrap();
        let id = s.tracks_snapshot().unwrap().documents[0].id.clone();
        s.tracks_action(TracksAction::ApplyPlan { id: id.clone() })
            .unwrap();
        assert!(s.tracks_action(TracksAction::ApplyPlan { id }).is_err());
    }
    #[test]
    fn resumes_are_versioned_and_sources_validate() {
        let mut s = store();
        for text in ["Primeira versão", "Segunda versão"] {
            s.tracks_action(TracksAction::SaveResume {
                input: ResumeVersion {
                    text: text.into(),
                    skills: vec!["Rust".into()],
                    review_days: 30,
                },
            })
            .unwrap();
        }
        assert_eq!(s.tracks_snapshot().unwrap().documents.len(), 2);
        assert!(https("http://example.com").is_err());
        assert!(https("https://secret@example.com").is_err());
    }
    #[test]
    fn github_never_accepts_arbitrary_hosts_or_paths() {
        let mut s = store();
        assert!(s
            .tracks_action(TracksAction::FetchGithub {
                repository: "https://evil.test/a".into(),
                consent: true
            })
            .is_err());
        assert!(s
            .tracks_action(TracksAction::FetchGithub {
                repository: "owner/repo".into(),
                consent: false
            })
            .is_err());
    }
}
