use super::*;
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Topic {
    pub id: String,
    pub title: String,
    pub notes: String,
    pub area_id: Option<String>,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Resource {
    pub id: String,
    pub title: String,
    pub notes: String,
    pub url: String,
    pub topic_id: Option<String>,
    pub archived: bool,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizerSnapshot {
    pub topics: Vec<Topic>,
    pub resources: Vec<Resource>,
}
#[derive(Debug, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum OrganizerAction {
    SaveTopic { input: Topic },
    SaveResource { input: Resource },
    DeleteTopic { id: String },
    DeleteResource { id: String },
}
