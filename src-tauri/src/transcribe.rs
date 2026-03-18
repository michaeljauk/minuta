use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::error::{AppError, Result};

#[derive(serde::Serialize)]
pub struct TranscriptionResult {
    pub text: String,
    pub language: String,
}

#[tauri::command]
pub async fn transcribe_audio(
    app: AppHandle,
    audio_path: String,
    model: String,
) -> Result<TranscriptionResult> {
    let model_path = get_model_path(&app, &model)?;

    if !model_path.exists() {
        return Err(AppError::Transcription(format!(
            "Whisper model not found at: {}. Please download it first.",
            model_path.display()
        )));
    }

    tokio::task::spawn_blocking(move || {
        run_transcription(&audio_path, &model_path.to_string_lossy())
    })
    .await
    .map_err(|e: tokio::task::JoinError| AppError::Transcription(e.to_string()))?
}

fn get_model_path(app: &AppHandle, model: &str) -> Result<PathBuf> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Transcription(e.to_string()))?;
    Ok(data_dir.join("models").join(format!("ggml-{model}.bin")))
}

fn run_transcription(audio_path: &str, model_path: &str) -> Result<TranscriptionResult> {
    let ctx = WhisperContext::new_with_params(model_path, WhisperContextParameters::default())
        .map_err(|e| AppError::Transcription(format!("Failed to load model: {e}")))?;

    let mut state = ctx
        .create_state()
        .map_err(|e| AppError::Transcription(format!("Failed to create state: {e}")))?;

    let audio_data = load_wav_as_f32(audio_path)?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);

    state
        .full(params, &audio_data)
        .map_err(|e| AppError::Transcription(format!("Transcription failed: {e}")))?;

    let num_segments = state.full_n_segments();

    let mut text = String::new();
    for i in 0..num_segments {
        if let Some(segment) = state.get_segment(i) {
            if let Ok(s) = segment.to_str_lossy() {
                text.push_str(&s);
                text.push(' ');
            }
        }
    }

    let language = whisper_rs::get_lang_str(state.full_lang_id_from_state())
        .unwrap_or("en")
        .to_string();

    Ok(TranscriptionResult {
        text: text.trim().to_string(),
        language,
    })
}

fn load_wav_as_f32(path: &str) -> Result<Vec<f32>> {
    let mut reader = hound::WavReader::open(path)
        .map_err(|e| AppError::Transcription(format!("Failed to open WAV: {e}")))?;

    let spec = reader.spec();
    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Int => reader
            .samples::<i16>()
            .map(|s| s.map(|v| v as f32 / i16::MAX as f32))
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(|e| AppError::Transcription(e.to_string()))?,
        hound::SampleFormat::Float => reader
            .samples::<f32>()
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(|e| AppError::Transcription(e.to_string()))?,
    };

    // Convert to mono if needed (Whisper requires mono 16kHz)
    let mono = if spec.channels > 1 {
        samples
            .chunks(spec.channels as usize)
            .map(|ch| ch.iter().sum::<f32>() / ch.len() as f32)
            .collect()
    } else {
        samples
    };

    // Resample to 16kHz if needed
    if spec.sample_rate != 16000 {
        let ratio = 16000.0 / spec.sample_rate as f64;
        let new_len = (mono.len() as f64 * ratio) as usize;
        let resampled: Vec<f32> = (0..new_len)
            .map(|i| {
                let src_idx = (i as f64 / ratio) as usize;
                mono[src_idx.min(mono.len() - 1)]
            })
            .collect();
        Ok(resampled)
    } else {
        Ok(mono)
    }
}
