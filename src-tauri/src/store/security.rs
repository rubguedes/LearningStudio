use super::*;
use rand_core::RngCore;
fn hash_secret(secret: &str) -> AppResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(secret.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|_| AppError::new("PASSWORD", "Não foi possível proteger a credencial."))
}
fn verify(secret: &str, hash: &str) -> bool {
    PasswordHash::new(hash).is_ok_and(|parsed| {
        Argon2::default()
            .verify_password(secret.as_bytes(), &parsed)
            .is_ok()
    })
}
fn canonical(code: &str) -> AppResult<Zeroizing<String>> {
    if code.len() > 200 {
        return Err(invalid());
    }
    let value = Zeroizing::new(
        code.chars()
            .filter(|c| *c != '-' && !c.is_ascii_whitespace())
            .map(|c| c.to_ascii_uppercase())
            .collect::<String>(),
    );
    let Some(raw) = value.strip_prefix("LSR1") else {
        return Err(invalid());
    };
    if raw.len() != 64 || !raw.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(invalid());
    }
    Ok(Zeroizing::new(format!("LearningStudio recovery v1:{raw}")))
}
fn invalid() -> AppError {
    AppError::new(
        "RECOVERY_INVALID",
        "Código de recuperação inválido, já utilizado ou não configurado. Nenhum dado foi apagado.",
    )
}
impl Store {
    fn auth_attempt_allowed(&self) -> AppResult<()> {
        if self.retry_after.is_some_and(|t| Instant::now() < t) {
            return Err(AppError::new(
                "RATE_LIMIT",
                "Muitas tentativas. Aguarde 30 segundos antes de tentar novamente.",
            ));
        }
        Ok(())
    }
    fn failed_auth_attempt(&mut self) {
        self.failed_attempts = self.failed_attempts.saturating_add(1);
        if self.failed_attempts >= 5 {
            self.retry_after = Some(Instant::now() + Duration::from_secs(30));
            self.failed_attempts = 0;
        }
    }
    pub fn generate_recovery_code(&mut self, password: Zeroizing<String>) -> AppResult<String> {
        self.require_auth()?;
        self.auth_attempt_allowed()?;
        let hash = self.password_hash()?.ok_or_else(invalid)?;
        if password.len() > 1024 || !verify(&password, &hash) {
            self.failed_auth_attempt();
            return Err(AppError::new(
                "INVALID_PASSWORD",
                "Confirme sua senha atual para gerar um código de recuperação.",
            ));
        }
        let mut bytes = Zeroizing::new([0u8; 32]);
        OsRng.fill_bytes(bytes.as_mut());
        let hex = Zeroizing::new(bytes.iter().map(|b| format!("{b:02X}")).collect::<String>());
        let code = format!(
            "LSR1-{}",
            hex.as_bytes()
                .chunks(8)
                .map(|c| std::str::from_utf8(c).unwrap_or_default())
                .collect::<Vec<_>>()
                .join("-")
        );
        let hash = hash_secret(&canonical(&code)?)?;
        self.connection.execute("INSERT INTO app_settings VALUES('recovery_hash',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[hash]).map_err(AppError::database)?;
        self.failed_attempts = 0;
        self.retry_after = None;
        Ok(code)
    }
    pub fn recover_password(
        &mut self,
        code: Zeroizing<String>,
        password: Zeroizing<String>,
    ) -> AppResult<AuthStatus> {
        self.auth_attempt_allowed()?;
        password_valid(&password)?;
        let hash: Option<String> = self
            .connection
            .query_row(
                "SELECT value FROM app_settings WHERE key='recovery_hash'",
                [],
                |r| r.get(0),
            )
            .optional()
            .map_err(AppError::database)?;
        let valid = canonical(&code)
            .ok()
            .zip(hash)
            .is_some_and(|(code, hash)| verify(&code, &hash));
        if !valid {
            self.failed_auth_attempt();
            return Err(invalid());
        }
        self.lock()?;
        let hash = hash_secret(&password)?;
        let tx = self.connection.transaction().map_err(AppError::database)?;
        tx.execute(
            "UPDATE app_settings SET value=?1 WHERE key='password_hash'",
            [hash],
        )
        .map_err(AppError::database)?;
        tx.execute("DELETE FROM app_settings WHERE key='recovery_hash'", [])
            .map_err(AppError::database)?;
        tx.commit().map_err(AppError::database)?;
        self.failed_attempts = 0;
        self.retry_after = None;
        self.auth_status()
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn recovery_is_single_use_preserves_data_and_revokes_session() {
        let mut s = super::super::tests::store();
        s.save_task(super::super::tests::task_input(None)).unwrap();
        let code = s
            .generate_recovery_code(super::super::tests::password())
            .unwrap();
        let raw: String = s
            .connection
            .query_row(
                "SELECT value FROM app_settings WHERE key='recovery_hash'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert!(raw.starts_with("$argon2id$"));
        assert!(!raw.contains(&code));
        s.lock().unwrap();
        let status = s
            .recover_password(
                Zeroizing::new(code.clone()),
                Zeroizing::new("a replacement passphrase".into()),
            )
            .unwrap();
        assert!(!status.unlocked);
        assert!(s.unlock(super::super::tests::password()).is_err());
        s.unlock(Zeroizing::new("a replacement passphrase".into()))
            .unwrap();
        assert_eq!(s.snapshot().unwrap().tasks.len(), 1);
        assert!(s
            .recover_password(
                Zeroizing::new(code),
                Zeroizing::new("another replacement password".into())
            )
            .is_err());
    }
    #[test]
    fn regeneration_invalidates_old_code_and_requires_password() {
        let mut s = super::super::tests::store();
        assert!(s
            .generate_recovery_code(Zeroizing::new("wrong password".into()))
            .is_err());
        let old = s
            .generate_recovery_code(super::super::tests::password())
            .unwrap();
        let new = s
            .generate_recovery_code(super::super::tests::password())
            .unwrap();
        assert_ne!(old, new);
        s.lock().unwrap();
        assert!(s
            .generate_recovery_code(super::super::tests::password())
            .is_err());
        assert!(s
            .recover_password(
                Zeroizing::new(old),
                Zeroizing::new("new secure password".into())
            )
            .is_err());
        assert!(s
            .recover_password(
                Zeroizing::new(new),
                Zeroizing::new("new secure password".into())
            )
            .is_ok());
    }
    #[test]
    fn wrong_recovery_codes_are_rate_limited() {
        let mut s = super::super::tests::store();
        for _ in 0..5 {
            assert!(s
                .recover_password(
                    Zeroizing::new("wrong".into()),
                    Zeroizing::new("new secure password".into())
                )
                .is_err());
        }
        assert_eq!(
            s.recover_password(
                Zeroizing::new("wrong".into()),
                Zeroizing::new("new secure password".into())
            )
            .unwrap_err()
            .code,
            "RATE_LIMIT"
        );
    }
}
