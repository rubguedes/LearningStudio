use super::*;
#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AISettings {
    pub provider: String,
    pub openai_model: String,
    pub ollama_model: String,
    pub monthly_limit_micros: u64,
    pub input_price_per_million: f64,
    pub output_price_per_million: f64,
    pub currency: String,
    pub prices_updated_at: String,
    pub max_output_tokens: u32,
}
impl Default for AISettings {
    fn default() -> Self {
        Self {
            provider: "disabled".into(),
            openai_model: "".into(),
            ollama_model: "".into(),
            monthly_limit_micros: 0,
            input_price_per_million: 0.0,
            output_price_per_million: 0.0,
            currency: "USD".into(),
            prices_updated_at: "".into(),
            max_output_tokens: 4096,
        }
    }
}
impl AISettings {
    // Standard text pricing checked against the official model page on 2026-10-21.
    // This dated preset expires under the same 30-day validation as manual prices.
    pub fn recommended() -> Self {
        Self {
            provider: "openai".into(),
            openai_model: "gpt-5.4-mini-2026-03-17".into(),
            monthly_limit_micros: 5_000_000,
            input_price_per_million: 0.75,
            output_price_per_million: 4.5,
            prices_updated_at: "2026-10-21".into(),
            max_output_tokens: 8192,
            ..Self::default()
        }
    }
}
#[cfg(test)]
mod preset_tests {
    use super::*;
    #[test]
    fn quick_setup_is_dated_limited_and_contains_no_secret() {
        let s = AISettings::recommended();
        assert_eq!(s.currency, "USD");
        assert_eq!(s.monthly_limit_micros, 5_000_000);
        assert_eq!(s.max_output_tokens, 8192);
        assert_eq!(s.prices_updated_at, "2026-10-21");
        let json = serde_json::to_string(&s).unwrap();
        assert!(!json.contains("apiKey"));
        assert!(!json.contains("secret"));
    }
}
#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CodeExample {
    pub input: String,
    pub output: String,
}
#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CodingChallenge {
    pub id: String,
    pub title: String,
    pub language: String,
    pub difficulty: String,
    pub prompt: String,
    pub examples: Vec<CodeExample>,
    pub constraints: Vec<String>,
    pub hints: Vec<String>,
    pub criteria: Vec<String>,
    pub visible_tests: Vec<String>,
}
#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GeneratedChallenge {
    pub challenge: CodingChallenge,
    pub reference: String,
    pub hidden_tests: Vec<String>,
}
#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Finding {
    pub category: String,
    pub excerpt: String,
    pub suggestion: String,
    pub explanation: String,
}
#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Feedback {
    pub summary: String,
    pub findings: Vec<Finding>,
    pub revised: String,
    pub follow_up: String,
    pub uncertainties: Vec<String>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeSubmission {
    pub id: String,
    pub challenge_id: String,
    pub code: String,
    pub submitted_at: Option<String>,
    pub updated_at: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationResult {
    pub id: String,
    pub english_submission_id: Option<String>,
    pub code_submission_id: Option<String>,
    pub source: String,
    pub feedback: Feedback,
    pub created_at: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AIUsageRecord {
    pub id: String,
    pub provider: String,
    pub model: String,
    pub task: String,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub cost_micros: Option<u64>,
    pub reserved_micros: u64,
    pub currency: String,
    pub state: String,
    pub created_at: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TutorSnapshot {
    pub settings: AISettings,
    pub has_key: bool,
    pub challenges: Vec<CodingChallenge>,
    pub submissions: Vec<CodeSubmission>,
    pub evaluations: Vec<EvaluationResult>,
    pub usage: Vec<AIUsageRecord>,
    pub execution_available: bool,
}
#[derive(Debug, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum TutorAction {
    QuickSetup {
        key: String,
    },
    CheckConnection,
    SaveChallenge {
        input: GeneratedChallenge,
    },
    SaveSettings {
        settings: AISettings,
    },
    SaveKey {
        key: String,
    },
    RemoveKey,
    SaveCode {
        id: String,
        challenge_id: String,
        code: String,
        submit: bool,
    },
    StaticReview {
        submission_id: String,
    },
    SelfReview {
        submission_id: String,
        notes: String,
        revised: String,
    },
    GenerateLesson {
        topic: String,
        level: String,
        consent: bool,
    },
    GenerateChallenge {
        topic: String,
        language: String,
        difficulty: String,
        consent: bool,
    },
    ReviewEnglish {
        submission_id: String,
        consent: bool,
    },
    ReviewCode {
        submission_id: String,
        consent: bool,
    },
}
