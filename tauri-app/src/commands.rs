// src/commands.rs
// Tauri commands that the frontend can invoke.

use tauri::Manager;
use crate::keystroke::KeystrokeLogger;
use crate::db;
use chrono::{Utc, Duration};
use std::sync::Mutex;
use serde::Serialize;

// We'll keep a global logger instance.
lazy_static::lazy_static! {
    static ref LOGGER: Mutex<KeystrokeLogger> = Mutex::new(KeystrokeLogger::new());
}

#[tauri::command]
pub fn start_tap() -> Result<(), String> {
    let logger = LOGGER.lock().map_err(|e| e.to_string())?;
    logger.start();
    Ok(())
}

#[tauri::command]
pub fn stop_tap() -> Result<(), String> {
    let logger = LOGGER.lock().map_err(|e| e.to_string())?;
    logger.stop();
    Ok(())
}

#[derive(Serialize)]
pub struct SessionEntry {
    pub timestamp: String,
    pub app_name: String,
    pub key_char: String,
}

#[tauri::command]
pub fn get_recent_sessions(days: i64) -> Result<Vec<SessionEntry>, String> {
    let rows = db::query_recent_sessions(days).map_err(|e| e.to_string())?;
    let sessions = rows.into_iter().map(|(ts, app, key)| SessionEntry {
        timestamp: ts,
        app_name: app.unwrap_or_default(),
        key_char: key.unwrap_or_default(),
    }).collect();
    Ok(sessions)
}

#[tauri::command]
pub fn export_diary(path: String) -> Result<(), String> {
    // Simple export: fetch last 7 days and write markdown.
    let rows = db::query_recent_sessions(7).map_err(|e| e.to_string())?;
    let mut content = String::new();
    for (ts, app, key) in rows {
        content.push_str(&format!("{} – {}: {}\n", ts, app.unwrap_or_default(), key.unwrap_or_default()));
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())
}
