use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::error::{AppError, Result};
use crate::settings::{Connectors, ObsidianConnector};

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NoteMetadata {
    pub title: String,
    pub date: String,
    pub time: String,
    pub duration_minutes: u32,
    pub file_path: String,
    pub relative_path: String,
    pub storage_name: String,
}

#[tauri::command]
pub fn list_notes(storage_dir: String, output_folder: String) -> Result<Vec<NoteMetadata>> {
    let storage = PathBuf::from(&storage_dir);
    let output_dir = storage.join(&output_folder);

    if !output_dir.exists() {
        return Ok(Vec::new());
    }

    let storage_name = storage
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Minuta".to_string());

    let mut notes: Vec<NoteMetadata> = Vec::new();

    let entries = fs::read_dir(&output_dir).map_err(|e| AppError::Vault(e.to_string()))?;
    for entry in entries {
        let entry = entry.map_err(|e| AppError::Vault(e.to_string()))?;
        let path = entry.path();
        if path.extension().is_some_and(|ext| ext == "md") {
            if let Some(meta) = parse_note_frontmatter(&path, &output_folder, &storage_name) {
                notes.push(meta);
            }
        }
    }

    // Sort by date desc, then time desc
    notes.sort_by(|a, b| b.date.cmp(&a.date).then_with(|| b.time.cmp(&a.time)));

    Ok(notes)
}

#[tauri::command]
pub fn read_note(file_path: String) -> Result<String> {
    fs::read_to_string(&file_path).map_err(|e| AppError::Vault(e.to_string()))
}

#[tauri::command]
pub fn delete_note(file_path: String) -> Result<()> {
    fs::remove_file(&file_path).map_err(|e| AppError::Vault(e.to_string()))
}

fn parse_note_frontmatter(
    path: &PathBuf,
    output_folder: &str,
    storage_name: &str,
) -> Option<NoteMetadata> {
    let content = fs::read_to_string(path).ok()?;

    // Check for YAML frontmatter
    if !content.starts_with("---") {
        return None;
    }

    let end = content[3..].find("---")?;
    let frontmatter = &content[3..3 + end];

    let mut title = String::new();
    let mut date = String::new();
    let mut time = String::new();
    let mut duration_minutes: u32 = 0;

    for line in frontmatter.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("title:") {
            title = val.trim().trim_matches('"').to_string();
        } else if let Some(val) = line.strip_prefix("date:") {
            date = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("time:") {
            time = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("duration:") {
            duration_minutes = val.trim().parse().unwrap_or(0);
        }
    }

    if title.is_empty() && date.is_empty() {
        return None;
    }

    let filename = path.file_name()?.to_string_lossy().to_string();
    let relative_path = format!("{}/{}", output_folder, filename);
    let file_path = path.to_string_lossy().to_string();

    Some(NoteMetadata {
        title,
        date,
        time,
        duration_minutes,
        file_path,
        relative_path,
        storage_name: storage_name.to_string(),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveNoteRequest {
    pub storage_dir: String,
    pub output_folder: String,
    pub title: String,
    pub summary: String,
    pub transcript: String,
    pub language: String,
    pub duration_minutes: u32,
    pub wikilink_attendees: bool,
    pub transcript_mode: String,
    pub connectors: Connectors,
}

#[derive(Debug, Serialize)]
pub struct SaveNoteResult {
    pub file_path: String,
    pub storage_name: String,
    pub relative_path: String,
    pub connector_warnings: Vec<String>,
}

#[tauri::command]
pub fn save_note(request: SaveNoteRequest) -> Result<SaveNoteResult> {
    let now = Local::now();
    let date_str = now.format("%Y-%m-%d").to_string();
    let time_str = now.format("%H:%M").to_string();
    let filename_time = now.format("%H-%M").to_string();

    let safe_title = sanitize_filename(&request.title);
    let filename = format!("{date_str}_{filename_time}_{safe_title}.md");

    let storage_path = PathBuf::from(&request.storage_dir);
    let output_dir = storage_path.join(&request.output_folder);
    fs::create_dir_all(&output_dir).map_err(|e| AppError::Vault(e.to_string()))?;

    let file_path = output_dir.join(&filename);
    let relative_path = format!("{}/{}", request.output_folder, filename);

    let content = build_note_content(&request, &date_str, &time_str);

    fs::write(&file_path, &content).map_err(|e| AppError::Vault(e.to_string()))?;

    let storage_name = storage_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Minuta".to_string());

    // Sync to connectors — never fail the command
    let mut connector_warnings: Vec<String> = Vec::new();

    if let Some(ref obsidian) = request.connectors.obsidian {
        if obsidian.enabled {
            if let Err(warning) = sync_obsidian(&file_path, &filename, obsidian) {
                connector_warnings.push(warning);
            }
        }
    }

    Ok(SaveNoteResult {
        file_path: file_path.to_string_lossy().to_string(),
        storage_name,
        relative_path,
        connector_warnings,
    })
}

fn sync_obsidian(
    source_path: &PathBuf,
    filename: &str,
    connector: &ObsidianConnector,
) -> std::result::Result<(), String> {
    let vault_path = PathBuf::from(&connector.vault_path);
    let output_dir = vault_path.join(&connector.output_folder);

    fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Obsidian: failed to create output directory: {e}"))?;

    let dest = output_dir.join(filename);
    fs::copy(source_path, &dest)
        .map_err(|e| format!("Obsidian: failed to copy note: {e}"))?;

    Ok(())
}

fn build_note_content(req: &SaveNoteRequest, date: &str, time: &str) -> String {
    let frontmatter = format!(
        r#"---
title: "{title}"
date: {date}
time: {time}
duration: {duration}
attendees: []
meeting-type: call
tags: [meeting]
source: minuta
language: {language}
---"#,
        title = req.title.replace('"', r#"\""#),
        date = date,
        time = time,
        duration = req.duration_minutes,
        language = req.language,
    );

    // Parse AI summary into sections
    let (summary, key_decisions, action_items) = parse_ai_output(&req.summary);

    let transcript_section = match req.transcript_mode.as_str() {
        "never" => String::new(),
        "always" => format!("\n# Transcript\n\n{}\n", req.transcript),
        _ => format!(
            "\n# Transcript\n\n<details>\n<summary>Full transcript</summary>\n\n{}\n</details>\n",
            req.transcript
        ),
    };

    format!(
        "{frontmatter}\n\n# Summary\n\n{summary}\n\n# Key Decisions\n\n{key_decisions}\n\n# Action Items\n\n{action_items}{transcript_section}"
    )
}

fn parse_ai_output(output: &str) -> (String, String, String) {
    let mut summary = String::new();
    let mut key_decisions = String::new();
    let mut action_items = String::new();

    let mut current_section = "";

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed == "## Summary" {
            current_section = "summary";
        } else if trimmed == "## Key Decisions" {
            current_section = "decisions";
        } else if trimmed == "## Action Items" {
            current_section = "actions";
        } else if trimmed == "---" {
            current_section = "";
        } else {
            match current_section {
                "summary" => {
                    if !trimmed.is_empty() || !summary.is_empty() {
                        summary.push_str(line);
                        summary.push('\n');
                    }
                }
                "decisions" => {
                    if !trimmed.is_empty() || !key_decisions.is_empty() {
                        key_decisions.push_str(line);
                        key_decisions.push('\n');
                    }
                }
                "actions" => {
                    if !trimmed.is_empty() || !action_items.is_empty() {
                        action_items.push_str(line);
                        action_items.push('\n');
                    }
                }
                _ => {}
            }
        }
    }

    let summary = summary.trim().to_string();
    let key_decisions = if key_decisions.trim().is_empty() {
        "None identified.".to_string()
    } else {
        key_decisions.trim().to_string()
    };
    let action_items = if action_items.trim().is_empty() {
        "None identified.".to_string()
    } else {
        action_items.trim().to_string()
    };

    (summary, key_decisions, action_items)
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c => c,
        })
        .take(50)
        .collect::<String>()
        .trim()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- sanitize_filename ---

    #[test]
    fn sanitize_filename_replaces_forbidden_characters() {
        assert_eq!(
            sanitize_filename("a/b\\c:d*e?f\"g<h>i|j"),
            "a_b_c_d_e_f_g_h_i_j"
        );
    }

    #[test]
    fn sanitize_filename_leaves_safe_characters_unchanged() {
        assert_eq!(sanitize_filename("Q4 Review – final"), "Q4 Review – final");
    }

    #[test]
    fn sanitize_filename_truncates_to_50_characters() {
        let long = "a".repeat(60);
        let result = sanitize_filename(&long);
        assert_eq!(result.len(), 50);
    }

    #[test]
    fn sanitize_filename_trims_trailing_whitespace() {
        assert_eq!(sanitize_filename("hello   "), "hello");
    }

    // --- parse_ai_output ---

    #[test]
    fn parse_ai_output_extracts_all_three_sections() {
        let input = "## Summary\nGreat meeting.\n## Key Decisions\n- Ship v2\n## Action Items\n- [ ] Write tests (Alice)\n---";
        let (summary, decisions, actions) = parse_ai_output(input);
        assert_eq!(summary, "Great meeting.");
        assert_eq!(decisions, "- Ship v2");
        assert_eq!(actions, "- [ ] Write tests (Alice)");
    }

    #[test]
    fn parse_ai_output_returns_none_identified_for_empty_sections() {
        let input = "## Summary\nBrief update.\n## Key Decisions\n## Action Items\n---";
        let (summary, decisions, actions) = parse_ai_output(input);
        assert_eq!(summary, "Brief update.");
        assert_eq!(decisions, "None identified.");
        assert_eq!(actions, "None identified.");
    }

    #[test]
    fn parse_ai_output_ignores_content_outside_sections() {
        let input = "Preamble text\n## Summary\nActual summary.\n## Key Decisions\n- Decision one\n## Action Items\n- [ ] Do thing\n---\nTrailing noise";
        let (summary, decisions, _) = parse_ai_output(input);
        assert_eq!(summary, "Actual summary.");
        assert_eq!(decisions, "- Decision one");
    }

    #[test]
    fn parse_ai_output_handles_empty_input() {
        let (summary, decisions, actions) = parse_ai_output("");
        assert!(summary.is_empty());
        assert_eq!(decisions, "None identified.");
        assert_eq!(actions, "None identified.");
    }
}
