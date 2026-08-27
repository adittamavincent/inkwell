// src/db.rs
// Simple SQLite wrapper using rusqlite.

use rusqlite::{params, Connection, Result};
use std::path::Path;

pub fn init_db() -> Result<Connection> {
    let db_path = Path::new("/Users/adittama/inkwell.db");
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
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ts ON keystrokes(timestamp)", [], )?;
    Ok(conn)
}

pub fn insert_keystroke(timestamp: &str, app_name: &str, key_char: &str, key_code: i64) -> Result<()> {
    let conn = init_db()?;
    conn.execute(
        "INSERT INTO keystrokes (timestamp, app_name, key_char, key_code) VALUES (?1, ?2, ?3, ?4)",
        params![timestamp, app_name, key_char, key_code],
    )?;
    Ok(())
}

pub fn query_recent_sessions(days: i64) -> Result<Vec<(String, String, String)>> {
    // Returns (timestamp, app_name, key_char)
    let conn = init_db()?;
    let cutoff = chrono::Utc::now() - chrono::Duration::days(days);
    let mut stmt = conn.prepare(
        "SELECT timestamp, app_name, key_char FROM keystrokes WHERE timestamp >= ?1 ORDER BY timestamp ASC",
    )?;
    let rows = stmt.query_map(params![cutoff.to_rfc3339()], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    })?;
    let mut results = Vec::new();
    for r in rows {
        results.push(r?);
    }
    Ok(results)
}
