#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use minuta::audio::{start_recording, stop_recording};
use minuta::settings::{load_settings, save_settings};
use minuta::state::AppState;
use minuta::summarize::summarize_transcript;
use minuta::transcribe::transcribe_audio;
use minuta::vault::save_note;

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
            load_settings,
            save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
