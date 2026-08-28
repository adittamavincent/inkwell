use tauri::{Builder, generate_handler, generate_context};

mod commands;
mod keystroke;
mod db;
mod sync;

fn main() {
    Builder::default()
        .invoke_handler(generate_handler![
            commands::start_tap,
            commands::stop_tap,
            commands::get_recent_sessions,
            commands::export_diary,
            commands::configure_cogdex_sync,
            commands::sync_to_cogdex,
        ])
        .run(generate_context!())
        .expect("error while running tauri application");
}
