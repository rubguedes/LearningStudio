use crate::models::*;
use zeroize::Zeroizing;
pub fn put(name: &str, value: &str) -> AppResult<()> {
    keyring::Entry::new("LearningStudio", name)
        .and_then(|entry| entry.set_password(value))
        .map_err(|_| {
            AppError::new(
                "VAULT",
                "Não foi possível salvar o segredo no cofre do Windows.",
            )
        })
}
pub fn get(name: &str) -> AppResult<Option<Zeroizing<String>>> {
    let entry = keyring::Entry::new("LearningStudio", name)
        .map_err(|_| AppError::new("VAULT", "O cofre do Windows não está disponível."))?;
    match entry.get_password() {
        Ok(value) => Ok(Some(Zeroizing::new(value))),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err(AppError::new(
            "VAULT",
            "Não foi possível ler o cofre do Windows.",
        )),
    }
}
pub fn remove(name: &str) -> AppResult<()> {
    let entry = keyring::Entry::new("LearningStudio", name)
        .map_err(|_| AppError::new("VAULT", "O cofre do Windows não está disponível."))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err(AppError::new(
            "VAULT",
            "Não foi possível remover o segredo do cofre do Windows.",
        )),
    }
}
#[cfg(test)]
mod tests {
    #[test]
    fn isolated_windows_vault_round_trip() {
        let name = format!("test-{}", uuid::Uuid::new_v4());
        super::put(&name, "fixture-secret").unwrap();
        assert_eq!(
            super::get(&name).unwrap().as_deref().map(|s| s.as_str()),
            Some("fixture-secret")
        );
        super::remove(&name).unwrap();
        assert!(super::get(&name).unwrap().is_none());
    }
}
