// src/db.rs
// Simple SQLite wrapper using rusqlite.
//
// The database lives in the app's Application Support folder so the build is
// portable (no hardcoded usernames / machine-specific paths).

use aes_gcm::aead::{Aead, KeyInit, generic_array::GenericArray};
use aes_gcm::Aes256Gcm;
use rand::rngs::OsRng;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rand::RngCore;
use rusqlite::{params, Connection, Result};
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use log::error;

/// At-rest encryption of captured keystrokes.
///
/// Keystrokes are sensitive (they may include secrets typed into any app), so
/// they are encrypted with AES-256-GCM before being written to SQLite. The key
/// lives in a `0600` file next to the database; anyone who can only read the
/// `.db` file sees ciphertext, not plaintext. If the key cannot be loaded or
/// created we degrade to storing the value in the clear (with a warning) rather
/// than crashing capture — encryption is best-effort, not a hard requirement.
const KEY_FILE: &str = "db.key";

lazy_static::lazy_static! {
    static ref CIPHER: Option<Aes256Gcm> = build_cipher();
}

fn load_or_create_key() -> Option<Vec<u8>> {
    let path = app_support_dir().join(KEY_FILE);
    if let Ok(bytes) = std::fs::read(&path) {
        if bytes.len() == 32 {
            return Some(bytes);
        }
    }
    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    if std::fs::write(&path, &key).is_ok() {
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }
    Some(key.to_vec())
}

#[allow(dead_code)]
fn build_cipher() -> Option<Aes256Gcm> {
    match load_or_create_key() {
        Some(k) => Some(Aes256Gcm::new(GenericArray::from_slice(&k))),
        None => {
            error!(
                "Inkwell: could not load/create the encryption key; keystrokes \
                 will be stored UNENCRYPTED this session."
            );
            None
        }
    }
}

/// Encrypt a plaintext string into a base64(`nonce` || `ciphertext`) blob.
/// Falls back to returning the input unchanged when encryption is unavailable.
pub fn encrypt(plain: &str) -> String {
    match &*CIPHER {
        Some(cipher) => {
            let mut nonce = [0u8; 12];
            OsRng.fill_bytes(&mut nonce);
            match cipher.encrypt(GenericArray::from_slice(&nonce), plain.as_bytes()) {
                Ok(ct) => {
                    let mut blob = nonce.to_vec();
                    blob.extend_from_slice(&ct);
                    B64.encode(blob)
                }
                Err(_) => plain.to_string(),
            }
        }
        None => plain.to_string(),
    }
}

/// Reverse of `encrypt`. Non-ciphertext inputs (plaintext rows, or values that
/// fail to decrypt) are returned unchanged so we never lose data on format
/// mismatch.
pub fn decrypt(cipher_b64: &str) -> String {
    match &*CIPHER {
        Some(cipher) => {
            let blob = match B64.decode(cipher_b64) {
                Ok(b) => b,
                Err(_) => return cipher_b64.to_string(),
            };
            if blob.len() < 12 {
                return cipher_b64.to_string();
            }
            let (nonce, ct) = blob.split_at(12);
            match cipher.decrypt(GenericArray::from_slice(nonce), ct) {
                Ok(pt) => String::from_utf8_lossy(&pt).into_owned(),
                Err(_) => cipher_b64.to_string(),
            }
        }
        None => cipher_b64.to_string(),
    }
}

/// Resolve the per-user, per-app data directory.
/// (`~/Library/Application Support/com.inkwell.app` on macOS.)
pub fn app_support_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let dir = PathBuf::from(home)
        .join("Library")
        .join("Application Support")
        .join("com.inkwell.app");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

pub fn init_db() -> Result<Connection> {
    let db_path = app_support_dir().join("inkwell.db");
    let conn = Connection::open(db_path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS keystrokes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            app_name TEXT,
            key_char TEXT,
            key_code INTEGER
        )",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_ts ON keystrokes(timestamp)",
        [],
    )?;
    Ok(conn)
}

pub fn insert_keystroke(
    timestamp: &str,
    app_name: &str,
    key_char: &str,
    key_code: i64,
) -> Result<()> {
    let conn = init_db()?;
    let enc = encrypt(key_char);
    conn.execute(
        "INSERT INTO keystrokes (timestamp, app_name, key_char, key_code) VALUES (?1, ?2, ?3, ?4)",
        params![timestamp, app_name, enc, key_code],
    )?;
    Ok(())
}

/// Rows since `since` (an RFC3339 timestamp), oldest first.
/// Returns (timestamp, app_name, key_char).
pub fn query_sessions_since(since: &str) -> Result<Vec<(String, String, String)>> {
    let conn = init_db()?;
    let mut stmt = conn.prepare(
        "SELECT timestamp, app_name, key_char FROM keystrokes WHERE timestamp >= ?1 ORDER BY timestamp ASC",
    )?;
    let rows = stmt.query_map(params![since], |row| {
        let ts: String = row.get(0)?;
        let app: String = row.get(1)?;
        let enc: String = row.get(2)?;
        Ok((ts, app, decrypt(&enc)))
    })?;
    let mut results = Vec::new();
    for r in rows {
        results.push(r?);
    }
    Ok(results)
}

/// Convenience helper used by the legacy diary export (last `days` days).
#[allow(dead_code)]
pub fn query_recent_sessions(days: i64) -> Result<Vec<(String, String, String)>> {
    let cutoff = chrono::Utc::now() - chrono::Duration::days(days);
    query_sessions_since(&cutoff.to_rfc3339())
}
