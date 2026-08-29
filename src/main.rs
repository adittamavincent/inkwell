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

// The `objc` crate's `msg_send!` macro trips `unexpected_cfgs` lints on modern
// Rust; the macro is sound, so silence the noise crate-wide.
#![allow(unexpected_cfgs)]

use chrono::{DateTime, Local, Utc};
use iced::border;
use iced::time;
use iced::widget::{
    button, checkbox, column, container, horizontal_space, row, rule, scrollable, text,
    text_input, vertical_space, Space,
};
use iced::widget::scrollable::{self as scroll_mod, AbsoluteOffset, Id};
use iced::{Background, Color, Element, Length, Subscription, Task, Theme};
use iced::futures::channel::mpsc::unbounded;
use iced::futures::StreamExt;

mod db;
mod keystroke;
mod sync;

use keystroke::KeystrokeLogger;
use sync::{CogdexSyncConfig, SessionPreview};

// ---------------------------------------------------------------------------
// Palette — a dark, IDE-ish look.
// ---------------------------------------------------------------------------
const C_BG: (f32, f32, f32) = (0.106, 0.106, 0.122);
const C_SIDEBAR: (f32, f32, f32) = (0.082, 0.082, 0.098);
const C_PANEL: (f32, f32, f32) = (0.122, 0.122, 0.141);
const C_CARD: (f32, f32, f32) = (0.165, 0.165, 0.192);
const C_ACCENT: (f32, f32, f32) = (0.486, 0.361, 1.0);
const C_ACCENT_DIM: (f32, f32, f32) = (0.33, 0.25, 0.62);
const C_DANGER: (f32, f32, f32) = (0.85, 0.27, 0.32);
const C_TEXT: (f32, f32, f32) = (0.902, 0.902, 0.918);
const C_MUTED: (f32, f32, f32) = (0.604, 0.604, 0.639);

fn col(c: (f32, f32, f32)) -> Color {
    Color::from_rgb(c.0, c.1, c.2)
}

fn adjust(c: (f32, f32, f32), f: f32) -> (f32, f32, f32) {
    (
        (c.0 * f).clamp(0.0, 1.0),
        (c.1 * f).clamp(0.0, 1.0),
        (c.2 * f).clamp(0.0, 1.0),
    )
}

fn history_id() -> Id {
    Id::new("history")
}

/// Target width (px) of the expanded secondary (right) panel.
const SIDE_W: f32 = 340.0;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
struct Inkwell {
    /// Whether the system-wide keystroke tap is currently running.
    running: bool,

    // --- Cogdex sync config (mirrors `CogdexSyncConfig`) ---
    enabled: bool,
    vault_path: String,
    daily_folder_root: String,
    day_pattern: String,
    keylog_suffix: String,
    idle_timeout: String,
    excluded_apps: String,

    /// Completed typing sessions (oldest first) shown in the history feed.
    history: Vec<SessionPreview>,
    /// In-progress session tokens (so we can re-run the reconstructor live).
    live_tokens: Vec<String>,
    live_app: String,
    live_start: Option<DateTime<Utc>>,
    live_text: String,
    last_tick: Option<DateTime<Local>>,

    /// Whether the right-hand (secondary) config/sync panel is expanded.
    side_open: bool,
    /// Current animated width of the secondary panel (0 when collapsed).
    side_width: f32,
    /// True while the collapse/expand animation is in flight.
    animating: bool,

    /// Transient status line shown at the bottom of the window.
    status: String,
}

#[derive(Debug, Clone)]
enum Message {
    StartLogger,
    StopLogger,
    LogStatus(String),
    Keystroke((String, String)),
    ClearHistory,
    ToggleSide,
    Tick,

    ToggleEnabled(bool),
    VaultPathChanged(String),
    DailyRootChanged(String),
    DayPatternChanged(String),
    KeylogSuffixChanged(String),
    IdleTimeoutChanged(String),
    ExcludedAppsChanged(String),

    ApplyConfig,
    ForceSync,
    SyncResult(Result<String, String>),
}

impl Default for Inkwell {
    fn default() -> Self {
        let cfg = sync::config_snapshot();
        Inkwell {
            running: true,
            enabled: cfg.enabled,
            vault_path: cfg.vault_path,
            daily_folder_root: cfg.daily_folder_root,
            day_pattern: cfg.day_pattern,
            keylog_suffix: cfg.keylog_suffix,
            idle_timeout: cfg.idle_timeout_secs.to_string(),
            excluded_apps: cfg.excluded_apps.join(", "),
            history: Vec::new(),
            live_tokens: Vec::new(),
            live_app: String::new(),
            live_start: None,
            live_text: String::new(),
            last_tick: None,
            side_open: false,
            side_width: 0.0,
            animating: false,
            status: String::new(),
        }
    }
}

impl Inkwell {
    fn build_config(&self) -> CogdexSyncConfig {
        CogdexSyncConfig {
            enabled: self.enabled,
            vault_path: self.vault_path.trim().to_string(),
            daily_folder_root: self.daily_folder_root.trim().to_string(),
            day_pattern: self.day_pattern.trim().to_string(),
            keylog_suffix: self.keylog_suffix.to_string(),
            idle_timeout_secs: self.idle_timeout.trim().parse().unwrap_or(60),
            excluded_apps: self
                .excluded_apps
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect(),
        }
    }

    fn reset_live(&mut self) {
        self.live_tokens.clear();
        self.live_app.clear();
        self.live_start = None;
        self.live_text.clear();
        self.last_tick = None;
    }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
fn update(state: &mut Inkwell, message: Message) -> Task<Message> {
    match message {
        Message::StartLogger => {
            state.running = true;
            state.reset_live();
            state.history.clear();
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
        Message::ClearHistory => {
            state.history.clear();
            state.reset_live();
            Task::none()
        }

        Message::ToggleSide => {
            state.side_open = !state.side_open;
            state.animating = true;
            Task::none()
        }
        Message::Tick => {
            let target = if state.side_open { SIDE_W } else { 0.0 };
            let diff = target - state.side_width;
            if diff.abs() < 0.5 {
                state.side_width = target;
                state.animating = false;
            } else {
                // Ease toward the target for a smooth collapse/expand.
                state.side_width += diff * 0.25;
            }
            Task::none()
        }

        Message::Keystroke((app, key)) => {
            if key.is_empty() {
                return Task::none();
            }
            let idle = state.idle_timeout.trim().parse::<i64>().unwrap_or(60);
            let now = Local::now();

            // Start a new "session" when the app changes or we've been idle
            // longer than the configured gap.
            let new_session = state.live_start.is_none()
                || state.live_app != app
                || match state.last_tick {
                    Some(last) => (now - last).num_seconds() > idle,
                    None => false,
                };

            if new_session {
                if !state.live_text.trim().is_empty() {
                    let finished = SessionPreview {
                        start: state.live_start.unwrap_or_else(Utc::now),
                        app: std::mem::take(&mut state.live_app),
                        text: std::mem::take(&mut state.live_text),
                    };
                    state.history.push(finished);
                }
                state.live_app = app;
                state.live_start = Some(now.with_timezone(&Utc));
                state.live_tokens = vec![key];
            } else {
                state.live_tokens.push(key);
            }

            state.live_text = sync::reconstruct_text(&state.live_tokens);
            state.last_tick = Some(now);

            scroll_mod::scroll_to(history_id(), AbsoluteOffset { x: 0.0, y: f32::MAX })
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
        Message::ForceSync => {
            state.status = "Syncing…".into();
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
fn panel(color: (f32, f32, f32)) -> impl Fn(&Theme) -> container::Style {
    move |_| container::Style {
        background: Some(Background::Color(col(color))),
        ..container::Style::default()
    }
}

fn btn_style(accent: bool, danger: bool) -> impl Fn(&Theme, button::Status) -> button::Style {
    move |_theme, status| {
        let base = if danger {
            C_DANGER
        } else if accent {
            C_ACCENT
        } else {
            C_CARD
        };
        let (bg, txt) = match status {
            button::Status::Hovered => (adjust(base, 1.18), C_TEXT),
            button::Status::Pressed => (adjust(base, 0.82), C_TEXT),
            button::Status::Disabled => (adjust(base, 0.6), C_MUTED),
            _ => (base, C_TEXT),
        };
        button::Style {
            background: Some(Background::Color(col(bg))),
            text_color: col(txt),
            border: border::Border {
                radius: 8.0.into(),
                ..border::Border::default()
            },
            ..button::Style::default()
        }
    }
}

fn badge_style() -> impl Fn(&Theme) -> container::Style {
    move |_| container::Style {
        background: Some(Background::Color(col(C_ACCENT_DIM))),
        border: border::Border {
            radius: 6.0.into(),
            ..border::Border::default()
        },
        ..container::Style::default()
    }
}

fn input_style(_t: &Theme, _s: text_input::Status) -> text_input::Style {
    text_input::Style {
        background: Background::Color(col(C_CARD)),
        border: border::Border {
            radius: 6.0.into(),
            width: 1.0,
            color: col(C_PANEL),
        },
        icon: col(C_MUTED),
        placeholder: col(C_MUTED),
        value: col(C_TEXT),
        selection: col(C_ACCENT),
    }
}

// ---------------------------------------------------------------------------
// Widget helpers
// ---------------------------------------------------------------------------
fn el<'a, W>(widget: W) -> Element<'a, Message>
where
    W: Into<Element<'a, Message>>,
{
    widget.into()
}

fn field<'a>(
    label: &'a str,
    placeholder: &'a str,
    value: &'a str,
    on_input: fn(String) -> Message,
) -> Element<'a, Message> {
    column![
        text(label).size(12).color(col(C_MUTED)),
        text_input(placeholder, value)
            .on_input(on_input)
            .style(input_style)
            .size(13),
    ]
    .spacing(6)
    .into()
}

fn bubble<'a>(start: DateTime<Utc>, app: &'a str, body: &'a str, live: bool) -> Element<'a, Message> {
    let time = start.with_timezone(&Local).format("%H:%M:%S").to_string();
    let app_badge = container(text(if app.is_empty() { "Unknown" } else { app }).size(12).color(col(C_TEXT)))
        .padding([3, 8])
        .style(badge_style());
    let header = row![
        app_badge,
        text(time).size(12).color(col(C_MUTED)),
        if live {
            text("● live").size(11).color(col(C_ACCENT))
        } else {
            text("").size(11)
        },
        horizontal_space(),
    ]
    .spacing(8)
    .align_y(iced::alignment::Vertical::Center);

    let content = text(body).size(13).font(iced::Font::MONOSPACE).color(col(C_TEXT));

    container(column![header, content].spacing(8))
        .padding(12)
        .style(panel(C_CARD))
        .into()
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------
fn sidebar(state: &Inkwell) -> Element<'_, Message> {
    let running = state.running;
    let dot = container(Space::with_width(8).height(8))
        .style(move |_t| container::Style {
            background: Some(Background::Color(col(if running { C_ACCENT } else { C_DANGER }))),
            border: border::Border {
                radius: 999.0.into(),
                ..border::Border::default()
            },
            ..container::Style::default()
        });

    let title: iced::widget::Text<'_, Theme, iced::Renderer> =
        text("Inkwell").size(24).color(col(C_TEXT));
    let subtitle: iced::widget::Text<'_, Theme, iced::Renderer> =
        text("Keystroke → file logger").size(12).color(col(C_MUTED));

    let toggle_btn = button(text(if running { "Stop Logger" } else { "Start Logger" }).size(15))
        .on_press(if running {
            Message::StopLogger
        } else {
            Message::StartLogger
        })
        .style(move |t, s| btn_style(!running, running)(t, s))
        .width(Length::Fill);

    let state_label = text(if running { "Tap running" } else { "Tap idle" })
        .size(13)
        .color(if running { col(C_ACCENT) } else { col(C_MUTED) });

    let excluded = state.excluded_apps.split(',').filter(|s| !s.trim().is_empty()).count();
    let legend = column![
        text("Capture").size(12).color(col(C_MUTED)),
        text(format!("Excluded apps: {}", excluded)).size(12).color(col(C_TEXT)),
        vertical_space(),
        text("History shows a live, chat-like feed of reconstructed typing. Select-all, backspace, arrows and word-deletes are replayed so spacing stays correct.").size(11).color(col(C_MUTED)),
    ]
    .spacing(6);

    let col = column![
        title,
        subtitle,
        row![dot, state_label].spacing(8).align_y(iced::alignment::Vertical::Center),
        toggle_btn,
        rule::Rule::horizontal(1),
        legend,
    ]
    .spacing(14)
    .padding(16)
    .height(Length::Fill);

    container(col)
        .width(Length::Fixed(260.0))
        .height(Length::Fill)
        .style(panel(C_SIDEBAR))
        .into()
}

fn history_pane(state: &Inkwell) -> Element<'_, Message> {
    let mut entries: Vec<Element<'_, Message>> = Vec::new();
    for s in &state.history {
        entries.push(bubble(s.start, &s.app, &s.text, false));
    }
    if !state.live_text.trim().is_empty() {
        let start = state.live_start.unwrap_or_else(Utc::now);
        entries.push(bubble(start, &state.live_app, &state.live_text, true));
    }

    let feed: Element<'_, Message> = if entries.is_empty() {
        column![
            vertical_space(),
            el(text("No keystrokes captured yet.")
                .size(14)
                .color(col(C_MUTED))),
            el(text("Press “Start Logger” and begin typing somewhere.")
                .size(12)
                .color(col(C_MUTED))),
            vertical_space(),
        ]
        .align_x(iced::alignment::Horizontal::Center)
        .spacing(6)
        .height(Length::Fill)
        .into()
    } else {
        column(entries).spacing(10).padding(16).width(Length::Fill).into()
    };

    let side_toggle = button(text(if state.side_open { "▸ Sync" } else { "◂ Sync" }).size(13))
        .on_press(Message::ToggleSide)
        .style(btn_style(false, false));

    let header = container(
        row![
            text("History").size(18).color(col(C_TEXT)),
            horizontal_space(),
            side_toggle,
            button(text("Clear").size(13)).on_press(Message::ClearHistory).style(btn_style(false, false)),
        ]
        .spacing(10)
        .align_y(iced::alignment::Vertical::Center),
    )
    .padding([12, 16])
    .style(panel(C_PANEL));

    let body = scrollable(feed)
        .id(history_id())
        .width(Length::Fill)
        .height(Length::Fill);

    column![header, body]
        .width(Length::Fill)
        .height(Length::Fill)
        .into()
}

fn config_pane(state: &Inkwell, width: f32) -> Element<'_, Message> {
    let header = text("Cogdex (Obsidian) Sync").size(18).color(col(C_TEXT));
    let toggle = checkbox("Enable sync", state.enabled).on_toggle(Message::ToggleEnabled);

    let col = column![
        header,
        toggle,
        rule::Rule::horizontal(1),
        field("Vault Path", "Path to your Obsidian vault", &state.vault_path, Message::VaultPathChanged),
        field("Daily Root", "e.g. Daily", &state.daily_folder_root, Message::DailyRootChanged),
        field("Day Pattern", "e.g. %Y-%m-%d", &state.day_pattern, Message::DayPatternChanged),
        field("Keylog Suffix", "e.g.  - keylog", &state.keylog_suffix, Message::KeylogSuffixChanged),
        field("Idle Timeout (s)", "60", &state.idle_timeout, Message::IdleTimeoutChanged),
        field("Excluded apps (comma separated)", "1Password, Bitwarden, …", &state.excluded_apps, Message::ExcludedAppsChanged),
        button("Apply Sync Settings")
            .on_press(Message::ApplyConfig)
            .style(btn_style(true, false))
            .width(Length::Fill),
        rule::Rule::horizontal(1),
        button("Force Sync")
            .on_press(Message::ForceSync)
            .style(btn_style(true, false))
            .width(Length::Fill),
    ]
    .spacing(12)
    .padding(16)
    .width(Length::Fill);

    container(scrollable(col).width(Length::Fill).height(Length::Fill))
        .width(Length::Fixed(width))
        .height(Length::Fill)
        .style(panel(C_PANEL))
        .into()
}

fn view(state: &Inkwell) -> Element<'_, Message> {
    // The secondary panel is rendered at its animated width. When fully
    // collapsed (and not mid-animation) we swap in a zero-width spacer so no
    // content is laid out off-screen.
    let side: Element<'_, Message> = if state.side_width < 1.0 && !state.animating {
        container(Space::new(Length::Fixed(0.0), Length::Fill))
            .width(Length::Fixed(0.0))
            .height(Length::Fill)
            .into()
    } else {
        config_pane(state, state.side_width)
    };

    let content = row![sidebar(state), history_pane(state), side]
        .spacing(1)
        .width(Length::Fill)
        .height(Length::Fill);

    let status_bar = container(
        text(if state.status.is_empty() {
            "Ready."
        } else {
            &state.status
        })
        .size(12)
        .color(col(C_MUTED)),
    )
    .padding([8, 16])
    .style(panel(C_SIDEBAR));

    container(column![content, status_bar].spacing(1).height(Length::Fill))
        .width(Length::Fill)
        .height(Length::Fill)
        .style(panel(C_BG))
        .into()
}

// ---------------------------------------------------------------------------
// Subscription — owns the running keystroke tap and streams captured
// (app, char) pairs into the live history.
// ---------------------------------------------------------------------------
fn subscription(state: &Inkwell) -> Subscription<Message> {
    let mut subs: Vec<Subscription<Message>> = Vec::new();

    if state.running {
        #[derive(Hash, Clone, Copy)]
        struct Keytap;
        subs.push(Subscription::run_with_id(Keytap, keystroke_stream()));
    }

    // While the secondary panel is animating, tick ~120fps to step its width.
    if state.animating {
        subs.push(time::every(std::time::Duration::from_millis(8)).map(|_| Message::Tick));
    }

    Subscription::batch(subs)
}

fn keystroke_stream() -> impl iced::futures::Stream<Item = Message> {
    struct StopGuard(KeystrokeLogger);
    impl Drop for StopGuard {
        fn drop(&mut self) {
            self.0.stop();
        }
    }

    let (tx, rx) = unbounded::<(String, String)>();
    keystroke::set_sink(tx);
    let logger = KeystrokeLogger::new();
    logger.start();
    let guard = StopGuard(logger);

    // The receiver is threaded through the unfold state so the (FnMut) closure
    // can own it across the repeated `await`s without moving it more than once.
    iced::futures::stream::unfold((guard, false, rx), |state| async move {
        let (guard, emitted, mut rx) = state;
        if !emitted {
            Some((
                Message::LogStatus("Keystroke tap running.".into()),
                (guard, true, rx),
            ))
        } else {
            match rx.next().await {
                Some(pair) => Some((Message::Keystroke(pair), (guard, true, rx))),
                // Sender was dropped without a Stop (shouldn't happen); keep
                // the tap alive until the subscription is cancelled.
                None => {
                    iced::futures::future::pending::<Option<(Message, (StopGuard, bool, UnboundedRx))>>()
                        .await
                }
            }
        }
    })
}

type UnboundedRx = iced::futures::channel::mpsc::UnboundedReceiver<(String, String)>;

fn main() -> iced::Result {
    env_logger::init();
    keystroke::set_excluded_apps(sync::config_snapshot().excluded_apps);
    iced::application("Inkwell", update, view)
        .theme(|_state| Theme::Dark)
        .subscription(subscription)
        .window(iced::window::Settings {
            size: iced::Size::new(1180.0, 760.0),
            ..iced::window::Settings::default()
        })
        .run()
}
