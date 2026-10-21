use super::*;
use crate::{network, vault};
use base64::{
    engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD},
    Engine,
};
use rand_core::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    io::{Read, Write},
    net::TcpListener,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc,
    },
};
use zeroize::Zeroize;
const CAL: &str = "https://www.googleapis.com/auth/calendar.app.created";
const MAIL: &str = "https://www.googleapis.com/auth/gmail.send";
const VAULT: &str = "google-oauth";
fn denied() -> AppError {
    AppError::new(
        "GOOGLE",
        "Conecte a conta e autorize somente os recursos que deseja usar.",
    )
}
fn random() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}
#[derive(Serialize, Deserialize)]
struct Account {
    client_id: String,
    client_secret: String,
    refresh_token: String,
    sub: String,
    email: String,
    calendar: bool,
    gmail: bool,
}
impl Drop for Account {
    fn drop(&mut self) {
        self.client_secret.zeroize();
        self.refresh_token.zeroize();
    }
}
fn account() -> AppResult<Option<Account>> {
    vault::get(VAULT)?
        .map(|s| serde_json::from_str(&s).map_err(|_| denied()))
        .transpose()
}
fn field(value: &Value, key: &str) -> AppResult<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty() && s.len() < 32768)
        .map(str::to_owned)
        .ok_or_else(denied)
}
fn token(account: &Account) -> AppResult<Zeroizing<String>> {
    let value = network::json(
        network::client()?
            .post("https://oauth2.googleapis.com/token")
            .form(&[
                ("grant_type", "refresh_token"),
                ("client_id", &account.client_id),
                ("client_secret", &account.client_secret),
                ("refresh_token", &account.refresh_token),
            ])
            .send()
            .map_err(|_| network::error())?,
    )?;
    Ok(Zeroizing::new(field(&value, "access_token")?))
}
pub(super) struct PendingOAuth {
    receiver: mpsc::Receiver<Result<String, ()>>,
    cancel: Arc<AtomicBool>,
    verifier: Zeroizing<String>,
    redirect: String,
    client_id: String,
    client_secret: Zeroizing<String>,
    calendar: bool,
    gmail: bool,
}
impl Drop for PendingOAuth {
    fn drop(&mut self) {
        self.cancel.store(true, Ordering::Relaxed);
    }
}
pub(super) fn callback(request: &str, port: u16, state: &str) -> Option<String> {
    let line = request.lines().next()?;
    let mut parts = line.split_whitespace();
    if parts.next()? != "GET" {
        return None;
    }
    let path = parts.next()?;
    if parts.next()? != "HTTP/1.1" || !path.starts_with("/?") {
        return None;
    }
    if !request
        .lines()
        .any(|s| s.eq_ignore_ascii_case(&format!("Host: 127.0.0.1:{port}")))
    {
        return None;
    }
    let url = reqwest::Url::parse(&format!("http://127.0.0.1:{port}{path}")).ok()?;
    let params = url.query_pairs().collect::<Vec<_>>();
    if params.iter().filter(|(k, _)| k == "state").count() != 1
        || params.iter().find(|(k, _)| k == "state")?.1 != state
    {
        return None;
    }
    if params.iter().any(|(k, _)| k == "error") {
        return Some(String::new());
    }
    if params.iter().filter(|(k, _)| k == "code").count() != 1 {
        return None;
    }
    params
        .into_iter()
        .find(|(k, _)| k == "code")
        .map(|(_, v)| v.to_string())
        .filter(|s| !s.is_empty() && s.len() < 4096)
}
impl Store {
    pub fn google_begin(&mut self, input: GoogleConnect) -> AppResult<()> {
        self.require_auth()?;
        if self.pending_oauth.is_some() {
            return Err(AppError::validation("Já há uma autorização em andamento."));
        }
        if !input.client_id.ends_with(".apps.googleusercontent.com")
            || input.client_id.len() > 200
            || !input.client_id.is_ascii()
            || input.client_secret.len() > 300
            || (!input.calendar && !input.gmail)
        {
            return Err(denied());
        }
        let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|_| {
            AppError::new(
                "OAUTH",
                "Não foi possível preparar o retorno temporário da autorização.",
            )
        })?;
        listener.set_nonblocking(true).map_err(|_| denied())?;
        let port = listener.local_addr().map_err(|_| denied())?.port();
        let redirect = format!("http://127.0.0.1:{port}/");
        let verifier = Zeroizing::new(random());
        let state = random();
        let mut url = reqwest::Url::parse("https://accounts.google.com/o/oauth2/v2/auth")
            .map_err(|_| denied())?;
        let mut scope = "openid email".to_string();
        if input.calendar {
            scope.push(' ');
            scope.push_str(CAL);
        }
        if input.gmail {
            scope.push(' ');
            scope.push_str(MAIL);
        }
        url.query_pairs_mut().extend_pairs([
            ("client_id", input.client_id.as_str()),
            ("redirect_uri", &redirect),
            ("response_type", "code"),
            ("scope", &scope),
            ("state", &state),
            (
                "code_challenge",
                &URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes())),
            ),
            ("code_challenge_method", "S256"),
            ("access_type", "offline"),
            ("prompt", "consent"),
        ]);
        let (tx, receiver) = mpsc::channel();
        let cancel = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&cancel);
        std::thread::spawn(move || {
            let start = Instant::now();
            while start.elapsed() < Duration::from_secs(300) && !flag.load(Ordering::Relaxed) {
                if let Ok((mut stream, _)) = listener.accept() {
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
                    let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
                    let mut bytes = [0u8; 8192];
                    if let Ok(length) = stream.read(&mut bytes) {
                        let request = String::from_utf8_lossy(&bytes[..length]);
                        if let Some(code) = callback(&request, port, &state) {
                            let body = "Autorizacao recebida. Volte ao LearningStudio.";
                            let _=write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body);
                            let _ = tx.send(if code.is_empty() { Err(()) } else { Ok(code) });
                            return;
                        }
                        let _=stream.write_all(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                    }
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            let _ = tx.send(Err(()));
        });
        self.pending_oauth = Some(PendingOAuth {
            receiver,
            cancel,
            verifier,
            redirect,
            client_id: input.client_id,
            client_secret: Zeroizing::new(input.client_secret),
            calendar: input.calendar,
            gmail: input.gmail,
        });
        if webbrowser::open(url.as_str()).is_err() {
            self.pending_oauth = None;
            return Err(AppError::new(
                "OAUTH",
                "Não foi possível abrir o navegador padrão.",
            ));
        }
        Ok(())
    }
    fn finish_authorization(&mut self) -> AppResult<()> {
        let Some(pending) = self.pending_oauth.as_ref() else {
            return Ok(());
        };
        let code = match pending.receiver.try_recv() {
            Ok(Ok(code)) => Zeroizing::new(code),
            Ok(Err(())) | Err(mpsc::TryRecvError::Disconnected) => {
                self.pending_oauth = None;
                return Err(AppError::new(
                    "OAUTH",
                    "Autorização cancelada ou expirada. Tente novamente quando desejar.",
                ));
            }
            Err(mpsc::TryRecvError::Empty) => return Ok(()),
        };
        let pending = self.pending_oauth.take().ok_or_else(denied)?;
        let value = network::json(
            network::client()?
                .post("https://oauth2.googleapis.com/token")
                .form(&[
                    ("grant_type", "authorization_code"),
                    ("client_id", pending.client_id.as_str()),
                    ("client_secret", pending.client_secret.as_str()),
                    ("redirect_uri", &pending.redirect),
                    ("code", code.as_str()),
                    ("code_verifier", pending.verifier.as_str()),
                ])
                .send()
                .map_err(|_| network::error())?,
        )?;
        let access = Zeroizing::new(field(&value, "access_token")?);
        let scopes = field(&value, "scope")?;
        if (pending.calendar && !scopes.split_whitespace().any(|s| s == CAL))
            || (pending.gmail && !scopes.split_whitespace().any(|s| s == MAIL))
        {
            return Err(denied());
        }
        let identity = network::json(
            network::client()?
                .get("https://openidconnect.googleapis.com/v1/userinfo")
                .bearer_auth(access.as_str())
                .send()
                .map_err(|_| network::error())?,
        )?;
        if identity.get("email_verified").and_then(Value::as_bool) != Some(true) {
            return Err(denied());
        }
        let account = Account {
            client_id: pending.client_id.clone(),
            client_secret: pending.client_secret.to_string(),
            refresh_token: field(&value, "refresh_token")?,
            sub: field(&identity, "sub")?,
            email: field(&identity, "email")?,
            calendar: pending.calendar,
            gmail: pending.gmail,
        };
        let encoded = Zeroizing::new(serde_json::to_string(&account).map_err(|_| denied())?);
        vault::put(VAULT, &encoded)?;
        Ok(())
    }
    pub fn google_status(&mut self) -> AppResult<GoogleStatus> {
        // Polling de OAuth/fila não renova o prazo de inatividade.
        if !self.is_unlocked() {
            self.pending_oauth = None;
            return Err(AppError::new(
                "LOCKED",
                "Desbloqueie o aplicativo para acessar as integrações.",
            ));
        }
        self.finish_authorization()?;
        let account = account()?;
        let mut queue = vec![];
        if let Some(account) = &account {
            let mut q=self.connection.prepare("SELECT id,kind,local_id,state,attempts,message,updated_at FROM sync_records WHERE account_id=?1 ORDER BY created_at DESC LIMIT 100").map_err(AppError::database)?;
            queue = q
                .query_map([&account.sub], |r| {
                    Ok(SyncRecord {
                        id: r.get(0)?,
                        kind: r.get(1)?,
                        local_id: r.get(2)?,
                        state: r.get(3)?,
                        attempts: r.get(4)?,
                        message: r.get(5)?,
                        updated_at: r.get(6)?,
                    })
                })
                .map_err(AppError::database)?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(AppError::database)?;
        }
        Ok(GoogleStatus {
            connected: account.is_some(),
            email: account.as_ref().map(|a| a.email.clone()),
            calendar: account.as_ref().is_some_and(|a| a.calendar),
            gmail: account.as_ref().is_some_and(|a| a.gmail),
            authorizing: self.pending_oauth.is_some(),
            queue,
        })
    }
    pub fn google_action(&mut self, action: GoogleAction) -> AppResult<()> {
        if matches!(action, GoogleAction::ProcessQueue) {
            if !self.is_unlocked() {
                return Err(AppError::new(
                    "LOCKED",
                    "Desbloqueie o aplicativo para processar a fila.",
                ));
            }
        } else {
            self.require_auth()?;
        }
        if matches!(action, GoogleAction::CancelAuthorization) {
            self.pending_oauth = None;
            return Ok(());
        }
        if matches!(action, GoogleAction::Disconnect) {
            self.pending_oauth = None;
            vault::remove(VAULT)?;
            return Ok(());
        }
        let account = account()?.ok_or_else(denied)?;
        match action {
            GoogleAction::RecoverCalendar { id } => {
                if !account.calendar || id.len() > 1024 || id.is_empty() {
                    return Err(denied());
                }
                let key = format!("google-calendar:{}", account.sub);
                let prior: Option<String> = self
                    .connection
                    .query_row("SELECT value FROM app_settings WHERE key=?1", [&key], |r| {
                        r.get(0)
                    })
                    .optional()
                    .map_err(AppError::database)?;
                if prior.as_deref() != Some("uncertain") {
                    return Err(AppError::validation(
                        "Não há criação de calendário pendente de reconciliação.",
                    ));
                }
                let access = token(&account)?;
                let mut url =
                    reqwest::Url::parse("https://www.googleapis.com/calendar/v3/calendars/")
                        .map_err(|_| denied())?;
                url.path_segments_mut()
                    .map_err(|_| denied())?
                    .pop_if_empty()
                    .push(&id);
                let data = network::json(
                    network::client()?
                        .get(url)
                        .bearer_auth(access.as_str())
                        .send()
                        .map_err(|_| network::error())?,
                )?;
                if data.get("summary").and_then(Value::as_str) != Some("LearningStudio")
                    || field(&data, "id")? != id
                {
                    return Err(denied());
                }
                self.connection
                    .execute(
                        "UPDATE app_settings SET value=?1 WHERE key=?2",
                        params![id, key],
                    )
                    .map_err(AppError::database)?;
            }
            GoogleAction::QueueTask { task_id, consent } => {
                validation::id(&task_id)?;
                if !consent || !account.calendar {
                    return Err(denied());
                }
                let task = self
                    .snapshot()?
                    .tasks
                    .into_iter()
                    .find(|t| t.id == task_id)
                    .ok_or_else(AppError::not_found)?;
                let due = task.due_date.ok_or_else(|| {
                    AppError::validation("Defina um prazo para enviar esta tarefa ao calendário.")
                })?;
                let day =
                    chrono::NaiveDate::parse_from_str(&due, "%Y-%m-%d").map_err(|_| denied())?;
                let end = day.succ_opt().ok_or_else(denied)?.to_string();
                let event_id = format!("ls{}", uuid::Uuid::new_v4().simple());
                self.connection.execute("INSERT INTO google_events(account_id,local_id,event_id) VALUES (?1,?2,?3) ON CONFLICT(account_id,local_id) DO UPDATE SET event_id=CASE WHEN deleted=1 THEN excluded.event_id ELSE event_id END,deleted=0",params![account.sub,task_id,event_id]).map_err(AppError::database)?;
                self.enqueue(&account.sub,"calendar_upsert",&task_id,json!({"summary":task.title,"description":task.notes,"start":{"date":due},"end":{"date":end},"extendedProperties":{"private":{"learningstudio":"1","localId":task_id}}}),&now())?;
            }
            GoogleAction::DeleteEvent { task_id, consent } => {
                validation::id(&task_id)?;
                if !consent || !account.calendar {
                    return Err(denied());
                }
                let known:bool=self.connection.query_row("SELECT EXISTS(SELECT 1 FROM google_events WHERE account_id=?1 AND local_id=?2 AND deleted=0)",params![account.sub,task_id],|r|r.get(0)).map_err(AppError::database)?;
                if !known {
                    return Err(AppError::validation(
                        "O evento não pertence aos registros deste aplicativo.",
                    ));
                }
                self.enqueue(&account.sub, "calendar_delete", &task_id, json!({}), &now())?;
            }
            GoogleAction::QueueEmail {
                id,
                subject,
                body,
                send_after,
                consent,
            } => {
                validation::id(&id)?;
                if !consent || !account.gmail {
                    return Err(denied());
                }
                if subject.trim().is_empty()
                    || subject.len() > 300
                    || subject.chars().any(char::is_control)
                    || body.trim().is_empty()
                    || body.len() > 20000
                {
                    return Err(AppError::validation(
                        "Informe assunto e mensagem dentro dos limites.",
                    ));
                }
                let after = chrono::DateTime::parse_from_rfc3339(&send_after)
                    .map_err(|_| AppError::validation("Informe um horário válido para envio."))?
                    .with_timezone(&Utc)
                    .to_rfc3339_opts(SecondsFormat::Millis, true);
                self.enqueue(
                    &account.sub,
                    "gmail_send",
                    &id,
                    json!({"subject":subject,"body":body}),
                    &after,
                )?;
            }
            GoogleAction::ProcessQueue => self.process_google(&account, &RealGoogle)?,
            GoogleAction::CancelJob { id } => {
                validation::id(&id)?;
                self.connection.execute("UPDATE sync_records SET state='cancelled',updated_at=?1 WHERE id=?2 AND account_id=?3 AND state IN('pending','failed')",params![now(),id,account.sub]).map_err(AppError::database)?;
            }
            _ => {}
        }
        Ok(())
    }
    fn enqueue(
        &mut self,
        account: &str,
        kind: &str,
        local_id: &str,
        payload: Value,
        after: &str,
    ) -> AppResult<()> {
        if kind.starts_with("calendar_") {
            self.connection.execute("UPDATE sync_records SET state='cancelled',message='Substituído pela solicitação mais recente.',updated_at=?1 WHERE account_id=?2 AND local_id=?3 AND kind<>?4 AND kind IN('calendar_upsert','calendar_delete') AND state='pending'",params![now(),account,local_id,kind]).map_err(AppError::database)?;
        }
        if kind == "gmail_send" {
            let exists:bool=self.connection.query_row("SELECT EXISTS(SELECT 1 FROM sync_records WHERE account_id=?1 AND kind=?2 AND local_id=?3)",params![account,kind,local_id],|r|r.get(0)).map_err(AppError::database)?;
            if exists {
                return Ok(());
            }
        }
        let encoded = serde_json::to_string(&payload).map_err(|_| denied())?;
        self.connection.execute("INSERT INTO sync_records VALUES (?1,?2,?3,?4,?5,'pending',0,?6,'',?7,?7) ON CONFLICT(account_id,kind,local_id) WHERE state IN('pending','sending') DO UPDATE SET payload=excluded.payload,next_attempt_at=excluded.next_attempt_at,updated_at=excluded.updated_at",params![uuid::Uuid::new_v4().to_string(),account,kind,local_id,encoded,after,now()]).map_err(AppError::database)?;
        Ok(())
    }
    fn process_google(
        &mut self,
        account: &Account,
        transport: &impl GoogleTransport,
    ) -> AppResult<()> {
        type Job = (String, String, String, String, u32);
        let job:Option<Job>=self.connection.query_row("SELECT id,kind,local_id,payload,attempts FROM sync_records WHERE account_id=?1 AND state='pending' AND next_attempt_at<=?2 ORDER BY created_at,id LIMIT 1",params![account.sub,now()],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?))).optional().map_err(AppError::database)?;
        let Some((id, kind, local_id, payload, attempts)) = job else {
            return Ok(());
        };
        // Obter token é anterior a qualquer tentativa de envio. Offline aqui mantém pendência segura.
        let token = transport.token(account)?;
        let payload: Value = serde_json::from_str(&payload).map_err(|_| denied())?;
        self.connection.execute("UPDATE sync_records SET state='sending',attempts=attempts+1,updated_at=?1 WHERE id=?2",params![now(),id]).map_err(AppError::database)?;
        let result = transport.execute(self, account, &token, &kind, &local_id, &payload);
        match result {
            Ok(()) => {
                self.connection.execute("UPDATE sync_records SET state='done',message='Operação confirmada.',updated_at=?1 WHERE id=?2",params![now(),id]).map_err(AppError::database)?;
            }
            Err(issue) => {
                let (state, message) = if issue.code == "CONFLICT" || issue.code == "RECONCILE" {
                    ("failed", issue.message)
                } else if kind == "gmail_send" {
                    ("uncertain","Envio não confirmado. Verifique a pasta Enviados no Gmail antes de criar outro lembrete.")
                } else if attempts >= 4 {
                    ("failed","Limite de tentativas atingido. Revise a configuração e crie uma nova solicitação.")
                } else {
                    (
                        "pending",
                        "Falha de sincronização. Nova tentativa ficará disponível após a espera.",
                    )
                };
                let after = (Utc::now()
                    + chrono::Duration::seconds(60 * (1_i64 << attempts.min(4))))
                .to_rfc3339_opts(SecondsFormat::Millis, true);
                self.connection.execute("UPDATE sync_records SET state=?1,message=?2,next_attempt_at=?3,updated_at=?4 WHERE id=?5",params![state,message,after,now(),id]).map_err(AppError::database)?;
            }
        }
        Ok(())
    }
}
trait GoogleTransport {
    fn token(&self, account: &Account) -> AppResult<Zeroizing<String>>;
    fn execute(
        &self,
        store: &mut Store,
        account: &Account,
        token: &str,
        kind: &str,
        local_id: &str,
        payload: &Value,
    ) -> AppResult<()>;
}
struct RealGoogle;
fn event_url(calendar: &str, event: Option<&str>) -> AppResult<reqwest::Url> {
    let mut url = reqwest::Url::parse("https://www.googleapis.com/calendar/v3/calendars/")
        .map_err(|_| denied())?;
    {
        let mut path = url.path_segments_mut().map_err(|_| denied())?;
        path.pop_if_empty().push(calendar).push("events");
        if let Some(event) = event {
            path.push(event);
        }
    }
    Ok(url)
}
fn owned(event: &Value, local_id: &str) -> bool {
    event
        .pointer("/extendedProperties/private/learningstudio")
        .and_then(Value::as_str)
        == Some("1")
        && event
            .pointer("/extendedProperties/private/localId")
            .and_then(Value::as_str)
            == Some(local_id)
}
impl GoogleTransport for RealGoogle {
    fn token(&self, account: &Account) -> AppResult<Zeroizing<String>> {
        token(account)
    }
    fn execute(
        &self,
        store: &mut Store,
        account: &Account,
        token: &str,
        kind: &str,
        local_id: &str,
        payload: &Value,
    ) -> AppResult<()> {
        let client = network::client()?;
        if kind == "gmail_send" {
            if !account.gmail {
                return Err(denied());
            }
            if account.email.chars().any(char::is_control) || !account.email.contains('@') {
                return Err(denied());
            }
            let subject = field(payload, "subject")?;
            let body = field(payload, "body")?;
            let encoded_body = STANDARD.encode(body.as_bytes());
            let encoded_body = encoded_body
                .as_bytes()
                .chunks(76)
                .map(|line| String::from_utf8_lossy(line).into_owned())
                .collect::<Vec<_>>()
                .join("\r\n");
            let mime=format!("To: {}\r\nSubject: =?UTF-8?B?{}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\nMessage-ID: <{}@learningstudio.local>\r\n\r\n{}",account.email,STANDARD.encode(subject.as_bytes()),local_id,encoded_body);
            network::json(
                client
                    .post("https://gmail.googleapis.com/gmail/v1/users/me/messages/send")
                    .bearer_auth(token)
                    .json(&json!({"raw":URL_SAFE_NO_PAD.encode(mime.as_bytes())}))
                    .send()
                    .map_err(|_| network::error())?,
            )?;
            return Ok(());
        }
        if !account.calendar {
            return Err(denied());
        }
        let key = format!("google-calendar:{}", account.sub);
        let calendar: Option<String> = store
            .connection
            .query_row("SELECT value FROM app_settings WHERE key=?1", [&key], |r| {
                r.get(0)
            })
            .optional()
            .map_err(AppError::database)?;
        let calendar = if let Some(calendar) = calendar {
            if calendar == "uncertain" {
                return Err(AppError::new("RECONCILE","A criação do calendário não foi confirmada. Reconcilie a conta antes de repetir."));
            }
            calendar
        } else {
            store
                .connection
                .execute("INSERT INTO app_settings VALUES (?1,'uncertain')", [&key])
                .map_err(AppError::database)?;
            let response=network::json(client.post("https://www.googleapis.com/calendar/v3/calendars").bearer_auth(token).json(&json!({"summary":"LearningStudio","description":"Calendário criado pelo LearningStudio. Somente eventos do aplicativo são gerenciados."})).send().map_err(|_|network::error())?)?;
            let calendar = field(&response, "id")?;
            store
                .connection
                .execute(
                    "UPDATE app_settings SET value=?1 WHERE key=?2",
                    params![calendar, key],
                )
                .map_err(AppError::database)?;
            calendar
        };
        let event: String = store
            .connection
            .query_row(
                "SELECT event_id FROM google_events WHERE account_id=?1 AND local_id=?2",
                params![account.sub, local_id],
                |r| r.get(0),
            )
            .map_err(AppError::database)?;
        let previous_etag: Option<String> = store
            .connection
            .query_row(
                "SELECT etag FROM google_events WHERE account_id=?1 AND local_id=?2",
                params![account.sub, local_id],
                |r| r.get(0),
            )
            .map_err(AppError::database)?;
        let mut saved_etag = None;
        let url = event_url(&calendar, Some(&event))?;
        let response = client
            .get(url.clone())
            .bearer_auth(token)
            .send()
            .map_err(|_| network::error())?;
        if response.status() == reqwest::StatusCode::NOT_FOUND
            || response.status() == reqwest::StatusCode::GONE
        {
            if kind == "calendar_upsert" {
                let mut data = payload.clone();
                data["id"] = Value::String(event);
                let created = network::json(
                    client
                        .post(event_url(&calendar, None)?)
                        .bearer_auth(token)
                        .json(&data)
                        .send()
                        .map_err(|_| network::error())?,
                )?;
                saved_etag = Some(field(&created, "etag")?);
            }
        } else {
            let data = network::json(response)?;
            if !owned(&data, local_id) {
                return Err(AppError::validation(
                    "O evento remoto não pertence ao LearningStudio. Alteração recusada.",
                ));
            }
            let etag = field(&data, "etag")?;
            if previous_etag.as_ref().is_some_and(|prior| prior != &etag) {
                return Err(AppError::new("CONFLICT","O evento mudou no Google. A versão remota foi preservada; revise o conflito antes de tentar novamente."));
            }
            if kind == "calendar_delete" {
                let response = client
                    .delete(url)
                    .bearer_auth(token)
                    .header(reqwest::header::IF_MATCH, etag)
                    .send()
                    .map_err(|_| network::error())?;
                if response.status() == reqwest::StatusCode::PRECONDITION_FAILED {
                    return Err(AppError::new(
                        "CONFLICT",
                        "O evento mudou durante a operação. A versão remota foi preservada.",
                    ));
                }
                if !response.status().is_success() {
                    return Err(network::error());
                }
            } else {
                let response = client
                    .put(url)
                    .bearer_auth(token)
                    .header(reqwest::header::IF_MATCH, etag)
                    .json(payload)
                    .send()
                    .map_err(|_| network::error())?;
                if response.status() == reqwest::StatusCode::PRECONDITION_FAILED {
                    return Err(AppError::new(
                        "CONFLICT",
                        "O evento mudou durante a operação. A versão remota foi preservada.",
                    ));
                }
                saved_etag = Some(field(&network::json(response)?, "etag")?);
            }
        }
        if let Some(etag) = saved_etag {
            store
                .connection
                .execute(
                    "UPDATE google_events SET etag=?1 WHERE account_id=?2 AND local_id=?3",
                    params![etag, account.sub, local_id],
                )
                .map_err(AppError::database)?;
        }
        if kind == "calendar_delete" {
            store
                .connection
                .execute(
                    "UPDATE google_events SET deleted=1 WHERE account_id=?1 AND local_id=?2",
                    params![account.sub, local_id],
                )
                .map_err(AppError::database)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::super::tests::store;
    use super::*;
    fn fixture() -> Account {
        Account {
            client_id: "fixture.apps.googleusercontent.com".into(),
            client_secret: "".into(),
            refresh_token: "fixture".into(),
            sub: "test-sub".into(),
            email: "self@example.com".into(),
            calendar: true,
            gmail: true,
        }
    }
    struct Fake {
        offline: bool,
        fail: bool,
    }
    impl GoogleTransport for Fake {
        fn token(&self, _: &Account) -> AppResult<Zeroizing<String>> {
            if self.offline {
                Err(network::error())
            } else {
                Ok(Zeroizing::new("fixture".into()))
            }
        }
        fn execute(
            &self,
            _: &mut Store,
            _: &Account,
            _: &str,
            _: &str,
            _: &str,
            _: &Value,
        ) -> AppResult<()> {
            if self.fail {
                Err(network::error())
            } else {
                Ok(())
            }
        }
    }
    #[test]
    fn callback_rejects_state_host_and_duplicate_code() {
        let request = "GET /?state=right&code=abc HTTP/1.1\r\nHost: 127.0.0.1:9999\r\n\r\n";
        assert_eq!(callback(request, 9999, "right").as_deref(), Some("abc"));
        assert!(callback(request, 9999, "wrong").is_none());
        assert!(callback(request, 1234, "right").is_none());
        assert!(callback(
            &request.replace("code=abc", "code=abc&code=def"),
            9999,
            "right"
        )
        .is_none());
    }
    #[test]
    fn event_ownership_requires_app_marker_and_matching_local_id() {
        assert!(owned(
            &json!({"extendedProperties":{"private":{"learningstudio":"1","localId":"x"}}}),
            "x"
        ));
        assert!(!owned(
            &json!({"extendedProperties":{"private":{"localId":"x"}}}),
            "x"
        ));
    }
    #[test]
    fn offline_queue_survives_and_duplicate_mail_id_is_not_resent() {
        let mut s = store();
        for _ in 0..2 {
            s.enqueue(
                "test-sub",
                "gmail_send",
                "mail-1",
                json!({"subject":"Hello","body":"Reminder"}),
                &now(),
            )
            .unwrap();
        }
        assert!(s
            .process_google(
                &fixture(),
                &Fake {
                    offline: true,
                    fail: false
                }
            )
            .is_err());
        assert_eq!(
            s.connection
                .query_row("SELECT COUNT(*) FROM sync_records", [], |r| r
                    .get::<_, i64>(0))
                .unwrap(),
            1
        );
        s.process_google(
            &fixture(),
            &Fake {
                offline: false,
                fail: false,
            },
        )
        .unwrap();
        s.enqueue("test-sub", "gmail_send", "mail-1", json!({}), &now())
            .unwrap();
        assert_eq!(
            s.connection
                .query_row("SELECT state FROM sync_records", [], |r| r
                    .get::<_, String>(0))
                .unwrap(),
            "done"
        );
    }
    #[test]
    fn uncertain_email_is_not_retried_automatically() {
        let mut s = store();
        s.enqueue("test-sub", "gmail_send", "mail-1", json!({}), &now())
            .unwrap();
        s.process_google(
            &fixture(),
            &Fake {
                offline: false,
                fail: true,
            },
        )
        .unwrap();
        s.process_google(
            &fixture(),
            &Fake {
                offline: false,
                fail: false,
            },
        )
        .unwrap();
        assert_eq!(
            s.connection
                .query_row("SELECT state FROM sync_records", [], |r| r
                    .get::<_, String>(0))
                .unwrap(),
            "uncertain"
        );
    }
    #[test]
    fn calendar_failure_is_pending_with_backoff_and_accounts_are_isolated() {
        let mut s = store();
        s.enqueue("other", "calendar_upsert", "task", json!({}), &now())
            .unwrap();
        s.process_google(
            &fixture(),
            &Fake {
                offline: false,
                fail: false,
            },
        )
        .unwrap();
        assert_eq!(
            s.connection
                .query_row("SELECT attempts FROM sync_records", [], |r| r
                    .get::<_, i64>(0))
                .unwrap(),
            0
        );
        s.enqueue("test-sub", "calendar_upsert", "task", json!({}), &now())
            .unwrap();
        s.process_google(
            &fixture(),
            &Fake {
                offline: false,
                fail: true,
            },
        )
        .unwrap();
        assert_eq!(
            s.connection
                .query_row(
                    "SELECT state FROM sync_records WHERE account_id='test-sub'",
                    [],
                    |r| r.get::<_, String>(0)
                )
                .unwrap(),
            "pending"
        );
    }
}
