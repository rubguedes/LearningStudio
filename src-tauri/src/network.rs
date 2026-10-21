use crate::models::*;
use std::{io::Read, time::Duration};
pub fn client() -> AppResult<reqwest::blocking::Client> {
    client_with_timeout(25)
}
pub fn client_with_timeout(seconds: u64) -> AppResult<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(seconds))
        .connect_timeout(Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::none())
        .https_only(true)
        .build()
        .map_err(|_| error())
}
pub fn error() -> AppError {
    AppError::new(
        "NETWORK",
        "Não foi possível confirmar a operação remota. Confira a conexão e o estado da fila.",
    )
}
pub fn json(response: reqwest::blocking::Response) -> AppResult<serde_json::Value> {
    if !response.status().is_success() {
        return Err(error());
    }
    let mut body = String::new();
    response
        .take(1_048_577)
        .read_to_string(&mut body)
        .map_err(|_| error())?;
    if body.len() > 1_048_576 {
        return Err(error());
    }
    serde_json::from_str(&body).map_err(|_| error())
}
