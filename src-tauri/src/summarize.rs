use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, Result};

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
}

#[derive(Deserialize)]
struct OllamaResponse {
    response: String,
}

#[tauri::command]
pub async fn summarize_transcript(
    transcript: String,
    language: String,
    ollama_url: String,
    ollama_model: String,
) -> Result<String> {
    let prompt = build_prompt(&transcript, &language);

    let client = Client::new();
    let request = OllamaRequest {
        model: ollama_model,
        prompt,
        stream: false,
    };

    let response = client
        .post(format!("{}/api/generate", ollama_url.trim_end_matches('/')))
        .json(&request)
        .send()
        .await
        .map_err(|e| AppError::Summarization(format!("Failed to connect to Ollama: {e}")))?;

    if !response.status().is_success() {
        return Err(AppError::Summarization(format!(
            "Ollama returned error: {}",
            response.status()
        )));
    }

    let data: OllamaResponse = response
        .json()
        .await
        .map_err(|e| AppError::Summarization(e.to_string()))?;

    Ok(data.response)
}

fn build_prompt(transcript: &str, language: &str) -> String {
    format!(
        r#"You are a professional meeting notes assistant. Based on the following transcript, generate structured meeting notes.

Respond in {language} (same language as the transcript).

Output EXACTLY in this format with these exact section headers:

## Summary
[2-4 sentence paragraph summarizing the meeting]

## Key Decisions
[Bullet list of decisions made. Write "None identified." if none.]

## Action Items
[Checkbox list in format "- [ ] Action item (Owner if mentioned)". Write "None identified." if none.]

---

TRANSCRIPT:
{transcript}"#
    )
}
