use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

use crate::error::{AppError, Result};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub vault_path: String,
    pub output_folder: String,
    pub whisper_model: String,
    pub ollama_base_url: String,
    pub ollama_model: String,
    pub openai_api_key: Option<String>,
    pub anthropic_api_key: Option<String>,
    pub wikilink_attendees: bool,
    pub transcript_mode: String,
    pub language: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            vault_path: String::new(),
            output_folder: "meetings".to_string(),
            whisper_model: "base".to_string(),
            ollama_base_url: "http://localhost:11434".to_string(),
            ollama_model: "llama3".to_string(),
            openai_api_key: None,
            anthropic_api_key: None,
            wikilink_attendees: true,
            transcript_mode: "collapsed".to_string(),
            language: "en".to_string(),
        }
    }
}

fn settings_path(app: &AppHandle) -> PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    data_dir.join("settings.json")
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<AppSettings> {
    let path = settings_path(&app);
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| AppError::Settings(e.to_string()))?;
    serde_json::from_str(&content).map_err(|e| AppError::Settings(e.to_string()))
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<()> {
    let path = settings_path(&app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::Settings(e.to_string()))?;
    }
    let content =
        serde_json::to_string_pretty(&settings).map_err(|e| AppError::Settings(e.to_string()))?;
    fs::write(&path, content).map_err(|e| AppError::Settings(e.to_string()))
}
