use super::*;
use chrono::{Days, Local, NaiveDate};

fn checked(value: &str, min: usize, max: usize) -> AppResult<()> {
    if value.contains('\0') || !(min..=max).contains(&value.trim().chars().count()) {
        return Err(AppError::validation(
            "Preencha os campos respeitando os limites indicados.",
        ));
    }
    Ok(())
}
fn json<T: serde::de::DeserializeOwned>(value: &str) -> AppResult<T> {
    serde_json::from_str(value)
        .map_err(|_| AppError::new("CONTENT", "O conteúdo local não pôde ser lido."))
}
fn encoded<T: serde::Serialize>(value: &T) -> AppResult<String> {
    serde_json::to_string(value)
        .map_err(|_| AppError::new("CONTENT", "O conteúdo não pôde ser salvo."))
}
fn changed(count: usize) -> AppResult<()> {
    if count == 0 {
        Err(AppError::not_found())
    } else {
        Ok(())
    }
}

impl Store {
    pub(super) fn seed_library(tx: &rusqlite::Transaction<'_>) -> AppResult<()> {
        let timestamp = now();
        let tracks = [
            ("Carreira em IA", "Roteiro editável e não prescritivo. Adapte as etapas ao seu contexto.", vec![
                ("Fundamentos", "Python, Git, SQL, APIs e testes", "Construa um programa Python que consulte uma API e salve dados em SQLite.", "Repositório com histórico Git, consultas parametrizadas e testes demonstráveis."),
                ("Engenharia de software", "FastAPI, arquitetura, autenticação, Docker, CI e observabilidade", "Desenhe e teste uma API com autenticação. Docker é conteúdo de estudo, não requisito do LearningStudio.", "Explique fronteiras, execute testes da API e registre decisões de segurança."),
                ("Dados e machine learning", "Estatística, NumPy/Pandas, scikit-learn e avaliação", "Compare um modelo simples com uma linha de base usando dados separados para avaliação.", "Registre métricas, separação dos dados e limitações; evite vazamento entre treino e teste."),
                ("IA aplicada", "LLMs, embeddings, RAG, agentes, avaliação, segurança e custo", "Construa um pequeno experimento RAG com um conjunto de perguntas de avaliação.", "Apresente evidências de recuperação, falhas, custo observado e tratamento de conteúdo não confiável."),
                ("Engenharia de produção", "Deploy, monitoramento, versionamento, privacidade e otimização", "Descreva um plano de implantação e recuperação para seu projeto.", "Inclua métricas, tratamento de dados pessoais, rollback e limites operacionais."),
                ("Portfólio e empregabilidade", "Projetos demonstráveis, documentação, entrevistas e inglês técnico", "Prepare uma demonstração e explique suas decisões em português e inglês.", "Inclua instruções reproduzíveis, evidências, limitações e reflexão sobre melhorias."),
                ("Arquitetura de soluções de IA", "Requisitos, trade-offs, integrações, escala e governança", "Desenhe uma solução a partir de requisitos, comparando duas opções.", "Justifique decisões com custo, risco, privacidade, escalabilidade e critérios de revisão.")]),
            ("Inglês: B1/B2 rumo a C1", "Níveis são referências estimadas, não avaliação ou certificação. Registre dificuldades e revisite suas evidências.", vec![
                ("Leitura", "Compreender argumentos, evidências e limites", "Leia uma lição e resuma o argumento em suas palavras.", "Identifique ideia principal, evidência e uma limitação com trechos do texto."),
                ("Escrita", "Organizar ideias e revisar sem apagar o original", "Escreva e revise uma resposta argumentativa.", "Guarde versão original, revisão e uma explicação das mudanças."),
                ("Vocabulário", "Aprender palavras em contexto e fazer revisões espaçadas", "Selecione expressões úteis e crie exemplos próprios.", "Registre significado, contexto e pelo menos duas revisões em dias diferentes."),
                ("Gramática", "Reconhecer padrões e dificuldades recorrentes", "Revise conectores e estruturas presentes nas suas redações.", "Explique três ajustes com exemplos e registre dúvidas ainda abertas."),
                ("Listening", "Compreender fala e identificar informações específicas", "Ouça um material de sua escolha e registre um resumo e fonte.", "Documente ideias principais, detalhes percebidos e trechos difíceis sem inventar transcrição."),
                ("Speaking", "Expressar e sustentar uma opinião", "Grave por conta própria uma explicação de dois minutos e revise-a.", "Registre autoavaliação de clareza, organização e dificuldades, com referência à gravação.")])
        ];
        for (track_index, (title, description, steps)) in tracks.into_iter().enumerate() {
            let id = format!("b3087a2e-7455-49f4-97be-5db831a9a{:03}", track_index + 1);
            tx.execute(
                "INSERT INTO roadmaps VALUES (?1,?2,?3,?4,?4)",
                params![id, title, description, timestamp],
            )
            .map_err(AppError::database)?;
            for (position, (name, description, activity, criteria)) in steps.into_iter().enumerate()
            {
                let checkpoint = format!(
                    "b3087a2e-7455-49f4-97be-5db831a9e{:03}",
                    track_index * 100 + position + 1
                );
                tx.execute("INSERT INTO checkpoints(id,title,description,activity,criteria,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?6)", params![checkpoint,name,description,activity,criteria,timestamp]).map_err(AppError::database)?;
                tx.execute(
                    "INSERT INTO roadmap_items VALUES (?1,?2,?3)",
                    params![checkpoint, id, position],
                )
                .map_err(AppError::database)?;
            }
        }
        let lessons: Vec<EnglishLesson> = json(include_str!("../../content/english.json"))?;
        for lesson in lessons {
            tx.execute(
                "INSERT INTO english_lessons VALUES (?1,?2,?3)",
                params![lesson.id, encoded(&lesson)?, timestamp],
            )
            .map_err(AppError::database)?;
        }
        Ok(())
    }

    pub(super) fn read_roadmaps(c: &Connection) -> AppResult<Vec<Roadmap>> {
        let mut q = c
            .prepare("SELECT id,title,description FROM roadmaps ORDER BY created_at,id")
            .map_err(AppError::database)?;
        let mut roadmaps = q
            .query_map([], |r| {
                Ok(Roadmap {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    description: r.get(2)?,
                    items: vec![],
                })
            })
            .map_err(AppError::database)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(AppError::database)?;
        for roadmap in &mut roadmaps {
            let mut q = c.prepare("SELECT checkpoint_id FROM roadmap_items WHERE roadmap_id=?1 ORDER BY position,checkpoint_id").map_err(AppError::database)?;
            roadmap.items = q
                .query_map([&roadmap.id], |r| r.get(0))
                .map_err(AppError::database)?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(AppError::database)?;
        }
        Ok(roadmaps)
    }
    pub fn library_snapshot(&mut self) -> AppResult<LibrarySnapshot> {
        self.require_auth()?;
        let c = &self.connection;
        let roadmaps = Self::read_roadmaps(c)?;
        let mut q = c
            .prepare("SELECT content FROM english_lessons ORDER BY id")
            .map_err(AppError::database)?;
        let raw = q
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(AppError::database)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(AppError::database)?;
        let lessons = raw
            .iter()
            .map(|s| json(s))
            .collect::<AppResult<Vec<EnglishLesson>>>()?;
        let mut q = c.prepare("SELECT id,lesson_id,writing,answers,submitted_at,updated_at FROM english_submissions ORDER BY created_at DESC,id").map_err(AppError::database)?;
        let raw = q
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, Option<String>>(4)?,
                    r.get::<_, String>(5)?,
                ))
            })
            .map_err(AppError::database)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(AppError::database)?;
        let submissions = raw
            .into_iter()
            .map(
                |(id, lesson_id, writing, answers, submitted_at, updated_at)| {
                    Ok(EnglishSubmission {
                        id,
                        lesson_id,
                        writing,
                        answers: json(&answers)?,
                        submitted_at,
                        updated_at,
                    })
                },
            )
            .collect::<AppResult<Vec<_>>>()?;
        let mut q = c.prepare("SELECT submission_id,difficulties,revised_writing,next_review FROM learning_reviews ORDER BY updated_at DESC").map_err(AppError::database)?;
        let reviews = q
            .query_map([], |r| {
                Ok(LearningReview {
                    submission_id: r.get(0)?,
                    difficulties: r.get(1)?,
                    revised_writing: r.get(2)?,
                    next_review: r.get(3)?,
                })
            })
            .map_err(AppError::database)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(AppError::database)?;
        let mut q = c.prepare("SELECT v.id,v.term,v.meaning,v.example,v.stage,v.due_date,(SELECT COUNT(*) FROM vocabulary_reviews r WHERE r.vocabulary_id=v.id) FROM vocabulary_items v ORDER BY due_date,term").map_err(AppError::database)?;
        let vocabulary = q
            .query_map([], |r| {
                Ok(VocabularyItem {
                    id: r.get(0)?,
                    term: r.get(1)?,
                    meaning: r.get(2)?,
                    example: r.get(3)?,
                    stage: r.get(4)?,
                    due_date: r.get(5)?,
                    reviews: r.get(6)?,
                })
            })
            .map_err(AppError::database)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(AppError::database)?;
        Ok(LibrarySnapshot {
            roadmaps,
            lessons,
            submissions,
            reviews,
            vocabulary,
        })
    }

    pub fn library_action(&mut self, action: LibraryAction) -> AppResult<()> {
        self.require_auth()?;
        let timestamp = now();
        let today = Local::now().date_naive();
        let tx = self.connection.transaction().map_err(AppError::database)?;
        match action {
            LibraryAction::SaveRoadmap {
                id,
                title,
                description,
            } => {
                validation::id(&id)?;
                checked(&title, 1, 160)?;
                checked(&description, 0, 4000)?;
                tx.execute("INSERT INTO roadmaps VALUES (?1,?2,?3,?4,?4) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,updated_at=excluded.updated_at",params![id,title.trim(),description.trim(),timestamp]).map_err(AppError::database)?;
            }
            LibraryAction::DeleteRoadmap { id } => {
                validation::id(&id)?;
                changed(
                    tx.execute("DELETE FROM roadmaps WHERE id=?1", [id])
                        .map_err(AppError::database)?,
                )?;
            }
            LibraryAction::LinkCheckpoint {
                roadmap_id,
                checkpoint_id,
            } => {
                validation::id(&roadmap_id)?;
                validation::id(&checkpoint_id)?;
                tx.execute("INSERT INTO roadmap_items(checkpoint_id,roadmap_id,position) VALUES (?1,?2,COALESCE((SELECT MAX(position)+1 FROM roadmap_items WHERE roadmap_id=?2),0))", params![checkpoint_id,roadmap_id]).map_err(AppError::database)?;
            }
            LibraryAction::UnlinkCheckpoint { checkpoint_id } => {
                validation::id(&checkpoint_id)?;
                changed(
                    tx.execute(
                        "DELETE FROM roadmap_items WHERE checkpoint_id=?1",
                        [checkpoint_id],
                    )
                    .map_err(AppError::database)?,
                )?;
            }
            LibraryAction::Reorder { roadmap_id, ids } => {
                validation::id(&roadmap_id)?;
                let mut q = tx
                    .prepare("SELECT checkpoint_id FROM roadmap_items WHERE roadmap_id=?1")
                    .map_err(AppError::database)?;
                let existing = q
                    .query_map([&roadmap_id], |r| r.get::<_, String>(0))
                    .map_err(AppError::database)?
                    .collect::<rusqlite::Result<std::collections::HashSet<_>>>()
                    .map_err(AppError::database)?;
                if ids.len() != existing.len()
                    || ids.iter().collect::<std::collections::HashSet<_>>().len() != ids.len()
                    || ids.iter().any(|id| !existing.contains(id))
                {
                    return Err(AppError::validation(
                        "A ordem deve incluir cada etapa da trilha uma única vez.",
                    ));
                }
                for (position, id) in ids.iter().enumerate() {
                    tx.execute("UPDATE roadmap_items SET position=?1 WHERE roadmap_id=?2 AND checkpoint_id=?3", params![position,roadmap_id,id]).map_err(AppError::database)?;
                }
            }
            LibraryAction::SaveSubmission {
                id,
                lesson_id,
                writing,
                answers,
                submit,
            } => {
                validation::id(&id)?;
                validation::id(&lesson_id)?;
                checked(&writing, usize::from(submit), 20000)?;
                let content: String = tx
                    .query_row(
                        "SELECT content FROM english_lessons WHERE id=?1",
                        [&lesson_id],
                        |r| r.get(0),
                    )
                    .optional()
                    .map_err(AppError::database)?
                    .ok_or_else(AppError::not_found)?;
                let lesson: EnglishLesson = json(&content)?;
                if answers.len() != lesson.questions.len()
                    || answers.iter().zip(&lesson.questions).any(|(a, q)| {
                        a.is_some_and(|v| v >= q.choices.len()) || (submit && a.is_none())
                    })
                {
                    return Err(AppError::validation(
                        "Responda às questões usando as opções da lição.",
                    ));
                }
                let prior: Option<(String, Option<String>)> = tx
                    .query_row(
                        "SELECT lesson_id,submitted_at FROM english_submissions WHERE id=?1",
                        [&id],
                        |r| Ok((r.get(0)?, r.get(1)?)),
                    )
                    .optional()
                    .map_err(AppError::database)?;
                if let Some((old_lesson, submitted)) = prior {
                    if submitted.is_some() || old_lesson != lesson_id {
                        return Err(AppError::validation(
                            "Respostas finalizadas são preservadas. Crie uma nova tentativa.",
                        ));
                    }
                }
                let submitted = if submit { Some(&timestamp) } else { None };
                tx.execute("INSERT INTO english_submissions VALUES (?1,?2,?3,?4,?5,?6,?6) ON CONFLICT(id) DO UPDATE SET writing=excluded.writing,answers=excluded.answers,submitted_at=excluded.submitted_at,updated_at=excluded.updated_at",params![id,lesson_id,writing,encoded(&answers)?,submitted,timestamp]).map_err(AppError::database)?;
            }
            LibraryAction::SaveReview {
                submission_id,
                difficulties,
                revised_writing,
                next_review,
            } => {
                validation::id(&submission_id)?;
                checked(&difficulties, 1, 4000)?;
                checked(&revised_writing, 0, 20000)?;
                let date = NaiveDate::parse_from_str(&next_review, "%Y-%m-%d")
                    .map_err(|_| AppError::validation("Informe uma data de revisão válida."))?;
                if next_review.len() != 10 || date < today {
                    return Err(AppError::validation(
                        "A revisão deve ser hoje ou em uma data futura.",
                    ));
                }
                let finished:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM english_submissions WHERE id=?1 AND submitted_at IS NOT NULL)",[&submission_id],|r|r.get(0)).map_err(AppError::database)?;
                if !finished {
                    return Err(AppError::validation(
                        "Finalize a resposta antes da autocorreção.",
                    ));
                }
                tx.execute("INSERT INTO learning_reviews VALUES (?1,?2,?3,?4,?5) ON CONFLICT(submission_id) DO UPDATE SET difficulties=excluded.difficulties,revised_writing=excluded.revised_writing,next_review=excluded.next_review,updated_at=excluded.updated_at", params![submission_id,difficulties,revised_writing,next_review,timestamp]).map_err(AppError::database)?;
            }
            LibraryAction::SaveWord {
                id,
                term,
                meaning,
                example,
            } => {
                validation::id(&id)?;
                checked(&term, 1, 120)?;
                checked(&meaning, 1, 1000)?;
                checked(&example, 0, 2000)?;
                let key = term.trim().to_lowercase();
                let duplicate:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM vocabulary_items WHERE lower(trim(term))=?1 AND id<>?2)",params![key,id],|r|r.get(0)).map_err(AppError::database)?;
                if duplicate {
                    return Err(AppError::validation(
                        "Este termo já está no seu vocabulário.",
                    ));
                }
                tx.execute("INSERT INTO vocabulary_items VALUES (?1,?2,?3,?4,0,?5,?6,?6) ON CONFLICT(id) DO UPDATE SET term=excluded.term,meaning=excluded.meaning,example=excluded.example,updated_at=excluded.updated_at",params![id,term.trim(),meaning.trim(),example.trim(),today.to_string(),timestamp]).map_err(AppError::database)?;
            }
            LibraryAction::ReviewWord {
                id,
                remembered,
                review_id,
            } => {
                validation::id(&id)?;
                validation::id(&review_id)?;
                let prior: Option<String> = tx
                    .query_row(
                        "SELECT vocabulary_id FROM vocabulary_reviews WHERE id=?1",
                        [&review_id],
                        |r| r.get(0),
                    )
                    .optional()
                    .map_err(AppError::database)?;
                if let Some(prior) = prior {
                    if prior != id {
                        return Err(AppError::validation(
                            "Identificador de revisão já utilizado.",
                        ));
                    }
                    return Ok(());
                }
                let (stage, due): (usize, String) = tx
                    .query_row(
                        "SELECT stage,due_date FROM vocabulary_items WHERE id=?1",
                        [&id],
                        |r| Ok((r.get(0)?, r.get(1)?)),
                    )
                    .optional()
                    .map_err(AppError::database)?
                    .ok_or_else(AppError::not_found)?;
                if due > today.to_string() {
                    return Err(AppError::validation(
                        "Aguarde a próxima revisão deste termo.",
                    ));
                }
                let next = if remembered { (stage + 1).min(5) } else { 0 };
                let days = [1, 1, 3, 7, 14, 30][next];
                let due = today
                    .checked_add_days(Days::new(days))
                    .ok_or_else(|| AppError::validation("Data fora do intervalo suportado."))?;
                tx.execute(
                    "INSERT INTO vocabulary_reviews VALUES (?1,?2,?3,?4)",
                    params![review_id, id, remembered, timestamp],
                )
                .map_err(AppError::database)?;
                tx.execute(
                    "UPDATE vocabulary_items SET stage=?1,due_date=?2,updated_at=?3 WHERE id=?4",
                    params![next, due.to_string(), timestamp, id],
                )
                .map_err(AppError::database)?;
            }
            LibraryAction::DeleteWord { id } => {
                validation::id(&id)?;
                changed(
                    tx.execute("DELETE FROM vocabulary_items WHERE id=?1", [id])
                        .map_err(AppError::database)?,
                )?;
            }
        }
        tx.commit().map_err(AppError::database)
    }
}
