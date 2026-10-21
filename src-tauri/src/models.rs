use serde::{Deserialize, Serialize};
mod tracks;
pub use tracks::*;
mod library;
pub use library::*;
mod agenda;
pub use agenda::*;
mod google;
pub use google::*;
mod tutors;
pub use tutors::*;
mod organizer;
pub use organizer::*;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: &'static str,
    pub message: &'static str,
}

impl AppError {
    pub fn new(code: &'static str, message: &'static str) -> Self {
        Self { code, message }
    }
    pub fn database(_: rusqlite::Error) -> Self {
        Self::new(
            "DATABASE",
            "Não foi possível acessar o banco local. Tente novamente.",
        )
    }
    pub fn validation(message: &'static str) -> Self {
        Self::new("VALIDATION", message)
    }
    pub fn not_found() -> Self {
        Self::new("NOT_FOUND", "O registro não existe mais. Atualize a lista.")
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub configured: bool,
    pub unlocked: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AreaInput {
    pub id: Option<String>,
    pub name: String,
    pub description: String,
    pub color: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StudyArea {
    pub id: String,
    pub name: String,
    pub description: String,
    pub color: String,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TaskInput {
    #[serde(default)]
    pub checkpoint_id: Option<String>,
    pub id: Option<String>,
    pub title: String,
    pub notes: String,
    pub area_id: Option<String>,
    pub priority: String,
    pub status: String,
    pub due_date: Option<String>,
    pub estimate_minutes: Option<i64>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub checkpoint_id: Option<String>,
    pub id: String,
    pub title: String,
    pub notes: String,
    pub area_id: Option<String>,
    pub priority: String,
    pub status: String,
    pub due_date: Option<String>,
    pub estimate_minutes: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub roadmaps: Vec<Roadmap>,
    pub areas: Vec<StudyArea>,
    pub tasks: Vec<Task>,
    pub sessions: Vec<StudySession>,
    pub goals: Vec<Goal>,
    pub checkpoints: Vec<Checkpoint>,
    pub checkpoint_evidence: Vec<CheckpointEvidence>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionInput {
    pub id: String,
    pub title: String,
    pub notes: String,
    pub area_id: Option<String>,
    pub study_date: String,
    pub duration_seconds: i64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StudySession {
    pub id: String,
    pub title: String,
    pub notes: String,
    pub area_id: Option<String>,
    pub study_date: String,
    pub mode: String,
    pub status: String,
    pub duration_seconds: i64,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GoalInput {
    pub id: String,
    pub title: String,
    pub area_id: Option<String>,
    pub mode: String,
    pub unit: String,
    pub target: i64,
    pub manual_value: i64,
    pub start_date: String,
    pub due_date: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Goal {
    pub id: String,
    pub title: String,
    pub area_id: Option<String>,
    pub mode: String,
    pub unit: String,
    pub target: i64,
    pub manual_value: i64,
    pub start_date: String,
    pub due_date: String,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CheckpointInput {
    pub id: String,
    pub title: String,
    pub description: String,
    pub activity: String,
    pub criteria: String,
    pub area_id: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Checkpoint {
    pub id: String,
    pub title: String,
    pub description: String,
    pub activity: String,
    pub criteria: String,
    pub area_id: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointEvidence {
    pub id: String,
    pub checkpoint_id: String,
    pub content: String,
    pub created_at: String,
}
