use crate::{models::*, network, vault};
use serde_json::{json, Value};
use std::time::Duration;
pub struct ProviderReply {
    pub text: String,
    pub input: Option<u64>,
    pub output: Option<u64>,
}
pub trait AIProvider {
    fn generate(
        &self,
        settings: &AISettings,
        instructions: &str,
        data: &str,
        schema: Value,
    ) -> AppResult<ProviderReply>;
}
pub struct OpenAI;
pub struct Ollama;
fn remote_json(response: reqwest::blocking::Response) -> AppResult<Value> {
    let issue = match response.status().as_u16() {
        401 | 403 => Some(("AI_AUTH", "A chave foi recusada ou não tem acesso ao modelo. Confira o projeto e as permissões na OpenAI.")),
        429 => Some(("AI_LIMIT", "A OpenAI informou limite de uso ou saldo indisponível. Confira a cobrança e tente novamente mais tarde.")),
        400 | 404 => Some(("AI_MODEL", "A OpenAI recusou o modelo ou contrato. Confira o modelo configurado e sua disponibilidade.")),
        _ => None,
    };
    if let Some((code, message)) = issue {
        return Err(AppError::new(code, message));
    }
    network::json(response)
}
pub fn check_connection(settings: &AISettings) -> AppResult<()> {
    if settings.provider == "openai" {
        let key = vault::get("openai-api-key")?.ok_or_else(|| {
            AppError::new("AI_KEY", "Guarde uma chave antes de verificar a conexão.")
        })?;
        let mut endpoint =
            reqwest::Url::parse("https://api.openai.com/v1/models/").map_err(|_| invalid())?;
        endpoint
            .path_segments_mut()
            .map_err(|_| invalid())?
            .pop_if_empty()
            .push(&settings.openai_model);
        let value = remote_json(
            network::client()?
                .get(endpoint)
                .bearer_auth(key.as_str())
                .send()
                .map_err(|_| network::error())?,
        )?;
        if value.get("id").and_then(Value::as_str) != Some(settings.openai_model.as_str()) {
            return Err(invalid());
        }
    } else if settings.provider == "ollama" {
        let client = reqwest::blocking::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(5))
            .build()
            .map_err(|_| network::error())?;
        let value = network::json(
            client
                .get("http://127.0.0.1:11434/api/tags")
                .send()
                .map_err(|_| network::error())?,
        )?;
        if !value
            .get("models")
            .and_then(Value::as_array)
            .is_some_and(|models| {
                models.iter().any(|m| {
                    m.get("name").and_then(Value::as_str) == Some(settings.ollama_model.as_str())
                })
            })
        {
            return Err(AppError::validation(
                "O modelo configurado não aparece entre os modelos locais instalados.",
            ));
        }
    } else {
        return Err(AppError::validation(
            "Escolha um provedor antes de verificar a conexão.",
        ));
    }
    Ok(())
}
fn invalid() -> AppError {
    AppError::new(
        "AI_RESPONSE",
        "O modelo não retornou uma resposta completa e válida. Seu trabalho foi preservado.",
    )
}
pub fn parse_openai(value: Value) -> AppResult<ProviderReply> {
    if value.get("status").and_then(Value::as_str) != Some("completed") {
        return Err(invalid());
    }
    let output = value
        .get("output")
        .and_then(Value::as_array)
        .ok_or_else(invalid)?;
    let mut text = String::new();
    for item in output {
        if let Some(content) = item.get("content").and_then(Value::as_array) {
            for part in content {
                if part.get("type").and_then(Value::as_str) == Some("refusal") {
                    return Err(invalid());
                }
                if part.get("type").and_then(Value::as_str) == Some("output_text") {
                    text.push_str(
                        part.get("text")
                            .and_then(Value::as_str)
                            .ok_or_else(invalid)?,
                    );
                }
            }
        }
    }
    if text.is_empty() || text.len() > 100000 {
        return Err(invalid());
    }
    Ok(ProviderReply {
        text,
        input: value.pointer("/usage/input_tokens").and_then(Value::as_u64),
        output: value
            .pointer("/usage/output_tokens")
            .and_then(Value::as_u64),
    })
}
impl AIProvider for OpenAI {
    fn generate(
        &self,
        settings: &AISettings,
        instructions: &str,
        data: &str,
        schema: Value,
    ) -> AppResult<ProviderReply> {
        let key = vault::get("openai-api-key")?
            .ok_or_else(|| AppError::new("AI_KEY", "Configure sua chave no cofre do Windows."))?;
        let response=network::client_with_timeout(120)?.post("https://api.openai.com/v1/responses").bearer_auth(key.as_str()).json(&json!({"model":settings.openai_model,"store":false,"max_output_tokens":settings.max_output_tokens,"input":[{"role":"system","content":instructions},{"role":"user","content":data}],"text":{"format":{"type":"json_schema","name":"learningstudio","strict":true,"schema":schema}}})).send().map_err(|_|network::error())?;
        parse_openai(remote_json(response)?)
    }
}
pub fn parse_ollama(value: Value) -> AppResult<ProviderReply> {
    if value.get("done").and_then(Value::as_bool) != Some(true)
        || value.get("done_reason").and_then(Value::as_str) == Some("length")
    {
        return Err(invalid());
    }
    let text = value
        .pointer("/message/content")
        .and_then(Value::as_str)
        .ok_or_else(invalid)?
        .to_string();
    if text.is_empty() || text.len() > 100000 {
        return Err(invalid());
    }
    Ok(ProviderReply {
        text,
        input: value.get("prompt_eval_count").and_then(Value::as_u64),
        output: value.get("eval_count").and_then(Value::as_u64),
    })
}
impl AIProvider for Ollama {
    fn generate(
        &self,
        settings: &AISettings,
        instructions: &str,
        data: &str,
        schema: Value,
    ) -> AppResult<ProviderReply> {
        let client = reqwest::blocking::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(3))
            .timeout(Duration::from_secs(90))
            .build()
            .map_err(|_| network::error())?;
        let response=client.post("http://127.0.0.1:11434/api/chat").json(&json!({"model":settings.ollama_model,"stream":false,"messages":[{"role":"system","content":instructions},{"role":"user","content":data}],"format":schema,"options":{"num_predict":settings.max_output_tokens}})).send().map_err(|_|AppError::new("OLLAMA","Ollama local não respondeu. Confira a instalação e o modelo; sua resposta permanece salva."))?;
        parse_ollama(network::json(response)?)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn extracts_only_completed_openai_output() {
        let reply=parse_openai(json!({"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"{}"}]}],"usage":{"input_tokens":10,"output_tokens":5}})).unwrap();
        assert_eq!(reply.input, Some(10));
        assert!(parse_openai(json!({"status":"incomplete","output":[]})).is_err());
    }
    #[test]
    fn rejects_refusal_and_truncated_local_output() {
        assert!(parse_openai(
            json!({"status":"completed","output":[{"content":[{"type":"refusal","refusal":"no"}]}]})
        )
        .is_err());
        assert!(parse_ollama(
            json!({"done":true,"done_reason":"length","message":{"content":"{}"}})
        )
        .is_err());
    }
}
