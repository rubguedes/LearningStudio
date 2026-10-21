use super::*;
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Recurrence {
    pub id: String,
    pub title: String,
    pub notes: String,
    pub weekdays: u8,
    pub local_time: String,
    pub timezone: String,
    pub start_date: String,
    pub end_date: Option<String>,
    pub enabled: bool,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportedTaskInput {
    pub external_id: String,
    pub title: String,
    pub instructions: String,
    pub schedule: String,
    pub url: String,
    pub notes: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedTask {
    pub id: String,
    #[serde(flatten)]
    pub input: ImportedTaskInput,
    pub updated_at: String,
    pub local_task_id: Option<String>,
    pub converted_at: Option<String>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Occurrence {
    pub recurrence_id: String,
    pub date: String,
    pub starts_at: Option<String>,
    pub task_id: Option<String>,
    pub materialized: bool,
    pub warning: Option<String>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgendaSnapshot {
    pub recurrences: Vec<Recurrence>,
    pub imported: Vec<ImportedTask>,
    pub occurrences: Vec<Occurrence>,
}
#[derive(Debug, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum AgendaAction {
    SaveRecurrence {
        input: Recurrence,
    },
    DeleteRecurrence {
        id: String,
    },
    Materialize {
        from: String,
        to: String,
    },
    Import {
        format: String,
        content: String,
    },
    Convert {
        id: String,
        due_date: Option<String>,
    },
    DeleteImport {
        id: String,
    },
}
