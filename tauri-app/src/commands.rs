// src/commands.rs
// Tauri commands that the frontend can invoke.

use crate::db;
use crate::keystroke::KeystrokeLogger;
use crate::sync;
use std::sync::Mutex;

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

#[derive(serde::Serialize)]
pub struct SessionEntry {
    pub timestamp: String,
    pub app_name: String,
    pub key_char: String,
}

#[tauri::command]
pub fn get_recent_sessions(days: i64) -> Result<Vec<SessionEntry>, String> {
    let rows = db::query_recent_sessions(days).map_err(|e| e.to_string())?;
    let sessions = rows
        .into_iter()
        .map(|(ts, app, key)| SessionEntry {
            timestamp: ts,
            app_name: app,
            key_char: key,
        })
        .collect();
    Ok(sessions)
}

/// Configure (and opt in to) the Cogdex sync. Off by default; the frontend must
/// explicitly enable it and supply a vault path.
#[tauri::command]
pub fn configure_cogdex_sync(
    enabled: bool,
    vault_path: String,
    daily_folder_root: Option<String>,
    day_pattern: Option<String>,
    keylog_suffix: Option<String>,
    idle_timeout_secs: Option<u64>,
) -> Result<(), String> {
    let mut cfg = sync::config_snapshot();
    cfg.enabled = enabled;
    cfg.vault_path = vault_path;
    if let Some(v) = daily_folder_root {
        cfg.daily_folder_root = v;
    }
    if let Some(v) = day_pattern {
        cfg.day_pattern = v;
    }
    if let Some(v) = keylog_suffix {
        cfg.keylog_suffix = v;
    }
    if let Some(v) = idle_timeout_secs {
        cfg.idle_timeout_secs = v;
    }
    sync::configure(cfg);
    Ok(())
}

/// Push captured keystrokes into today's Cogdex keylog note (below LOG-BELOW).
#[tauri::command]
pub fn sync_to_cogdex() -> Result<String, String> {
    sync::sync_to_cogdex()
}

/// Legacy diary export: write the last 7 days of captured keystrokes into the
/// Cogdex-managed keylog note for the supplied vault, below the LOG-BELOW
/// boundary. `vault_path` is the vault root (no more arbitrary file picker).
#[tauri::command]
pub fn export_diary(vault_path: String) -> Result<(), String> {
    let mut cfg = sync::config_snapshot();
    if cfg.vault_path.trim().is_empty() {
        cfg.vault_path = vault_path;
    }
    sync::sync_to_cogdex_with(cfg).map(|_| ())
}
