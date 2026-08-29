// src/keystroke.rs
// macOS system-wide key logger built on a CoreGraphics event tap.
//
// Uses the modern `core-graphics` 0.24 `CGEventTap` API, which exposes a Rust
// closure callback (no manual `extern "C"` plumbing) and owns the underlying
// `CFMachPort`. Captured keystrokes are stored in SQLite via `db`; the optional
// Cogdex sync (which turns those rows into markdown sessions appended below the
// `LOG-BELOW` boundary) lives in `sync.rs`.

use chrono::Utc;
use core_foundation::runloop::{CFRunLoop, kCFRunLoopCommonModes, kCFRunLoopDefaultMode};
use core_graphics::event::{
    CGEvent, CGEventTap, CGEventTapLocation, CGEventTapOptions, CGEventTapPlacement,
    CGEventType, CGKeyCode, EventField,
};
use core_graphics::sys::CGEventRef;
use foreign_types::ForeignType;
use iced::futures::channel::mpsc::{UnboundedSender, unbounded};
use objc::runtime::{Class, Object};
use objc::msg_send;
use objc::sel;
use objc::sel_impl;
use std::collections::HashSet;
use std::os::raw::c_ulong;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use log::{error, info};

use crate::db;

// Apps whose keystrokes are never captured. Compared case-insensitively
// against the frontmost application's localized name. Lets the user keep
// password managers, banking, etc. out of the log.
lazy_static::lazy_static! {
    static ref EXCLUDED_APPS: Mutex<HashSet<String>> = Mutex::new(HashSet::new());
}

/// A live broadcast channel for captured keystrokes. When set (via
/// `set_sink`), every captured (app, char) pair is pushed here so the UI can
/// show a real-time, chat-like history of what's being typed. The sender is
/// owned by the iced subscription, which swaps in a fresh one each time the tap
/// starts; the capture thread only reads the current global sender, so a stale
/// sender is harmless (its `unbounded_send` simply returns `Err`).
lazy_static::lazy_static! {
    static ref SINK: Mutex<Option<UnboundedSender<(String, String)>>> =
        Mutex::new(None);
}

/// Install (or replace) the live keystroke sink used by the UI subscription.
pub fn set_sink(tx: UnboundedSender<(String, String)>) {
    *SINK.lock().unwrap() = Some(tx);
}

/// Replace the exclusion list (app names, comma/line separated in the UI).
pub fn set_excluded_apps(apps: Vec<String>) {
    let mut set = EXCLUDED_APPS.lock().unwrap();
    set.clear();
    for a in apps {
        let t = a.trim().to_string();
        if !t.is_empty() {
            set.insert(t.to_lowercase());
        }
    }
}

/// Resolve the localized name of the currently frontmost application via
/// AppKit's `NSWorkspace`. Returns `"Unknown"` if it can't be determined.
fn frontmost_app_name() -> String {
    unsafe {
        let cls = match Class::get("NSWorkspace") {
            Some(c) => c as *const Class as *mut Class,
            None => return "Unknown".to_string(),
        };
        let workspace: *mut Object = msg_send![cls, sharedWorkspace];
        if workspace.is_null() {
            return "Unknown".to_string();
        }
        let app: *mut Object = msg_send![workspace, frontmostApplication];
        if app.is_null() {
            return "Unknown".to_string();
        }
        let name: *mut Object = msg_send![app, localizedName];
        if name.is_null() {
            return "Unknown".to_string();
        }
        let cstr: *const std::os::raw::c_char = msg_send![name, UTF8String];
        if cstr.is_null() {
            return "Unknown".to_string();
        }
        std::ffi::CStr::from_ptr(cstr).to_string_lossy().into_owned()
    }
}

// Layout-aware character extraction is not exposed as a method on `CGEvent` in
// `core-graphics`, so we call the underlying framework function directly.
extern "C" {
    fn CGEventKeyboardGetUnicodeString(
        event: CGEventRef,
        max_string_length: c_ulong,
        out_string_length: *mut c_ulong,
        unicode_string: *mut u16,
    );
}

#[derive(Clone)]
pub struct KeystrokeLogger {
    running: Arc<Mutex<bool>>,
}

impl KeystrokeLogger {
    pub fn new() -> Self {
        Self {
            running: Arc::new(Mutex::new(false)),
        }
    }

    pub fn start(&self) {
        let mut running = self.running.lock().unwrap();
        if *running {
            info!("Keystroke tap already running");
            return;
        }
        *running = true;
        let running_flag = self.running.clone();

        thread::spawn(move || {
            // ListenOnly => a passive tap that never consumes/modifies events.
            let tap = match CGEventTap::new(
                CGEventTapLocation::HID,
                CGEventTapPlacement::HeadInsertEventTap,
                CGEventTapOptions::ListenOnly,
                vec![CGEventType::KeyDown],
                |_proxy, type_, event| {
                    if type_ as u32 == CGEventType::KeyDown as u32 {
                        let key_code: CGKeyCode = event
                            .get_integer_value_field(EventField::KEYBOARD_EVENT_KEYCODE)
                            as CGKeyCode;
                        let chars = unsafe { event_characters(event) };
                        let key_char = match map_key(key_code) {
                            Some(token) => token,
                            None => {
                                if chars.is_empty() {
                                    return None;
                                }
                                chars
                            }
                        };
						if key_char.is_empty() {
							return None;
						}
						let app_name = frontmost_app_name();
						// Skip apps the user has excluded (e.g. password
						// managers, banking) so they never land in the log.
						{
							let excl = EXCLUDED_APPS.lock().unwrap();
							if excl.contains(&app_name.to_lowercase()) {
								return None;
							}
						}
					let timestamp = Utc::now().to_rfc3339();
					let _ = db::insert_keystroke(
						&timestamp,
						&app_name,
						&key_char,
						key_code as i64,
					);

					// Broadcast to the live UI feed (if a sink is installed).
					if !key_char.is_empty() {
						if let Some(tx) = SINK.lock().unwrap().as_ref() {
							let _ = tx.unbounded_send((app_name.clone(), key_char.clone()));
						}
					}
                    }
                    None
                },
            ) {
                Ok(t) => t,
                Err(_) => {
                    error!(
                        "Failed to create CGEventTap. Did the user grant \
                         Input Monitoring / Accessibility permission in System Settings?"
                    );
                    *running_flag.lock().unwrap() = false;
                    return;
                }
            };

            let run_loop = CFRunLoop::get_current();
            match tap.mach_port.create_runloop_source(0) {
                Ok(source) => run_loop.add_source(&source, unsafe { kCFRunLoopCommonModes }),
                Err(_) => {
                    error!("Failed to create run loop source for the event tap");
                    *running_flag.lock().unwrap() = false;
                    return;
                }
            }
            tap.enable();

            // Poll the run loop in short slices so `stop()` can break out
            // promptly without blocking the thread forever in CFRunLoopRun().
            while *running_flag.lock().unwrap() {
                CFRunLoop::run_in_mode(
                    unsafe { kCFRunLoopDefaultMode },
                    Duration::from_millis(200),
                    false,
                );
            }
            info!("Keystroke tap stopped");
        });
    }

    pub fn stop(&self) {
        let mut running = self.running.lock().unwrap();
        *running = false;
    }
}

/// Extract the actual typed characters for an event, honouring the active
/// keyboard layout (dead keys, diacritics, non-US layouts, etc.).
unsafe fn event_characters(event: &CGEvent) -> String {
    let mut buf = [0u16; 256];
    let mut len: c_ulong = 0;
    CGEventKeyboardGetUnicodeString(
        event.as_ptr() as CGEventRef,
        buf.len() as c_ulong,
        &mut len,
        buf.as_mut_ptr(),
    );
    if len == 0 {
        return String::new();
    }
    String::from_utf16_lossy(&buf[..len as usize])
}

/// Map layout-independent special keys to the same token vocabulary Cogdex's
/// reconstructor understands (`[⌫]`, `[↵]`, ...). Printable characters are
/// handled by `event_characters` instead.
fn map_key(key_code: CGKeyCode) -> Option<String> {
    match key_code {
        36 => Some("[↵]".to_string()),  // Return
        51 => Some("[⌫]".to_string()),  // Backspace (Delete backward)
        117 => Some("[⌦]".to_string()), // Forward Delete
        48 => Some("[⇥]".to_string()),  // Tab
        123 => Some("[←]".to_string()), // Left arrow
        124 => Some("[→]".to_string()), // Right arrow
        125 => Some("[↓]".to_string()), // Down arrow
        126 => Some("[↑]".to_string()), // Up arrow
        53 => Some("[ESC]".to_string()), // Escape
        _ => None,
    }
}
