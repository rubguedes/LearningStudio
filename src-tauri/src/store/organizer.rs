use super::*;
fn text(s: &str, min: usize, max: usize) -> AppResult<()> {
    if s.contains('\0') || !(min..=max).contains(&s.trim().chars().count()) {
        Err(AppError::validation(
            "Confira o título e os limites de texto.",
        ))
    } else {
        Ok(())
    }
}
impl Store {
    pub fn organizer_snapshot(&mut self) -> AppResult<OrganizerSnapshot> {
        self.require_auth()?;
        let mut q = self
            .connection
            .prepare("SELECT id,title,notes,area_id FROM topics ORDER BY title,id")
            .map_err(AppError::database)?;
        let topics = q
            .query_map([], |r| {
                Ok(Topic {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    notes: r.get(2)?,
                    area_id: r.get(3)?,
                })
            })
            .map_err(AppError::database)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(AppError::database)?;
        let mut q=self.connection.prepare("SELECT id,title,notes,url,topic_id,archived FROM resources ORDER BY archived,title,id").map_err(AppError::database)?;
        let resources = q
            .query_map([], |r| {
                Ok(Resource {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    notes: r.get(2)?,
                    url: r.get(3)?,
                    topic_id: r.get(4)?,
                    archived: r.get(5)?,
                })
            })
            .map_err(AppError::database)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(AppError::database)?;
        Ok(OrganizerSnapshot { topics, resources })
    }
    pub fn organizer_action(&mut self, action: OrganizerAction) -> AppResult<()> {
        self.require_auth()?;
        match action {
            OrganizerAction::SaveTopic { input } => {
                validation::id(&input.id)?;
                text(&input.title, 1, 160)?;
                text(&input.notes, 0, 4000)?;
                if let Some(id) = &input.area_id {
                    validation::id(id)?;
                }
                self.connection.execute("INSERT INTO topics VALUES (?1,?2,?3,?4,?5) ON CONFLICT(id) DO UPDATE SET title=excluded.title,notes=excluded.notes,area_id=excluded.area_id,updated_at=excluded.updated_at",params![input.id,input.title,input.notes,input.area_id,now()]).map_err(AppError::database)?;
            }
            OrganizerAction::SaveResource { input } => {
                validation::id(&input.id)?;
                text(&input.title, 1, 160)?;
                text(&input.notes, 0, 12000)?;
                text(&input.url, 0, 2000)?;
                if let Some(id) = &input.topic_id {
                    validation::id(id)?;
                }
                if !input.url.is_empty() {
                    let url = reqwest::Url::parse(&input.url)
                        .map_err(|_| AppError::validation("Informe um link HTTPS válido."))?;
                    if url.scheme() != "https"
                        || url.host_str().is_none()
                        || !url.username().is_empty()
                        || url.password().is_some()
                    {
                        return Err(AppError::validation(
                            "Use links HTTPS sem credenciais embutidas.",
                        ));
                    }
                }
                self.connection.execute("INSERT INTO resources VALUES (?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(id) DO UPDATE SET title=excluded.title,notes=excluded.notes,url=excluded.url,topic_id=excluded.topic_id,archived=excluded.archived,updated_at=excluded.updated_at",params![input.id,input.title,input.notes,input.url,input.topic_id,input.archived,now()]).map_err(AppError::database)?;
            }
            OrganizerAction::DeleteTopic { id } => {
                validation::id(&id)?;
                self.connection
                    .execute("DELETE FROM topics WHERE id=?1", [id])
                    .map_err(AppError::database)?;
            }
            OrganizerAction::DeleteResource { id } => {
                validation::id(&id)?;
                self.connection
                    .execute("DELETE FROM resources WHERE id=?1", [id])
                    .map_err(AppError::database)?;
            }
        }
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::super::tests::store;
    use super::*;
    #[test]
    fn topic_deletion_preserves_resource_and_unsafe_links_are_refused() {
        let mut s = store();
        let topic = uuid::Uuid::new_v4().to_string();
        s.organizer_action(OrganizerAction::SaveTopic {
            input: Topic {
                id: topic.clone(),
                title: "SQL".into(),
                notes: "".into(),
                area_id: None,
            },
        })
        .unwrap();
        let mut resource = Resource {
            id: uuid::Uuid::new_v4().to_string(),
            title: "Reference".into(),
            notes: "Own notes".into(),
            url: "javascript:alert(1)".into(),
            topic_id: Some(topic.clone()),
            archived: false,
        };
        assert!(s
            .organizer_action(OrganizerAction::SaveResource {
                input: resource.clone()
            })
            .is_err());
        resource.url = "https://www.sqlite.org/".into();
        s.organizer_action(OrganizerAction::SaveResource { input: resource })
            .unwrap();
        s.organizer_action(OrganizerAction::DeleteTopic { id: topic })
            .unwrap();
        let data = s.organizer_snapshot().unwrap();
        assert_eq!(data.resources.len(), 1);
        assert!(data.resources[0].topic_id.is_none());
    }
}
