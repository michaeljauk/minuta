use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::error::{AppError, Result};

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveNoteRequest {
    pub vault_path: String,
    pub output_folder: String,
    pub title: String,
    pub summary: String,
    pub transcript: String,
    pub language: String,
    pub duration_minutes: u32,
    pub wikilink_attendees: bool,
    pub transcript_mode: String,
}

#[derive(Debug, Serialize)]
pub struct SaveNoteResult {
    pub file_path: String,
    pub vault_name: String,
    pub relative_path: String,
}

#[tauri::command]
pub fn save_note(request: SaveNoteRequest) -> Result<SaveNoteResult> {
    let now = Local::now();
    let date_str = now.format("%Y-%m-%d").to_string();
    let time_str = now.format("%H:%M").to_string();
    let filename_time = now.format("%H-%M").to_string();

    let safe_title = sanitize_filename(&request.title);
    let filename = format!("{date_str}_{filename_time}_{safe_title}.md");

    let vault_path = PathBuf::from(&request.vault_path);
    let output_dir = vault_path.join(&request.output_folder);
    fs::create_dir_all(&output_dir).map_err(|e| AppError::Vault(e.to_string()))?;

    let file_path = output_dir.join(&filename);
    let relative_path = format!("{}/{}", request.output_folder, filename);

    let content = build_note_content(
        &request,
        &date_str,
        &time_str,
    );

    fs::write(&file_path, content).map_err(|e| AppError::Vault(e.to_string()))?;

    let vault_name = vault_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "vault".to_string());

    Ok(SaveNoteResult {
        file_path: file_path.to_string_lossy().to_string(),
        vault_name,
        relative_path,
    })
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
        "always" => format!(
            "\n# Transcript\n\n{}\n",
            req.transcript
        ),
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
