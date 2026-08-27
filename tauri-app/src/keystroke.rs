// src/keystroke.rs
// Minimal CGEventTap wrapper for macOS key logging.
// This mirrors the mapping logic from daemon.py but is simplified.

use core_graphics::event::{CGEvent, CGEventType, CGEventTapLocation, CGEventTapOptions, CGEventTapPlacement, CGEventTapCreate, CGEventTapEnable};
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
use core_graphics::event::{CGEventFlags, CGKeyCode};
use core_foundation::runloop::{CFRunLoop, CFRunLoopAddSource, CFRunLoopRun, CFRunLoopSource, CFRunLoopSourceContext};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use log::{info, error};
use crate::db;

#[derive(Clone)]
pub struct KeystrokeLogger {
    // Store shared state such as running flag.
    running: Arc<Mutex<bool>>,    
}

impl KeystrokeLogger {
    pub fn new() -> Self {
        Self { running: Arc::new(Mutex::new(false)) }
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
            // Create event tap
            unsafe {
                let tap = CGEventTapCreate(
                    CGEventTapLocation::HID,
                    CGEventTapPlacement::HeadInsertEventTap,
                    CGEventTapOptions::ListenOnly,
                    CGEventMask::new(1 << CGEventType::KeyDown as u64),
                    callback,
                    std::ptr::null_mut(),
                );
                if tap.is_null() {
                    error!("Failed to create CGEventTap");
                    return;
                }
                CGEventTapEnable(tap, true);
                let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState).unwrap();
                let rl = CFRunLoop::get_current();
                let src = CFRunLoopSource::new(&CFRunLoopSourceContext::new(&source), 0);
                CFRunLoopAddSource(&rl, &src, kCFRunLoopCommonModes);
                // Run loop until stopped
                while *running_flag.lock().unwrap() {
                    CFRunLoopRun(); // will block; in real code we'd integrate properly
                    thread::sleep(Duration::from_millis(100));
                }
                // Cleanup
                CGEventTapEnable(tap, false);
                info!("Keystroke tap stopped");
            }
        });
    }

    pub fn stop(&self) {
        let mut running = self.running.lock().unwrap();
        *running = false;
    }
}

// Callback for each key down event.
unsafe extern "C" fn callback(proxy: CGEventTapProxy, type_: CGEventType, event: CGEvent, _refcon: *mut std::ffi::c_void) -> CGEvent {
    if type_ == CGEventType::KeyDown {
        let key_code: CGKeyCode = event.get_integer_value_field(core_graphics::event::CGEventField::KeyboardEventKeycode);
        let flags = event.get_flags();
        // Map key_code to string; simplified version.
        let key_char = map_key(key_code, flags);
        // Get frontmost app name via AppKit (placeholder, omitted for brevity).
        let app_name = "Unknown".to_string();
        let timestamp = chrono::Utc::now().to_rfc3339();
        // Insert into DB (ignore errors for demo).
        let _ = db::insert_keystroke(&timestamp, &app_name, &key_char, key_code as i64);
    }
    event
}

fn map_key(key_code: CGKeyCode, flags: CGEventFlags) -> String {
    // Basic mapping for printable characters and some special keys.
    match key_code {
        49 => " ".to_string(), // space
        36 => "[↵]".to_string(), // return
        51 => "[⌫]".to_string(), // backspace
        117 => "[⌦]".to_string(), // forward delete
        48 => "[⇥]".to_string(), // tab
        53 => "[ESC]".to_string(), // escape
        123 => "[←]".to_string(), // left arrow
        124 => "[→]".to_string(), // right arrow
        125 => "[↓]".to_string(), // down arrow
        126 => "[↑]".to_string(), // up arrow
        _ => {
            // For alphanumeric, use Unicode scalar if shift not pressed.
            let ch = (key_code as u8) as char;
            if flags.contains(CGEventFlags::SHIFT) {
                ch.to_ascii_uppercase().to_string()
            } else {
                ch.to_string()
            }
        }
    }
}
