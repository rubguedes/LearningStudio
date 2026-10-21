use super::*;

#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LessonQuestion {
    pub prompt: String,
    pub choices: Vec<String>,
    pub answer: usize,
    pub explanation: String,
}
#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LessonWord {
    pub term: String,
    pub meaning: String,
    pub example: String,
}
#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EnglishLesson {
    pub id: String,
    pub title: String,
    pub level: String,
    pub minutes: u32,
    pub objectives: Vec<String>,
    pub reading: String,
    pub questions: Vec<LessonQuestion>,
    pub writing_prompt: String,
    pub reference: String,
    pub rubric: Vec<String>,
    pub vocabulary: Vec<LessonWord>,
    pub follow_up: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Roadmap {
    pub id: String,
    pub title: String,
    pub description: String,
    pub items: Vec<String>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnglishSubmission {
    pub id: String,
    pub lesson_id: String,
    pub writing: String,
    pub answers: Vec<Option<usize>>,
    pub submitted_at: Option<String>,
    pub updated_at: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningReview {
    pub submission_id: String,
    pub difficulties: String,
    pub revised_writing: String,
    pub next_review: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VocabularyItem {
    pub id: String,
    pub term: String,
    pub meaning: String,
    pub example: String,
    pub stage: u32,
    pub due_date: String,
    pub reviews: u32,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySnapshot {
    pub roadmaps: Vec<Roadmap>,
    pub lessons: Vec<EnglishLesson>,
    pub submissions: Vec<EnglishSubmission>,
    pub reviews: Vec<LearningReview>,
    pub vocabulary: Vec<VocabularyItem>,
}
#[derive(Debug, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum LibraryAction {
    SaveRoadmap {
        id: String,
        title: String,
        description: String,
    },
    DeleteRoadmap {
        id: String,
    },
    LinkCheckpoint {
        roadmap_id: String,
        checkpoint_id: String,
    },
    UnlinkCheckpoint {
        checkpoint_id: String,
    },
    Reorder {
        roadmap_id: String,
        ids: Vec<String>,
    },
    SaveSubmission {
        id: String,
        lesson_id: String,
        writing: String,
        answers: Vec<Option<usize>>,
        submit: bool,
    },
    SaveReview {
        submission_id: String,
        difficulties: String,
        revised_writing: String,
        next_review: String,
    },
    SaveWord {
        id: String,
        term: String,
        meaning: String,
        example: String,
    },
    ReviewWord {
        id: String,
        remembered: bool,
        review_id: String,
    },
    DeleteWord {
        id: String,
    },
}
