// src/db.rs
// Simple SQLite wrapper using rusqlite.
//
// The database lives in the app's Application Support folder so the build is
// portable (no hardcoded usernames / machine-specific paths).

use rusqlite::{params, Connection, Result};
use std::path::PathBuf;

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
    conn.execute(
        "INSERT INTO keystrokes (timestamp, app_name, key_char, key_code) VALUES (?1, ?2, ?3, ?4)",
        params![timestamp, app_name, key_char, key_code],
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
        Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    })?;
    let mut results = Vec::new();
    for r in rows {
        results.push(r?);
    }
    Ok(results)
}

/// Convenience helper used by the legacy diary export (last `days` days).
pub fn query_recent_sessions(days: i64) -> Result<Vec<(String, String, String)>> {
    let cutoff = chrono::Utc::now() - chrono::Duration::days(days);
    query_sessions_since(&cutoff.to_rfc3339())
}
