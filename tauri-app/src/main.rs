use tauri::{Builder, generate_handler, generate_context, Manager};

mod commands;
mod keystroke;
mod db;

fn main() {
    Builder::default()
        .invoke_handler(generate_handler![
            commands::start_tap,
            commands::stop_tap,
            commands::get_recent_sessions,
            commands::export_diary,
        ])
        .run(generate_context!())
        .expect("error while running tauri application");
}
