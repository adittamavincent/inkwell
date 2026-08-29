// src/main.rs
// Pure-Rust Inkwell desktop UI built on the `iced` framework.
//
// This replaces the old Tauri/React hybrid. The core logic lives in `db`,
// `keystroke` and `sync`; this file only wires it into the Elm-style iced
// `Application` (the functional `iced::application` builder, which supports
// async `subscription`s — unlike `Sandbox`).
//
// UI inputs are bound directly to the fields of `sync::CogdexSyncConfig`; the
// defaults are read dynamically via `sync::config_snapshot()` so nothing is
// hardcoded here.

use chrono::{Duration, Local, TimeZone, Utc};
use iced::widget::{button, checkbox, column, container, row, scrollable, text, text_input};
use iced::{Element, Length, Subscription, Task};

mod db;
mod keystroke;
mod sync;

use keystroke::KeystrokeLogger;
use sync::{CogdexSyncConfig, SessionPreview};

/// Application state. Every Cogdex-related field mirrors a field of
/// `CogdexSyncConfig` so the UI maps 1:1 onto the persisted config.
struct Inkwell {
    /// Whether the system-wide keystroke tap is currently running.
    running: bool,

    // --- Cogdex sync config (mirrors `CogdexSyncConfig`) ---
    enabled: bool,
    vault_path: String,
    daily_folder_root: String,
    day_pattern: String,
    keylog_suffix: String,
    /// Kept as a string in the input field; parsed on save.
    idle_timeout: String,
    /// Comma-separated app names to exclude from capture.
    excluded_apps: String,

    /// Reviewed-but-not-yet-synced sessions (the privacy gate preview).
    preview: Vec<SessionPreview>,
    /// Summary line for the preview (counts + window).
    preview_status: String,

    /// Transient status line shown at the bottom of the window.
    status: String,
}

#[derive(Debug, Clone)]
enum Message {
    // Logger lifecycle
    StartLogger,
    StopLogger,
    LogStatus(String),

    // Sync config text inputs
    ToggleEnabled(bool),
    VaultPathChanged(String),
    DailyRootChanged(String),
    DayPatternChanged(String),
    KeylogSuffixChanged(String),
    IdleTimeoutChanged(String),
    ExcludedAppsChanged(String),

    // Sync actions
    ApplyConfig,
    LoadPreview,
    PreviewLoaded(Result<Vec<SessionPreview>, String>),
    ForceSync,
    SyncResult(Result<String, String>),
}

impl Default for Inkwell {
    fn default() -> Self {
        // Load defaults dynamically from the live sync config — no hardcoding.
        let cfg = sync::config_snapshot();
        Inkwell {
            running: false,
            enabled: cfg.enabled,
            vault_path: cfg.vault_path,
            daily_folder_root: cfg.daily_folder_root,
            day_pattern: cfg.day_pattern,
            keylog_suffix: cfg.keylog_suffix,
            idle_timeout: cfg.idle_timeout_secs.to_string(),
            excluded_apps: cfg.excluded_apps.join(", "),
            preview: Vec::new(),
            preview_status: String::new(),
            status: String::new(),
        }
    }
}

impl Inkwell {
    /// Build a `CogdexSyncConfig` from the current UI inputs.
    fn build_config(&self) -> CogdexSyncConfig {
        CogdexSyncConfig {
            enabled: self.enabled,
            vault_path: self.vault_path.trim().to_string(),
            daily_folder_root: self.daily_folder_root.trim().to_string(),
            day_pattern: self.day_pattern.trim().to_string(),
            keylog_suffix: self.keylog_suffix.trim().to_string(),
            idle_timeout_secs: self.idle_timeout.trim().parse().unwrap_or(60),
            excluded_apps: self
                .excluded_apps
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect(),
        }
    }
}

fn update(state: &mut Inkwell, message: Message) -> Task<Message> {
    match message {
        Message::StartLogger => {
            state.running = true;
            state.status = "Starting keystroke tap…".into();
            Task::none()
        }
        Message::StopLogger => {
            state.running = false;
            state.status = "Keystroke tap stopped.".into();
            Task::none()
        }
        Message::LogStatus(s) => {
            state.status = s;
            Task::none()
        }

        Message::ToggleEnabled(v) => {
            state.enabled = v;
            Task::none()
        }
        Message::VaultPathChanged(v) => {
            state.vault_path = v;
            Task::none()
        }
        Message::DailyRootChanged(v) => {
            state.daily_folder_root = v;
            Task::none()
        }
        Message::DayPatternChanged(v) => {
            state.day_pattern = v;
            Task::none()
        }
        Message::KeylogSuffixChanged(v) => {
            state.keylog_suffix = v;
            Task::none()
        }
        Message::IdleTimeoutChanged(v) => {
            state.idle_timeout = v;
            Task::none()
        }
        Message::ExcludedAppsChanged(v) => {
            state.excluded_apps = v;
            Task::none()
        }

        Message::ApplyConfig => {
            sync::configure(state.build_config());
            state.status = "Sync settings applied.".into();
            Task::none()
        }
        Message::LoadPreview => {
            state.preview_status = "Loading preview…".into();
            Task::perform(async { sync::preview_unsynced() }, Message::PreviewLoaded)
        }
        Message::PreviewLoaded(Ok(previews)) => {
            let sessions = previews.len();
            let words: usize = previews.iter().map(|s| s.text.split_whitespace().count()).sum();
            let since = sync::last_sync().unwrap_or_else(|| Utc::now() - Duration::days(1));
            let since_str = since
                .with_timezone(&Local)
                .format("%Y-%m-%d %H:%M")
                .to_string();
            state.preview_status = if sessions == 0 {
                "Nothing to sync since the last sync.".into()
            } else {
                format!(
                    "{} session(s) · ~{} words · since {}",
                    sessions, words, since_str
                )
            };
            state.preview = previews;
            Task::none()
        }
        Message::PreviewLoaded(Err(e)) => {
            state.preview_status = format!("Preview error: {e}");
            state.preview = Vec::new();
            Task::none()
        }
        Message::ForceSync => {
            state.status = "Syncing…".into();
            // Run the (blocking) file I/O on a background task so the UI keeps
            // responding, then report the result back as a message.
            Task::perform(async { sync::sync_to_cogdex() }, Message::SyncResult)
        }
        Message::SyncResult(Ok(msg)) => {
            state.status = msg;
            Task::none()
        }
        Message::SyncResult(Err(e)) => {
            state.status = format!("Sync error: {e}");
            Task::none()
        }
    }
}

fn view(state: &Inkwell) -> Element<'_, Message> {
    let title = text("Inkwell — Keystroke Logger").size(22);

    let logger_row = row![
        button(if state.running {
            "Stop Logger"
        } else {
            "Start Logger"
        })
        .on_press(if state.running {
            Message::StopLogger
        } else {
            Message::StartLogger
        }),
        text(if state.running {
            "Tap running"
        } else {
            "Tap idle"
        })
        .size(14),
    ]
    .spacing(12);

    let sync_header = text("Cogdex (Obsidian) Sync").size(16);
    let enabled_toggle = checkbox("Enable Cogdex sync", state.enabled)
        .on_toggle(Message::ToggleEnabled);

    let vault_field = column![
        text("Vault Path").size(13),
        text_input("Path to your Obsidian vault", &state.vault_path)
            .on_input(Message::VaultPathChanged),
    ]
    .spacing(4);

    let daily_root_field = column![
        text("Daily Root").size(13),
        text_input("e.g. Daily", &state.daily_folder_root).on_input(Message::DailyRootChanged),
    ]
    .spacing(4);

    let day_pattern_field = column![
        text("Day Pattern").size(13),
        text_input("e.g. %Y-%m-%d", &state.day_pattern).on_input(Message::DayPatternChanged),
    ]
    .spacing(4);

    let keylog_suffix_field = column![
        text("Keylog Suffix").size(13),
        text_input("e.g.  - keylog", &state.keylog_suffix)
            .on_input(Message::KeylogSuffixChanged),
    ]
    .spacing(4);

    let idle_field = column![
        text("Idle Timeout (seconds)").size(13),
        text_input("60", &state.idle_timeout).on_input(Message::IdleTimeoutChanged),
    ]
    .spacing(4);

    let excluded_field = column![
        text("Excluded apps (comma separated)").size(13),
        text_input("1Password, Bitwarden, …", &state.excluded_apps)
            .on_input(Message::ExcludedAppsChanged),
        text(
            "Keystrokes from these apps are never captured (e.g. password managers)."
        )
        .size(11),
    ]
    .spacing(4);

    let review_header = text("Review unsynced (privacy gate)").size(16);
    let refresh_btn = button("Refresh Preview").on_press(Message::LoadPreview);
    let preview_summary = text(&state.preview_status).size(13);

    let preview_cards: Element<Message> = if state.preview.is_empty() {
        text("Click “Refresh Preview” to review what a sync would write.")
            .size(13)
            .into()
    } else {
        let cards: Vec<Element<Message>> = state
            .preview
            .iter()
            .map(|s| {
                let time = s.start.with_timezone(&Local).format("%H:%M").to_string();
                let title = if s.app.is_empty() {
                    time
                } else {
                    format!("{} — {}", time, s.app)
                };
                let body = scrollable(text(&s.text).size(13)).height(Length::Fixed(120.0));
                container(
                    column![text(title).size(13), body].spacing(4),
                )
                .padding(8)
                .style(|_theme| container::Style {
                    background: Some(iced::Background::Color(iced::Color::from_rgb(
                        0.94, 0.94, 0.96,
                    ))),
                    ..container::Style::default()
                })
                .into()
            })
            .collect();
        column(cards).spacing(8).into()
    };

    let review_section = column![
        review_header,
        row![refresh_btn, preview_summary].spacing(12),
        preview_cards,
    ]
    .spacing(8);

    let sync_actions = row![
        button("Apply Sync Settings").on_press(Message::ApplyConfig),
        button("Force Sync").on_press(Message::ForceSync),
    ]
    .spacing(12);

    let status_line = text(&state.status).size(13);

    let content = column![
        title,
        logger_row,
        sync_header,
        enabled_toggle,
        vault_field,
        daily_root_field,
        day_pattern_field,
        keylog_suffix_field,
        idle_field,
        excluded_field,
        review_section,
        sync_actions,
        status_line,
    ]
    .spacing(12)
    .padding(16);

    container(scrollable(content))
        .width(iced::Length::Fill)
        .height(iced::Length::Fill)
        .into()
}

/// Declarative subscription: while `running` is true we run the background
/// `KeystrokeLogger` thread inside an async `Subscription`. When `running`
/// flips to false the subscription disappears, the stream is dropped, and the
/// `StopGuard` calls `KeystrokeLogger::stop()` — all without blocking the UI.
fn subscription(state: &Inkwell) -> Subscription<Message> {
    if !state.running {
        return Subscription::none();
    }

    #[derive(Hash, Clone, Copy)]
    struct Keytap;

    Subscription::run_with_id(Keytap, keystroke_stream())
}

/// A never-ending stream that owns the running `KeystrokeLogger`. It emits a
/// single `LogStatus` message when the tap starts, then stays pending forever
/// (keeping the capture thread alive) until the `Subscription` is cancelled,
/// at which point the stream — and the `StopGuard` inside it — is dropped.
fn keystroke_stream() -> impl iced::futures::stream::Stream<Item = Message> {
    struct StopGuard(KeystrokeLogger);
    impl Drop for StopGuard {
        fn drop(&mut self) {
            self.0.stop();
        }
    }

    let logger = KeystrokeLogger::new();
    logger.start();
    let guard = StopGuard(logger);

    iced::futures::stream::unfold((guard, false), |state| async move {
        let (guard, emitted) = state;
        if !emitted {
            Some((
                Message::LogStatus("Keystroke tap running.".into()),
                (guard, true),
            ))
        } else {
            // Keep the guard alive (and the tap running) until cancellation.
            iced::futures::future::pending::<Option<(Message, (StopGuard, bool))>>().await
        }
    })
}

fn main() -> iced::Result {
    env_logger::init();
    // Apply the default (and any previously saved) app-exclusion list before the
    // tap can start, so password managers etc. are never captured by default.
    keystroke::set_excluded_apps(sync::config_snapshot().excluded_apps);
    iced::application("Inkwell", update, view)
        .subscription(subscription)
        .run()
}
