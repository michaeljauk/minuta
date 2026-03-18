use ringbuf::traits::Consumer;
use ringbuf::HeapCons;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::thread::JoinHandle;
use tauri::{AppHandle, Emitter, Manager};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::error::{AppError, Result};

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

#[derive(serde::Serialize, Clone)]
pub struct TranscriptionResult {
    pub text: String,
    pub language: String,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct TranscriptSegment {
    pub text: String,
    pub start_ms: u64,
    pub end_ms: u64,
    pub is_partial: bool,
}

// ---------------------------------------------------------------------------
// Batch transcription (existing)
// ---------------------------------------------------------------------------

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

pub fn get_model_path(app: &AppHandle, model: &str) -> Result<PathBuf> {
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

    let num_segments = state
        .full_n_segments()
        .map_err(|e| AppError::Transcription(e.to_string()))?;

    let mut text = String::new();
    for i in 0..num_segments {
        let segment = state
            .full_get_segment_text(i)
            .map_err(|e| AppError::Transcription(e.to_string()))?;
        text.push_str(&segment);
        text.push(' ');
    }

    let language = state
        .full_lang_id_from_state()
        .map(|id| whisper_rs::get_lang_str(id).unwrap_or("en").to_string())
        .unwrap_or_else(|_| "en".to_string());

    Ok(TranscriptionResult {
        text: text.trim().to_string(),
        language,
    })
}

// ---------------------------------------------------------------------------
// Streaming transcription (sliding window, runs during recording)
// ---------------------------------------------------------------------------

/// Sliding window configuration for real-time transcription.
const STEP_SAMPLES_16K: usize = 16_000 * 3; // process every 3s of new audio
const WINDOW_SAMPLES_16K: usize = 16_000 * 10; // feed last 10s to whisper
const MIN_AUDIO_SAMPLES_16K: usize = 16_000; // need at least 1s before first run

pub struct StreamingTranscriber {
    stop_flag: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
    result_rx: mpsc::Receiver<TranscriptionResult>,
}

impl StreamingTranscriber {
    /// Start streaming transcription. Reads mixed audio from `consumer` at `input_sample_rate`,
    /// resamples to 16kHz, and runs whisper in a sliding window. Emits `transcript-segment`
    /// Tauri events for each partial/finalized segment.
    pub fn start(
        consumer: HeapCons<f32>,
        input_sample_rate: u32,
        model_path: PathBuf,
        app: AppHandle,
    ) -> std::result::Result<Self, String> {
        if !model_path.exists() {
            return Err(format!(
                "Whisper model not found: {}",
                model_path.display()
            ));
        }

        let stop_flag = Arc::new(AtomicBool::new(false));
        let stop_clone = stop_flag.clone();
        let (result_tx, result_rx) = mpsc::channel();

        let thread = std::thread::Builder::new()
            .name("streaming-transcriber".into())
            .spawn(move || {
                let result = streaming_loop(consumer, input_sample_rate, &model_path, &app, stop_clone);
                let _ = result_tx.send(result);
            })
            .map_err(|e| format!("Spawn transcriber: {e}"))?;

        Ok(Self {
            stop_flag,
            thread: Some(thread),
            result_rx,
        })
    }

    /// Signal the transcriber to stop and return the final assembled transcript.
    pub fn stop(mut self) -> TranscriptionResult {
        self.stop_flag.store(true, Ordering::Relaxed);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
        self.result_rx
            .recv()
            .unwrap_or(TranscriptionResult {
                text: String::new(),
                language: "en".to_string(),
            })
    }
}

impl Drop for StreamingTranscriber {
    fn drop(&mut self) {
        self.stop_flag.store(true, Ordering::Relaxed);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

fn streaming_loop(
    mut consumer: HeapCons<f32>,
    input_sample_rate: u32,
    model_path: &PathBuf,
    app: &AppHandle,
    stop_flag: Arc<AtomicBool>,
) -> TranscriptionResult {
    // Load whisper model once
    let ctx = match WhisperContext::new_with_params(
        &model_path.to_string_lossy(),
        WhisperContextParameters::default(),
    ) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Streaming transcriber: failed to load model: {e}");
            return TranscriptionResult {
                text: String::new(),
                language: "en".to_string(),
            };
        }
    };

    let mut state = match ctx.create_state() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Streaming transcriber: failed to create state: {e}");
            return TranscriptionResult {
                text: String::new(),
                language: "en".to_string(),
            };
        }
    };

    // Accumulate all audio at 16kHz for the sliding window
    let mut audio_16k: Vec<f32> = Vec::new();
    let mut read_buf = vec![0.0f32; input_sample_rate as usize]; // ~1s buffer at input rate
    let mut last_processed_len: usize = 0;
    let mut all_segments: Vec<TranscriptSegment> = Vec::new();
    let mut detected_language = "en".to_string();

    let resample_ratio = 16_000.0 / input_sample_rate as f64;

    loop {
        // Read available samples from ring buffer
        let count = consumer.pop_slice(&mut read_buf);
        if count > 0 {
            // Resample to 16kHz and append
            let resampled = resample_chunk(&read_buf[..count], resample_ratio);
            audio_16k.extend_from_slice(&resampled);
        }

        let new_samples = audio_16k.len() - last_processed_len;

        // Check if we should run whisper (enough new audio accumulated)
        let should_process = new_samples >= STEP_SAMPLES_16K
            && audio_16k.len() >= MIN_AUDIO_SAMPLES_16K;
        let is_stopping = stop_flag.load(Ordering::Relaxed);

        if should_process || (is_stopping && audio_16k.len() > last_processed_len && audio_16k.len() >= MIN_AUDIO_SAMPLES_16K) {
            // Take the sliding window: last WINDOW_SAMPLES_16K samples
            let window_start = audio_16k.len().saturating_sub(WINDOW_SAMPLES_16K);
            let window = &audio_16k[window_start..];

            let elapsed_ms = (audio_16k.len() as f64 / 16.0) as u64;

            if let Some(segment) = run_sliding_window(&mut state, window, elapsed_ms, is_stopping) {
                // Detect language on first successful run
                if let Ok(lang_id) = state.full_lang_id_from_state() {
                    if let Some(lang) = whisper_rs::get_lang_str(lang_id) {
                        detected_language = lang.to_string();
                    }
                }

                let _ = app.emit("transcript-segment", &segment);
                all_segments.push(segment);
            }

            last_processed_len = audio_16k.len();
        }

        if is_stopping {
            break;
        }

        if count == 0 {
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
    }

    // Assemble final transcript: use finalized segments, plus the last segment
    // (which is always the most complete even if partial).
    let final_text = if let Some(last) = all_segments.last() {
        // If last segment is finalized, just use all finalized segments
        // If last is partial, use all finalized + the last partial (most complete)
        let mut parts: Vec<&str> = all_segments
            .iter()
            .filter(|s| !s.is_partial)
            .map(|s| s.text.as_str())
            .collect();
        if last.is_partial {
            parts.push(&last.text);
        }
        parts.join(" ")
    } else {
        String::new()
    };

    TranscriptionResult {
        text: final_text.trim().to_string(),
        language: detected_language,
    }
}

fn run_sliding_window(
    state: &mut whisper_rs::WhisperState,
    window: &[f32],
    elapsed_ms: u64,
    is_final: bool,
) -> Option<TranscriptSegment> {
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_single_segment(false);
    params.set_no_context(true); // Each window is independent

    if state.full(params, window).is_err() {
        return None;
    }

    let n = state.full_n_segments().ok()?;
    if n == 0 {
        return None;
    }

    let mut text = String::new();
    for i in 0..n {
        if let Ok(seg) = state.full_get_segment_text(i) {
            text.push_str(&seg);
            text.push(' ');
        }
    }

    let trimmed = text.trim().to_string();
    if trimmed.is_empty() {
        return None;
    }

    let window_duration_ms = (window.len() as f64 / 16.0) as u64;
    let start_ms = elapsed_ms.saturating_sub(window_duration_ms);

    Some(TranscriptSegment {
        text: trimmed,
        start_ms,
        end_ms: elapsed_ms,
        is_partial: !is_final,
    })
}

/// Simple linear interpolation resampling for a chunk of audio.
pub fn resample_chunk(input: &[f32], ratio: f64) -> Vec<f32> {
    if (ratio - 1.0).abs() < 0.001 {
        return input.to_vec();
    }
    let new_len = (input.len() as f64 * ratio) as usize;
    if new_len == 0 {
        return Vec::new();
    }
    (0..new_len)
        .map(|i| {
            let src = i as f64 / ratio;
            let idx = src as usize;
            let frac = (src - idx as f64) as f32;
            let a = input[idx.min(input.len() - 1)];
            let b = input[(idx + 1).min(input.len() - 1)];
            a + frac * (b - a)
        })
        .collect()
}

// ---------------------------------------------------------------------------
// WAV loading (used by batch mode)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resample_identity_ratio() {
        let input = vec![0.0, 0.5, 1.0, -1.0];
        let result = resample_chunk(&input, 1.0);
        assert_eq!(result, input);
    }

    #[test]
    fn resample_downsample_half() {
        // 48kHz → 16kHz is ratio 0.333, but let's test 2:1 for simplicity
        let input: Vec<f32> = (0..100).map(|i| i as f32 / 100.0).collect();
        let result = resample_chunk(&input, 0.5);
        assert_eq!(result.len(), 50);
        // First sample should be close to input[0]
        assert!((result[0] - input[0]).abs() < 0.01);
    }

    #[test]
    fn resample_upsample_double() {
        let input = vec![0.0, 1.0];
        let result = resample_chunk(&input, 2.0);
        assert_eq!(result.len(), 4);
        // Interpolated values between 0.0 and 1.0
        assert!((result[0] - 0.0).abs() < 0.01);
        assert!((result[1] - 0.5).abs() < 0.01);
        assert!((result[2] - 1.0).abs() < 0.01);
    }

    #[test]
    fn resample_empty_input() {
        let result = resample_chunk(&[], 2.0);
        assert!(result.is_empty());
    }

    #[test]
    fn resample_48k_to_16k() {
        // Simulate 1 second of 48kHz audio
        let input: Vec<f32> = (0..48_000).map(|i| (i as f32 * 0.001).sin()).collect();
        let ratio = 16_000.0 / 48_000.0;
        let result = resample_chunk(&input, ratio);
        // Should produce ~16000 samples
        assert!((result.len() as i32 - 16_000).abs() < 2);
    }

    #[test]
    fn transcript_segment_serializes() {
        let seg = TranscriptSegment {
            text: "Hello world".to_string(),
            start_ms: 0,
            end_ms: 3000,
            is_partial: true,
        };
        let json = serde_json::to_string(&seg).unwrap();
        assert!(json.contains("\"is_partial\":true"));
        assert!(json.contains("Hello world"));
    }
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

    let mono = if spec.channels > 1 {
        samples
            .chunks(spec.channels as usize)
            .map(|ch| ch.iter().sum::<f32>() / ch.len() as f32)
            .collect()
    } else {
        samples
    };

    if spec.sample_rate != 16000 {
        let ratio = 16000.0 / spec.sample_rate as f64;
        Ok(resample_chunk(&mono, ratio))
    } else {
        Ok(mono)
    }
}
