#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use minuta::audio::*;
use minuta::settings::*;
use minuta::state::AppState;
use minuta::summarize::*;
use minuta::transcribe::*;
use minuta::vault::*;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            start_recording,
            stop_recording,
            transcribe_audio,
            summarize_transcript,
            save_note,
            list_notes,
            read_note,
            delete_note,
            load_settings,
            save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
