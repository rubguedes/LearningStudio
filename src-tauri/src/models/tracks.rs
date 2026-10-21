use super::*;
#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LanguageProfile {
    pub id: String,
    pub language: String,
    pub current_level: String,
    pub target_level: String,
    pub deadline: String,
    pub minutes_per_day: u32,
    pub weekdays: Vec<u32>,
}
#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanStep {
    pub title: String,
    pub minutes: u32,
    pub activity: String,
    pub criteria: String,
    pub review: String,
}
#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrackPlan {
    pub title: String,
    pub assumptions: Vec<String>,
    pub steps: Vec<PlanStep>,
}
#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CareerContent {
    pub topic: String,
    pub prerequisites: Vec<String>,
    pub priority: String,
    pub theory: String,
    pub concepts: Vec<String>,
    pub example: String,
    pub explanation: String,
    pub challenge: String,
    pub acceptance: Vec<String>,
    pub artifact: String,
    pub source_ids: Vec<String>,
    pub uncertainties: Vec<String>,
}
#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ResumeVersion {
    pub text: String,
    pub skills: Vec<String>,
    pub review_days: u32,
}
#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ResumeProposal {
    pub original_id: String,
    pub suggestions: Vec<String>,
    pub uncertainties: Vec<String>,
}
#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SourceRecord {
    pub title: String,
    pub institution: String,
    pub url: String,
    pub date: String,
    pub claim: String,
}
#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct JobRecord {
    pub title: String,
    pub url: String,
    pub date: String,
    pub location: String,
    pub modality: String,
    pub seniority: String,
    pub requirements: Vec<String>,
    pub evidence: String,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrackDocument {
    pub id: String,
    pub profile_id: Option<String>,
    pub kind: String,
    pub content: serde_json::Value,
    pub created_at: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PracticeError {
    pub id: String,
    pub topic: String,
    pub category: String,
    pub excerpt: String,
    pub correction: String,
    pub explanation: String,
    pub severity: u32,
    pub classification: String,
    pub repetitions: u32,
    pub reviews: u32,
    pub successes: u32,
    pub next_review: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonPdf {
    pub id: String,
    pub lesson_id: String,
    pub name: String,
    pub created_at: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TracksSnapshot {
    pub profiles: Vec<LanguageProfile>,
    pub documents: Vec<TrackDocument>,
    pub errors: Vec<PracticeError>,
    pub pdfs: Vec<LessonPdf>,
    pub pdf_reviews: Vec<PdfReview>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfReview {
    pub id: String,
    pub pdf_id: String,
    pub transcription: String,
    pub feedback: Feedback,
    pub created_at: String,
}
#[derive(Debug, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum TracksAction {
    ExportPdf { id:String },
    SaveCareerPreferences { target_role:String, region:String },
    GenerateLanguageLesson {
        profile_id: String,
        topic: String,
        consent: bool,
    },
    SaveProfile {
        input: LanguageProfile,
    },
    SuggestPlan {
        profile_id: String,
        consent: bool,
    },
    SavePlan {
        id: String,
        profile_id: String,
        input: TrackPlan,
    },
    ApplyPlan {
        id: String,
    },
    Classify {
        id: String,
        classification: String,
        severity: u32,
    },
    Recall {
        id: String,
        answer: String,
        recalled: bool,
    },
    SaveSource {
        input: SourceRecord,
    },
    SuggestTopic {
        topic: String,
        consent: bool,
    },
    SaveResume {
        input: ResumeVersion,
    },
    ReviewResume {
        id: String,
        consent: bool,
    },
    SaveJob {
        input: JobRecord,
    },
    FetchGithub {
        repository: String,
        consent: bool,
    },
    ReviewPdf {
        id: String,
        transcription: String,
        consent: bool,
    },
}
