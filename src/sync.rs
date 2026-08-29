// src/sync.rs
// Bridges Inkwell's captured keystrokes to a Cogdex-managed vault.
//
// When Cogdex sync is enabled (opt-in, off by default), captured sessions are
// appended to today's Cogdex keylog note — `<vault>/<dailyFolderRoot>/<date>/<date><keylogSuffix>.md`
// — strictly *below* the `<!-- LOG-BELOW -->` boundary marker, so Inkwell's
// output never collides with text Cogdex writes above it.

use crate::db;
use chrono::{DateTime, Duration, Local, Utc};
use lazy_static::lazy_static;
use std::fs;
use std::path::Path;
use std::sync::Mutex;

/// Default values mirror Cogdex's own defaults so the two tools agree out of
/// the box. `dayPattern` uses chrono (strftime) syntax; `%Y-%m-%d` is the
/// chrono equivalent of Cogdex's moment `YYYY-MM-DD`.
const DEFAULT_DAILY_ROOT: &str = "Daily";
const DEFAULT_DAY_PATTERN: &str = "%Y-%m-%d";
const DEFAULT_KEYLOG_SUFFIX: &str = " - keylog";
const BOUNDARY_MARKER: &str =
    "<!-- LOG-BELOW — external tools may only append below this line -->";

/// Apps excluded from capture by default. Typed secrets in password managers
/// should never be logged, so we opt these out unless the user overrides.
const DEFAULT_EXCLUDED_APPS: &[&str] = &[
    "1password",
    "bitwarden",
    "keeper",
    "lastpass",
    "dashlane",
    "icloud keychain",
    "keypassxc",
    "macpass",
];

#[derive(Clone)]
pub struct CogdexSyncConfig {
    /// Master switch. Off by default — sync is strictly opt-in.
    pub enabled: bool,
    /// Absolute path to the Obsidian vault root.
    pub vault_path: String,
    /// Folder that holds each day's subfolder (Cogdex `dailyFolderRoot`).
    pub daily_folder_root: String,
    /// Date format for the day folder / note name (chrono strftime syntax).
    pub day_pattern: String,
    /// Suffix appended to the day name for the keylog note (Cogdex `keylogSuffix`).
    pub keylog_suffix: String,
    /// Inactivity gap (seconds) that splits one typing session from the next.
    pub idle_timeout_secs: u64,
    /// Apps whose keystrokes are never captured (compared case-insensitively
    /// against the frontmost app's name).
    pub excluded_apps: Vec<String>,
}

impl Default for CogdexSyncConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            vault_path: String::new(),
            daily_folder_root: DEFAULT_DAILY_ROOT.to_string(),
            day_pattern: DEFAULT_DAY_PATTERN.to_string(),
            keylog_suffix: DEFAULT_KEYLOG_SUFFIX.to_string(),
            idle_timeout_secs: 60,
            excluded_apps: DEFAULT_EXCLUDED_APPS.iter().map(|s| s.to_string()).collect(),
        }
    }
}

lazy_static! {
    static ref SYNC_CONFIG: Mutex<CogdexSyncConfig> = Mutex::new(CogdexSyncConfig::default());
}

pub fn configure(config: CogdexSyncConfig) {
    crate::keystroke::set_excluded_apps(config.excluded_apps.clone());
    *SYNC_CONFIG.lock().unwrap() = config;
}

pub fn config_snapshot() -> CogdexSyncConfig {
    SYNC_CONFIG.lock().unwrap().clone()
}

/// Sync using the globally configured settings.
pub fn sync_to_cogdex() -> Result<String, String> {
    let cfg = SYNC_CONFIG.lock().unwrap().clone();
    do_sync(&cfg)
}

/// Sync using a one-off config (used by the legacy `export_diary` command,
/// which passes the vault path directly instead of relying on saved settings).
pub fn sync_to_cogdex_with(mut cfg: CogdexSyncConfig) -> Result<String, String> {
    cfg.enabled = true;
    do_sync(&cfg)
}

fn do_sync(cfg: &CogdexSyncConfig) -> Result<String, String> {
    if !cfg.enabled {
        return Ok("Cogdex sync is disabled (opt-in). Nothing to do.".to_string());
    }
    if cfg.vault_path.trim().is_empty() {
        return Err("Cogdex vault path is not configured.".to_string());
    }

    let since = read_last_sync()
        .map(|d| d.to_rfc3339())
        .unwrap_or_else(|| (Utc::now() - Duration::days(1)).to_rfc3339());
    let rows = db::query_sessions_since(&since).map_err(|e| e.to_string())?;
    if rows.is_empty() {
        return Ok("No new keystrokes to sync.".to_string());
    }

    let day_name = Local::now().format(&cfg.day_pattern).to_string();
    let vault = cfg.vault_path.trim().trim_end_matches('/');
    let keylog_path = Path::new(vault)
        .join(strip_leading_slash(&cfg.daily_folder_root))
        .join(&day_name)
        .join(format!("{}{}.md", day_name, cfg.keylog_suffix));

    let blocks = build_session_blocks(rows, cfg.idle_timeout_secs);
    if blocks.is_empty() {
        return Ok("Captured sessions were too short to sync.".to_string());
    }

    append_below_boundary(&keylog_path, &blocks)?;
    write_last_sync(Utc::now());
    Ok(format!(
        "Synced {} session(s) to {}",
        blocks.len(),
        keylog_path.display()
    ))
}

struct Session {
    start: String,
    /// Timestamp of the most recent keystroke in this session. Session-splitting
    /// is decided by the gap since this, not since `start`.
    last: String,
    app: String,
    tokens: Vec<String>,
}

/// Group raw keystroke rows into typing sessions: a new session starts when the
/// frontmost app changes or when the gap since the *previous keystroke* exceeds
/// `idle_timeout_secs`.
fn build_session_blocks(rows: Vec<(String, String, String)>, idle_timeout: u64) -> Vec<String> {
    let idle = Duration::seconds(idle_timeout as i64);
    let mut sessions: Vec<Session> = Vec::new();

    for (ts, app, key) in rows {
        let app = app.trim().to_string();
        let key = key.trim().to_string();
        if key.is_empty() {
            continue;
        }
        let dt = DateTime::parse_from_rfc3339(&ts)
            .map(|d| d.with_timezone(&Utc))
            .ok();

        let continued = sessions.last_mut().filter(|s| {
            s.app == app
                && match (dt, parse_ts(&s.last)) {
                    (Some(d), Some(ld)) => d - ld <= idle,
                    _ => false,
                }
        });

        match continued {
            Some(s) => {
                s.tokens.push(key);
                s.last = ts.clone();
            }
            None => sessions.push(Session {
                start: ts.clone(),
                last: ts.clone(),
                app,
                tokens: vec![key],
            }),
        }
    }

    let mut out = Vec::new();
    for s in sessions {
        let text = reconstruct_text(&s.tokens);
        if text.trim().is_empty() {
            continue;
        }
        let header_time = parse_ts(&s.start)
            .map(|d| d.with_timezone(&Local).format("%H:%M").to_string())
            .unwrap_or_default();
        let header = if s.app.is_empty() {
            format!("## {}", header_time)
        } else {
            format!("## {} — {}", header_time, s.app)
        };
        out.push(format!("{}\n\n{}\n", header, text));
    }
    out
}

fn parse_ts(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .map(|d| d.with_timezone(&Utc))
        .ok()
}

fn append_below_boundary(path: &Path, blocks: &[String]) -> Result<(), String> {
    let existing = fs::read_to_string(path).unwrap_or_default();
    let appended = blocks.join("\n");

    let new_content = if existing.contains(BOUNDARY_MARKER) {
        let sep = if existing.ends_with('\n') { "\n" } else { "\n\n" };
        format!("{}{}{}", existing, sep, appended)
    } else {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        format!("{}\n\n{}\n", BOUNDARY_MARKER, appended)
    };

    fs::write(path, new_content).map_err(|e| e.to_string())
}

fn strip_leading_slash(s: &str) -> String {
    s.trim_start_matches('/').to_string()
}

// ---------------------------------------------------------------------------
// Last-sync watermark
// ---------------------------------------------------------------------------

fn last_sync_path() -> std::path::PathBuf {
    db::app_support_dir().join("last_sync.txt")
}

fn read_last_sync() -> Option<DateTime<Utc>> {
    fs::read_to_string(last_sync_path())
        .ok()
        .and_then(|s| DateTime::parse_from_rfc3339(s.trim()).map(|d| d.with_timezone(&Utc)).ok())
}

fn write_last_sync(t: DateTime<Utc>) {
    let _ = fs::write(last_sync_path(), t.to_rfc3339());
}

// ---------------------------------------------------------------------------
// Text reconstruction (port of Cogdex's `keyReconstructor`).
//
// Tokens are the strings stored per keystroke: a single printable character, or
// a bracketed control token such as `[⌫]`, `[↵]`, `[⇥]`, ...
// ---------------------------------------------------------------------------

fn is_alphanumeric(ch: char) -> bool {
    ch.is_alphanumeric()
}

fn delete_selection(buffer: &mut Vec<char>, selection: (usize, usize)) -> usize {
    let start = selection.0.min(selection.1);
    let end = selection.0.max(selection.1);
    if start >= end || end > buffer.len() {
        return selection.0.min(buffer.len());
    }
    buffer.drain(start..end);
    start
}

pub fn reconstruct_text(tokens: &[String]) -> String {
    let mut buffer: Vec<char> = Vec::new();
    let mut cursor: usize = 0;
    let mut selection: Option<(usize, usize)> = None;

    for token in tokens {
        if token.is_empty() {
            continue;
        }
        let is_single_char = token.chars().count() == 1 && !token.starts_with('[');

        if is_single_char {
            if let Some(sel) = selection {
                cursor = delete_selection(&mut buffer, sel);
                selection = None;
            }
            let ch = token.chars().next().unwrap();
            buffer.insert(cursor, ch);
            cursor += 1;
        } else if token == "[⌫]" {
            if let Some(sel) = selection {
                cursor = delete_selection(&mut buffer, sel);
                selection = None;
            } else if cursor > 0 {
                buffer.remove(cursor - 1);
                cursor -= 1;
            }
        } else if token == "[⌦]" {
            if let Some(sel) = selection {
                cursor = delete_selection(&mut buffer, sel);
                selection = None;
            } else if cursor < buffer.len() {
                buffer.remove(cursor);
            }
        } else if token == "[↵]" {
            if let Some(sel) = selection {
                cursor = delete_selection(&mut buffer, sel);
                selection = None;
            }
            buffer.insert(cursor, '\n');
            cursor += 1;
        } else if token == "[←]" {
            cursor = cursor.saturating_sub(1);
            selection = None;
        } else if token == "[→]" {
            cursor = cursor.min(buffer.len());
            selection = None;
        } else if token == "[↑]" || token == "[↓]" {
            selection = None;
        } else if token == "[⇥]" {
            if let Some(sel) = selection {
                cursor = delete_selection(&mut buffer, sel);
                selection = None;
            }
            buffer.insert(cursor, '\t');
            cursor += 1;
        } else if token == "[⌘A]" {
            selection = Some((0, buffer.len()));
        } else if token == "[⇧←]" {
            let anchor = selection.map(|s| s.0).unwrap_or(cursor);
            let new_cursor = cursor.saturating_sub(1);
            selection = if anchor != new_cursor {
                Some((anchor, new_cursor))
            } else {
                None
            };
            cursor = new_cursor;
        } else if token == "[⇧→]" {
            let anchor = selection.map(|s| s.0).unwrap_or(cursor);
            let new_cursor = cursor.min(buffer.len());
            selection = if anchor != new_cursor {
                Some((anchor, new_cursor))
            } else {
                None
            };
            cursor = new_cursor;
        } else if token == "[⌘⌫]" {
            // Command+Backspace: delete from the cursor back to the start of the
            // current line (mirrors Cogdex's TS reconstructor).
            if let Some(sel) = selection {
                cursor = delete_selection(&mut buffer, sel);
                selection = None;
            } else {
                let mut start = cursor;
                while start > 0 && buffer[start - 1] != '\n' {
                    start -= 1;
                }
                buffer.drain(start..cursor);
                cursor = start;
            }
        } else if token == "[⌥⌫]" {
            if let Some(sel) = selection {
                cursor = delete_selection(&mut buffer, sel);
                selection = None;
            } else {
                let mut start = cursor;
                while start > 0 && buffer[start - 1].is_whitespace() {
                    start -= 1;
                }
                if start > 0 {
                    if is_alphanumeric(buffer[start - 1]) {
                        while start > 0 && is_alphanumeric(buffer[start - 1]) {
                            start -= 1;
                        }
                    } else {
                        start -= 1;
                    }
                }
                buffer.drain(start..cursor);
                cursor = start;
            }
        } else if token == "[⌘Z]" {
            // Undo marker — reconstructed text may be approximate; kept as a no-op.
        } else if token.starts_with('[') && token.ends_with(']') {
            // Unknown bracketed control token — skip.
        } else {
            if let Some(sel) = selection {
                cursor = delete_selection(&mut buffer, sel);
                selection = None;
            }
            for ch in token.chars() {
                buffer.insert(cursor, ch);
                cursor += 1;
            }
        }
    }

    buffer.iter().collect()
}

#[cfg(test)]
mod tests {
    use super::{build_session_blocks, reconstruct_text};

    #[test]
    fn deletes_backspace() {
        let tokens = vec!["h".to_string(), "e".to_string(), "l".to_string(), "l".to_string(), "o".to_string(), "[⌫]".to_string(), "p".to_string()];
        assert_eq!(reconstruct_text(&tokens), "hellp");
    }

    #[test]
    fn inserts_newline() {
        let tokens = vec!["a".to_string(), "[↵]".to_string(), "b".to_string()];
        assert_eq!(reconstruct_text(&tokens), "a\nb");
    }

    #[test]
    fn select_all_then_type_replaces() {
        let tokens = vec!["a".to_string(), "b".to_string(), "c".to_string(), "[⌘A]".to_string(), "x".to_string()];
        assert_eq!(reconstruct_text(&tokens), "x");
    }

    #[test]
    fn word_delete_removes_whole_word() {
        let tokens = vec!["h".to_string(), "e".to_string(), "l".to_string(), "l".to_string(), "o".to_string(), "[⌥⌫]".to_string(), "y".to_string()];
        assert_eq!(reconstruct_text(&tokens), "y");
    }

    #[test]
    fn command_backspace_deletes_to_line_start() {
        let tokens = vec![
            "a".to_string(), "b".to_string(), "c".to_string(), "[↵]".to_string(),
            "d".to_string(), "e".to_string(), "[⌘⌫]".to_string(),
        ];
        assert_eq!(reconstruct_text(&tokens), "abc\n");
    }

    #[test]
    fn shift_arrow_selection_then_type() {
        let tokens = vec![
            "a".to_string(), "b".to_string(), "c".to_string(),
            "[⇧←]".to_string(), "[⇧←]".to_string(), "x".to_string(),
        ];
        assert_eq!(reconstruct_text(&tokens), "ax");
    }

    #[test]
    fn undo_marker_is_ignored() {
        let tokens = vec!["h".to_string(), "i".to_string(), "[⌘Z]".to_string()];
        assert_eq!(reconstruct_text(&tokens), "hi");
    }

    #[test]
    fn continuous_typing_stays_one_session() {
        // All keystrokes within the idle window must remain a single session,
        // even if the total span exceeds idle (regression test for the
        // start-vs-last split bug).
        let rows = vec![
            ("2024-01-01T00:00:00Z".to_string(), "Code".to_string(), "h".to_string()),
            ("2024-01-01T00:00:30Z".to_string(), "Code".to_string(), "i".to_string()),
            ("2024-01-01T00:01:30Z".to_string(), "Code".to_string(), " ".to_string()),
        ];
        let blocks = build_session_blocks(rows, 60);
        assert_eq!(blocks.len(), 1, "continuous typing should not split");
    }

    #[test]
    fn idle_gap_splits_session() {
        let rows = vec![
            ("2024-01-01T00:00:00Z".to_string(), "Code".to_string(), "h".to_string()),
            ("2024-01-01T00:02:00Z".to_string(), "Code".to_string(), "i".to_string()),
        ];
        let blocks = build_session_blocks(rows, 60);
        assert_eq!(blocks.len(), 2, "gap beyond idle should split");
    }

    #[test]
    fn app_change_splits_session() {
        let rows = vec![
            ("2024-01-01T00:00:00Z".to_string(), "Code".to_string(), "h".to_string()),
            ("2024-01-01T00:00:01Z".to_string(), "Notes".to_string(), "i".to_string()),
        ];
        let blocks = build_session_blocks(rows, 60);
        assert_eq!(blocks.len(), 2, "app change should split");
    }
}
