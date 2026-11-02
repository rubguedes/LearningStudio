//! SQLCipher at rest; the random database key belongs to this Windows account's vault.
//! There is intentionally no plaintext fallback when a key or the crypto engine is unavailable.
use crate::models::*;
#[cfg(not(test))]
use crate::vault;
use rand_core::{OsRng, RngCore};
use rusqlite::{params, Connection, OptionalExtension};
use std::{
    fs::{File, OpenOptions},
    io::Read,
    path::Path,
    time::Duration,
};
use zeroize::Zeroizing;
pub struct ManagedDatabase {
    pub connection: Connection,
    pub lock: Option<File>,
    pub encrypted: bool,
}
fn failure() -> AppError {
    AppError::new("ENCRYPTION","Não foi possível abrir ou converter o banco protegido. O arquivo original foi preservado; confira o cofre do Windows e feche outras instâncias.")
}
fn cipher_available(c: &Connection) -> AppResult<()> {
    let version: Option<String> = c
        .query_row("PRAGMA cipher_version", [], |r| r.get(0))
        .optional()
        .map_err(|_| failure())?;
    if version.is_none_or(|v| v.is_empty()) {
        return Err(AppError::new(
            "ENCRYPTION_UNAVAILABLE",
            "Este executável não contém SQLCipher. A abertura sem criptografia foi recusada.",
        ));
    }
    Ok(())
}
fn key_name(_path: &Path) -> String {
    #[cfg(not(test))]
    {
        "database-encryption-v1".into()
    }
    #[cfg(test)]
    {
        use sha2::{Digest, Sha256};
        format!(
            "test-db-{:x}",
            Sha256::digest(_path.to_string_lossy().as_bytes())
        )
    }
}
#[cfg(test)]
fn test_keys() -> &'static std::sync::Mutex<std::collections::HashMap<String, Zeroizing<String>>> {
    static KEYS: std::sync::OnceLock<
        std::sync::Mutex<std::collections::HashMap<String, Zeroizing<String>>>,
    > = std::sync::OnceLock::new();
    KEYS.get_or_init(Default::default)
}
fn saved_key(path: &Path) -> AppResult<Option<Zeroizing<String>>> {
    #[cfg(not(test))]
    {
        vault::get(&key_name(path))
    }
    #[cfg(test)]
    {
        Ok(test_keys().lock().unwrap().get(&key_name(path)).cloned())
    }
}
fn save_key(path: &Path, key: &str) -> AppResult<()> {
    #[cfg(not(test))]
    {
        vault::put(&key_name(path), key)?;
    }
    #[cfg(test)]
    {
        test_keys()
            .lock()
            .unwrap()
            .insert(key_name(path), Zeroizing::new(key.into()));
    }
    if saved_key(path)?.as_deref().map(|s| s.as_str()) != Some(key) {
        return Err(failure());
    }
    Ok(())
}
fn raw_key(key: &str) -> AppResult<Zeroizing<String>> {
    if key.len() != 64 || !key.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(failure());
    }
    Ok(Zeroizing::new(format!("x'{key}'")))
}
fn keyed(path: &Path, key: &str) -> AppResult<Connection> {
    let c = Connection::open(path).map_err(|_| failure())?;
    cipher_available(&c)?;
    c.pragma_update(None, "key", raw_key(key)?.as_str())
        .map_err(|_| failure())?;
    c.execute_batch("PRAGMA temp_store=MEMORY;")
        .map_err(|_| failure())?;
    c.query_row("SELECT count(*) FROM sqlite_master", [], |r| {
        r.get::<_, i64>(0)
    })
    .map_err(|_| failure())?;
    Ok(c)
}
fn counts(c: &Connection) -> AppResult<Vec<(String, i64)>> {
    let mut q=c.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map_err(|_|failure())?;
    let names = q
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(|_| failure())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|_| failure())?;
    names
        .into_iter()
        .map(|name| {
            let sql = format!("SELECT count(*) FROM \"{}\"", name.replace('"', "\"\""));
            let count = c.query_row(&sql, [], |r| r.get(0)).map_err(|_| failure())?;
            Ok((name, count))
        })
        .collect()
}
fn integrity(c: &Connection) -> AppResult<()> {
    let mut q = c.prepare("PRAGMA integrity_check").map_err(|_| failure())?;
    let rows = q
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(|_| failure())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|_| failure())?;
    if rows != ["ok"] {
        return Err(failure());
    }
    Ok(())
}
fn atomic_replace(from: &Path, to: &Path) -> AppResult<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };
    let from: Vec<u16> = from.as_os_str().encode_wide().chain(Some(0)).collect();
    let to: Vec<u16> = to.as_os_str().encode_wide().chain(Some(0)).collect();
    // Both paths are in the same private data directory. File handles are closed first.
    if unsafe {
        MoveFileExW(
            from.as_ptr(),
            to.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    } == 0
    {
        return Err(failure());
    }
    Ok(())
}
fn migrate_plaintext(
    path: &Path,
    key: &str,
    replace: impl FnOnce(&Path, &Path) -> AppResult<()>,
) -> AppResult<()> {
    let plain = Connection::open(path).map_err(|_| failure())?;
    cipher_available(&plain)?;
    plain
        .busy_timeout(Duration::from_secs(5))
        .map_err(|_| failure())?;
    let future = plain
        .query_row(
            "SELECT COALESCE(MAX(version),0) FROM schema_migrations",
            [],
            |r| r.get::<_, i64>(0),
        )
        .optional();
    if matches!(future,Ok(Some(v)) if v>7) {
        return Err(AppError::new(
            "SCHEMA_VERSION",
            "O banco pertence a uma versão mais recente. Atualize o aplicativo.",
        ));
    }
    let (busy, _, _): (i64, i64, i64) = plain
        .query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?))
        })
        .map_err(|_| failure())?;
    if busy != 0 {
        return Err(failure());
    }
    plain.execute_batch("PRAGMA journal_mode=DELETE; PRAGMA locking_mode=EXCLUSIVE; PRAGMA temp_store=MEMORY; BEGIN EXCLUSIVE; COMMIT;").map_err(|_|failure())?;
    integrity(&plain)?;
    let before = counts(&plain)?;
    let user_version: i64 = plain
        .pragma_query_value(None, "user_version", |r| r.get(0))
        .map_err(|_| failure())?;
    let application_id: i64 = plain
        .pragma_query_value(None, "application_id", |r| r.get(0))
        .map_err(|_| failure())?;
    let candidate = path.with_extension(format!("cipher-{}.tmp", uuid::Uuid::new_v4()));
    OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&candidate)
        .map_err(|_| failure())?;
    plain
        .execute(
            "ATTACH DATABASE ?1 AS encrypted KEY ?2",
            params![
                candidate.to_str().ok_or_else(failure)?,
                raw_key(key)?.as_str()
            ],
        )
        .map_err(|_| failure())?;
    plain
        .execute_batch("SELECT sqlcipher_export('encrypted'); DETACH DATABASE encrypted;")
        .map_err(|_| failure())?;
    let encrypted = keyed(&candidate, key)?;
    encrypted
        .pragma_update(None, "user_version", user_version)
        .map_err(|_| failure())?;
    encrypted
        .pragma_update(None, "application_id", application_id)
        .map_err(|_| failure())?;
    integrity(&encrypted)?;
    if counts(&encrypted)? != before {
        return Err(failure());
    }
    encrypted.close().map_err(|_| failure())?;
    OpenOptions::new()
        .write(true)
        .open(&candidate)
        .and_then(|f| f.sync_all())
        .map_err(|_| failure())?;
    plain.close().map_err(|_| failure())?;
    // On any failure before replacement, the original remains authoritative. Staging is encrypted.
    replace(&candidate, path)
}
pub fn open(path: &Path) -> AppResult<ManagedDatabase> {
    if path == Path::new(":memory:") {
        return Ok(ManagedDatabase {
            connection: Connection::open_in_memory().map_err(AppError::database)?,
            lock: None,
            encrypted: false,
        });
    }
    let lock = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(path.with_extension("db.lock"))
        .map_err(|_| failure())?;
    lock.try_lock().map_err(|_| {
        AppError::new(
            "DATABASE_BUSY",
            "O banco está em uso. Feche a outra instância do LearningStudio e tente novamente.",
        )
    })?;
    let mut header = [0u8; 16];
    let length = match File::open(path) {
        Ok(mut f) => f.read(&mut header).map_err(|_| failure())?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => 0,
        Err(_) => return Err(failure()),
    };
    let plaintext = length == 16 && &header == b"SQLite format 3\0";
    let key=match saved_key(path)?{Some(k)=>k,None if plaintext||length==0=>{let mut bytes=Zeroizing::new([0u8;32]);OsRng.fill_bytes(bytes.as_mut());let k=Zeroizing::new(bytes.iter().map(|b|format!("{b:02x}")).collect::<String>());save_key(path,&k)?;k},None=>return Err(AppError::new("DATABASE_KEY","O banco é criptografado, mas a chave não está no cofre desta conta do Windows. Não recrie a chave: use um backup portátil protegido para restaurar em um espaço novo."))};
    if plaintext {
        migrate_plaintext(path, &key, atomic_replace)?;
    }
    Ok(ManagedDatabase {
        connection: keyed(path, &key)?,
        lock: Some(lock),
        encrypted: true,
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn encrypted_file_is_not_plaintext_and_reopens_with_the_same_key() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("new.db");
        {
            let db = open(&path).unwrap();
            db.connection.execute_batch("CREATE TABLE secret(value TEXT); INSERT INTO secret VALUES('private-marker-never-plaintext');").unwrap();
        }
        let bytes = std::fs::read(&path).unwrap();
        let marker = b"private-marker-never-plaintext";
        assert!(!bytes.starts_with(b"SQLite format 3"));
        assert!(!bytes.windows(marker.len()).any(|b| b == marker));
        let db = open(&path).unwrap();
        assert_eq!(
            db.connection
                .query_row("SELECT value FROM secret", [], |r| r.get::<_, String>(0))
                .unwrap(),
            "private-marker-never-plaintext"
        );
        assert!(keyed(&path, &"ab".repeat(32)).is_err());
    }
    #[test]
    fn migration_preserves_rows_indexes_and_authentication() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("old.db");
        {
            let old = Connection::open(&path).unwrap();
            old.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE app_settings(key TEXT PRIMARY KEY,value TEXT); INSERT INTO app_settings VALUES('password_hash','preserved'); CREATE INDEX value_idx ON app_settings(value); PRAGMA user_version=17;").unwrap();
        }
        let db = open(&path).unwrap();
        assert_eq!(
            db.connection
                .query_row("SELECT value FROM app_settings", [], |r| r
                    .get::<_, String>(0))
                .unwrap(),
            "preserved"
        );
        assert_eq!(
            db.connection
                .pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0))
                .unwrap(),
            17
        );
        assert!(!std::fs::read(path).unwrap().starts_with(b"SQLite format 3"));
    }
    #[test]
    fn interrupted_conversion_keeps_original_readable() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("old.db");
        {
            let old = Connection::open(&path).unwrap();
            old.execute_batch("CREATE TABLE kept(value INTEGER); INSERT INTO kept VALUES(42);")
                .unwrap();
        }
        assert!(migrate_plaintext(&path, &"cd".repeat(32), |_, _| Err(failure())).is_err());
        let old = Connection::open(path).unwrap();
        assert_eq!(
            old.query_row("SELECT value FROM kept", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            42
        );
    }
    #[test]
    fn missing_vault_key_never_replaces_an_encrypted_database() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("new.db");
        {
            let db = open(&path).unwrap();
            db.connection
                .execute_batch("CREATE TABLE kept(value INTEGER);")
                .unwrap();
        }
        test_keys().lock().unwrap().remove(&key_name(&path));
        let before = std::fs::read(&path).unwrap();
        assert!(open(&path).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), before);
    }
    #[test]
    fn only_one_instance_can_open_a_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("new.db");
        let first = open(&path).unwrap();
        assert!(open(&path).is_err());
        drop(first);
        assert!(open(&path).is_ok());
    }
}
