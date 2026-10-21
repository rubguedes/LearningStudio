use super::*;
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncRecord {
    pub id: String,
    pub kind: String,
    pub local_id: String,
    pub state: String,
    pub attempts: u32,
    pub message: String,
    pub updated_at: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleStatus {
    pub connected: bool,
    pub email: Option<String>,
    pub calendar: bool,
    pub gmail: bool,
    pub authorizing: bool,
    pub queue: Vec<SyncRecord>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GoogleConnect {
    pub client_id: String,
    pub client_secret: String,
    pub calendar: bool,
    pub gmail: bool,
}
#[derive(Debug, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum GoogleAction {
    RecoverCalendar {
        id: String,
    },
    CancelAuthorization,
    Disconnect,
    QueueTask {
        task_id: String,
        consent: bool,
    },
    DeleteEvent {
        task_id: String,
        consent: bool,
    },
    QueueEmail {
        id: String,
        subject: String,
        body: String,
        send_after: String,
        consent: bool,
    },
    ProcessQueue,
    CancelJob {
        id: String,
    },
}
