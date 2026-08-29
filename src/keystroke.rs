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
use std::os::raw::c_ulong;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use log::{error, info};

use crate::db;

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
                        // TODO: real frontmost-app detection (requires the
                        // `objc` + AppKit `NSWorkspace` frontmostApplication).
                        let app_name = "Unknown".to_string();
                        let timestamp = Utc::now().to_rfc3339();
                        let _ = db::insert_keystroke(
                            &timestamp,
                            &app_name,
                            &key_char,
                            key_code as i64,
                        );
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
