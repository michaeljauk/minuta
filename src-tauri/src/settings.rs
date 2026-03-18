use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::error::{AppError, Result};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ObsidianConnector {
    pub enabled: bool,
    pub vault_path: String,
    pub output_folder: String,
}

impl Default for ObsidianConnector {
    fn default() -> Self {
        Self {
            enabled: false,
            vault_path: String::new(),
            output_folder: "meetings".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Connectors {
    pub obsidian: Option<ObsidianConnector>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub storage_dir: String,
    pub output_folder: String,
    pub whisper_model: String,
    pub ollama_base_url: String,
    pub ollama_model: String,
    pub openai_api_key: Option<String>,
    pub anthropic_api_key: Option<String>,
    pub wikilink_attendees: bool,
    pub transcript_mode: String,
    pub language: String,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default)]
    pub connectors: Connectors,
    #[serde(default = "default_audio_source")]
    pub audio_source: String,
    #[serde(default = "default_transcription_mode")]
    pub transcription_mode: String,
}

fn default_theme() -> String {
    "light".to_string()
}

fn default_audio_source() -> String {
    "mic".to_string()
}

fn default_transcription_mode() -> String {
    "realtime".to_string()
}

fn default_storage_dir() -> String {
    dirs::document_dir()
        .map(|d| d.join("Minuta").to_string_lossy().to_string())
        .unwrap_or_default()
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            storage_dir: default_storage_dir(),
            output_folder: "meetings".to_string(),
            whisper_model: "base".to_string(),
            ollama_base_url: "http://localhost:11434".to_string(),
            ollama_model: "llama3".to_string(),
            openai_api_key: None,
            anthropic_api_key: None,
            wikilink_attendees: true,
            transcript_mode: "collapsed".to_string(),
            language: "en".to_string(),
            theme: "light".to_string(),
            connectors: Connectors::default(),
            audio_source: default_audio_source(),
            transcription_mode: default_transcription_mode(),
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

/// Migrate v1 settings that used `vaultPath` instead of `storageDir`.
/// Moves the old vault path to `storageDir` and adds empty connectors.
fn migrate_v1_settings(raw: &mut serde_json::Value) -> bool {
    let obj = match raw.as_object_mut() {
        Some(o) => o,
        None => return false,
    };

    if let Some(vault_path) = obj.remove("vaultPath") {
        obj.insert("storageDir".to_string(), vault_path);
        if !obj.contains_key("connectors") {
            obj.insert(
                "connectors".to_string(),
                serde_json::json!({}),
            );
        }
        return true;
    }
    false
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<AppSettings> {
    let path = settings_path(&app);
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| AppError::Settings(e.to_string()))?;
    let mut raw: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| AppError::Settings(e.to_string()))?;

    // Non-destructive migration — only persisted on next save
    migrate_v1_settings(&mut raw);

    serde_json::from_value(raw).map_err(|e| AppError::Settings(e.to_string()))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrate_v1_renames_vault_path_to_storage_dir() {
        let mut raw = serde_json::json!({
            "vaultPath": "/Users/test/vault",
            "outputFolder": "meetings",
            "whisperModel": "base",
            "ollamaBaseUrl": "http://localhost:11434",
            "ollamaModel": "llama3",
            "wikilinkAttendees": true,
            "transcriptMode": "collapsed",
            "language": "en",
            "theme": "light"
        });

        let migrated = migrate_v1_settings(&mut raw);
        assert!(migrated);

        let obj = raw.as_object().unwrap();
        assert!(!obj.contains_key("vaultPath"));
        assert_eq!(obj["storageDir"], "/Users/test/vault");
        assert!(obj.contains_key("connectors"));
    }

    #[test]
    fn migrate_v1_no_op_if_already_migrated() {
        let mut raw = serde_json::json!({
            "storageDir": "/Users/test/minuta",
            "outputFolder": "meetings",
            "connectors": {}
        });

        let migrated = migrate_v1_settings(&mut raw);
        assert!(!migrated);
        assert_eq!(raw["storageDir"], "/Users/test/minuta");
    }

    #[test]
    fn default_settings_have_all_fields() {
        let settings = AppSettings::default();
        assert!(!settings.storage_dir.is_empty() || cfg!(not(target_os = "macos"))); // may be empty on CI
        assert_eq!(settings.output_folder, "meetings");
        assert_eq!(settings.whisper_model, "base");
        assert_eq!(settings.audio_source, "mic");
        assert_eq!(settings.transcription_mode, "realtime");
        assert_eq!(settings.theme, "light");
        assert!(settings.connectors.obsidian.is_none());
    }

    #[test]
    fn settings_round_trip_json() {
        let settings = AppSettings::default();
        let json = serde_json::to_string(&settings).unwrap();
        let parsed: AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.output_folder, settings.output_folder);
        assert_eq!(parsed.audio_source, settings.audio_source);
        assert_eq!(parsed.transcription_mode, settings.transcription_mode);
    }

    #[test]
    fn settings_deserialize_with_missing_new_fields() {
        // Simulate an old settings file that doesn't have audioSource or transcriptionMode
        let json = serde_json::json!({
            "storageDir": "/tmp/test",
            "outputFolder": "meetings",
            "whisperModel": "base",
            "ollamaBaseUrl": "http://localhost:11434",
            "ollamaModel": "llama3",
            "wikilinkAttendees": true,
            "transcriptMode": "collapsed",
            "language": "en",
            "theme": "light"
        });

        let settings: AppSettings = serde_json::from_value(json).unwrap();
        // New fields should get their defaults via #[serde(default)]
        assert_eq!(settings.audio_source, "mic");
        assert_eq!(settings.transcription_mode, "realtime");
        assert!(settings.connectors.obsidian.is_none());
    }

    #[test]
    fn obsidian_connector_serialization() {
        let connector = ObsidianConnector {
            enabled: true,
            vault_path: "/Users/test/obsidian".to_string(),
            output_folder: "notes".to_string(),
        };

        let json = serde_json::to_string(&connector).unwrap();
        assert!(json.contains("\"enabled\":true"));
        assert!(json.contains("\"vaultPath\""));

        let parsed: ObsidianConnector = serde_json::from_str(&json).unwrap();
        assert!(parsed.enabled);
        assert_eq!(parsed.vault_path, "/Users/test/obsidian");
    }
}
