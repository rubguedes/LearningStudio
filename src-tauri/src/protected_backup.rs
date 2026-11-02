//! Portable backup envelope with fixed KDF limits and authenticated payload.
use crate::models::*;
use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Nonce,
};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD, Engine};
use rand_core::{OsRng, RngCore};
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;
const AAD: &[u8] = b"LearningStudio encrypted backup v1 / Argon2id-19456-2-1 / AES-256-GCM";
pub const MAX_ENVELOPE: usize = 32 * 1024 * 1024;
const MAX_PLAINTEXT: usize = 20 * 1024 * 1024;
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {
    format: String,
    version: u32,
    salt: String,
    nonce: String,
    ciphertext: String,
}
fn invalid() -> AppError {
    AppError::new("BACKUP_PASSWORD","Não foi possível abrir o backup: confira a senha e a integridade do arquivo. Nenhum dado foi alterado.")
}
fn derive(password: &str, salt: &[u8]) -> AppResult<Zeroizing<[u8; 32]>> {
    crate::store::password_valid(password)?;
    let params = Params::new(19456, 2, 1, Some(32)).map_err(|_| invalid())?;
    let mut key = Zeroizing::new([0u8; 32]);
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
        .hash_password_into(password.as_bytes(), salt, key.as_mut())
        .map_err(|_| invalid())?;
    Ok(key)
}
pub fn encrypt(content: &str, password: &str) -> AppResult<String> {
    if content.len() > MAX_PLAINTEXT {
        return Err(invalid());
    }
    let mut salt = [0u8; 16];
    let mut nonce = [0u8; 12];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce);
    let key = derive(password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(key.as_ref()).map_err(|_| invalid())?;
    let ciphertext = cipher
        .encrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: content.as_bytes(),
                aad: AAD,
            },
        )
        .map_err(|_| invalid())?;
    serde_json::to_string(&Envelope {
        format: "LearningStudioEncryptedBackup".into(),
        version: 1,
        salt: STANDARD.encode(salt),
        nonce: STANDARD.encode(nonce),
        ciphertext: STANDARD.encode(ciphertext),
    })
    .map_err(|_| invalid())
}
pub fn decrypt(content: &str, password: &str) -> AppResult<Zeroizing<String>> {
    if content.len() > MAX_ENVELOPE {
        return Err(invalid());
    }
    let e: Envelope = serde_json::from_str(content).map_err(|_| invalid())?;
    if e.format != "LearningStudioEncryptedBackup" || e.version != 1 {
        return Err(invalid());
    }
    let salt = STANDARD.decode(e.salt).map_err(|_| invalid())?;
    let nonce = STANDARD.decode(e.nonce).map_err(|_| invalid())?;
    if salt.len() != 16 || nonce.len() != 12 {
        return Err(invalid());
    }
    let ciphertext = STANDARD.decode(e.ciphertext).map_err(|_| invalid())?;
    if ciphertext.len() > MAX_PLAINTEXT + 16 {
        return Err(invalid());
    }
    let key = derive(password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(key.as_ref()).map_err(|_| invalid())?;
    let clear = Zeroizing::new(
        cipher
            .decrypt(
                Nonce::from_slice(&nonce),
                Payload {
                    msg: &ciphertext,
                    aad: AAD,
                },
            )
            .map_err(|_| invalid())?,
    );
    let text = std::str::from_utf8(&clear).map_err(|_| invalid())?;
    Ok(Zeroizing::new(text.to_string()))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn round_trip_is_portable_and_randomized() {
        let a = encrypt("private content", "a strong backup password").unwrap();
        let b = encrypt("private content", "a strong backup password").unwrap();
        assert_ne!(a, b);
        assert!(!a.contains("private content"));
        assert_eq!(
            decrypt(&a, "a strong backup password").unwrap().as_str(),
            "private content"
        );
    }
    #[test]
    fn wrong_password_and_tampering_are_rejected() {
        let a = encrypt("secret", "a strong backup password").unwrap();
        assert!(decrypt(&a, "another strong password").is_err());
        let mut e: Envelope = serde_json::from_str(&a).unwrap();
        let mut bytes = STANDARD.decode(&e.ciphertext).unwrap();
        bytes[0] ^= 1;
        e.ciphertext = STANDARD.encode(bytes);
        assert!(decrypt(
            &serde_json::to_string(&e).unwrap(),
            "a strong backup password"
        )
        .is_err());
    }
    #[test]
    fn untrusted_parameters_cannot_allocate_work() {
        assert!(decrypt(r#"{"format":"LearningStudioEncryptedBackup","version":2,"salt":"","nonce":"","ciphertext":""}"#,"a strong backup password").is_err());
        assert!(encrypt("secret", "short").is_err());
    }
}
