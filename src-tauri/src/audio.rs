use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use ringbuf::traits::{Producer, Split};
use ringbuf::HeapRb;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::time::Duration;
use tauri::{AppHandle, Manager};

use crate::error::{AppError, Result};
use crate::loopback::LoopbackCapture;
use crate::mixer::MixerHandle;
use crate::state::{AppState, CaptureThreadResult};
use crate::transcribe::{StreamingTranscriber, TranscriptionResult};

/// Ring buffer capacity: ~10 seconds at 48kHz mono
const RING_BUF_CAPACITY: usize = 48_000 * 10;

/// Ring buffer for streaming transcriber: ~30 seconds at 48kHz
const TRANSCRIBER_BUF_CAPACITY: usize = 48_000 * 30;

/// Result returned to the frontend when stopping a recording.
#[derive(serde::Serialize, Clone)]
pub struct StopRecordingResult {
    pub audio_path: String,
    /// If streaming transcription was active, contains the full transcript.
    pub transcript: Option<TranscriptionResult>,
}

#[tauri::command]
pub async fn start_recording(
    app: AppHandle,
    audio_source: Option<String>,
    transcription_mode: Option<String>,
    whisper_model: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<String> {
    let mut rec = state
        .recording
        .lock()
        .map_err(|e| AppError::Audio(e.to_string()))?;
    if rec.is_recording {
        return Err(AppError::Audio("Already recording".to_string()));
    }

    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    std::fs::create_dir_all(&data_dir).map_err(|e| AppError::Audio(e.to_string()))?;

    let audio_path = data_dir.join(format!(
        "recording_{}.wav",
        chrono::Local::now().format("%Y%m%d_%H%M%S")
    ));

    let path_str = audio_path.to_string_lossy().to_string();
    rec.audio_path = Some(path_str.clone());
    rec.is_recording = true;

    let source = audio_source.unwrap_or_else(|| "mic".to_string());
    let mode = transcription_mode.unwrap_or_else(|| "batch".to_string());
    let model = whisper_model.unwrap_or_else(|| "base".to_string());

    let path_clone = audio_path.clone();
    let app_clone = app.clone();
    let (done_tx, done_rx) = mpsc::channel::<CaptureThreadResult>();
    rec.done_rx = Some(done_rx);

    let stop_flag = Arc::new(AtomicBool::new(false));
    rec.stop_flag = Some(stop_flag.clone());

    // Resolve model path for streaming transcription
    let model_path = if mode == "realtime" {
        crate::transcribe::get_model_path(&app, &model).ok()
    } else {
        None
    };

    std::thread::Builder::new()
        .name("audio-capture".into())
        .spawn(move || {
            let result = capture_audio(&path_clone, &source, &mode, model_path, &app_clone, stop_flag);
            let thread_result = match result {
                Ok(r) => r,
                Err(e) => {
                    eprintln!("Audio capture error: {e}");
                    CaptureThreadResult {
                        warning: Some(format!("Audio error: {e}")),
                        transcript_text: None,
                        transcript_language: None,
                    }
                }
            };
            let _ = done_tx.send(thread_result);
        })
        .map_err(|e| AppError::Audio(e.to_string()))?;

    Ok(path_str)
}

#[tauri::command]
pub fn stop_recording(state: tauri::State<'_, AppState>) -> Result<StopRecordingResult> {
    let (path, done_rx) = {
        let mut rec = state
            .recording
            .lock()
            .map_err(|e| AppError::Audio(e.to_string()))?;
        if !rec.is_recording {
            return Err(AppError::Audio("Not recording".to_string()));
        }
        rec.is_recording = false;

        if let Some(flag) = &rec.stop_flag {
            flag.store(true, Ordering::Relaxed);
        }

        (
            rec.audio_path.clone().unwrap_or_default(),
            rec.done_rx.take(),
        )
    };

    let mut transcript = None;
    if let Some(rx) = done_rx {
        // Streaming transcriber may need extra time to finalize
        match rx.recv_timeout(Duration::from_secs(30)) {
            Ok(result) => {
                if let Some(warning) = &result.warning {
                    eprintln!("Recording warning: {warning}");
                }
                if let Some(text) = result.transcript_text {
                    transcript = Some(TranscriptionResult {
                        text,
                        language: result.transcript_language.unwrap_or_else(|| "en".to_string()),
                    });
                }
            }
            Err(_) => eprintln!("Timeout waiting for audio capture to finish"),
        }
    }

    Ok(StopRecordingResult {
        audio_path: path,
        transcript,
    })
}

// ---------------------------------------------------------------------------
// Internal capture
// ---------------------------------------------------------------------------

fn capture_audio(
    output_path: &PathBuf,
    source: &str,
    transcription_mode: &str,
    model_path: Option<PathBuf>,
    app: &AppHandle,
    stop_flag: Arc<AtomicBool>,
) -> std::result::Result<CaptureThreadResult, Box<dyn std::error::Error>> {
    let host = cpal::default_host();
    let mic_device = host.default_input_device().ok_or("No input device")?;
    let mic_config = mic_device.default_input_config()?;
    let sample_rate = mic_config.sample_rate().0;

    match source {
        "mic" => capture_mic_only(output_path, &mic_device, &mic_config, transcription_mode, model_path, app, stop_flag),
        "system" => capture_system_only(output_path, sample_rate, transcription_mode, model_path, app, stop_flag),
        "both" => capture_both(output_path, &mic_device, &mic_config, transcription_mode, model_path, app, stop_flag),
        _ => capture_mic_only(output_path, &mic_device, &mic_config, transcription_mode, model_path, app, stop_flag),
    }
}

// ---------------------------------------------------------------------------
// Streaming transcriber setup
// ---------------------------------------------------------------------------

struct TranscriberSetup {
    transcriber: Option<StreamingTranscriber>,
    producer: Option<ringbuf::HeapProd<f32>>,
}

fn setup_transcriber(
    transcription_mode: &str,
    model_path: Option<PathBuf>,
    app: &AppHandle,
    sample_rate: u32,
) -> TranscriberSetup {
    if transcription_mode != "realtime" {
        return TranscriberSetup { transcriber: None, producer: None };
    }

    let model_path = match model_path {
        Some(p) if p.exists() => p,
        _ => {
            eprintln!("Streaming transcription: model not found, falling back to batch");
            return TranscriberSetup { transcriber: None, producer: None };
        }
    };

    let rb = HeapRb::<f32>::new(TRANSCRIBER_BUF_CAPACITY);
    let (prod, cons) = rb.split();

    match StreamingTranscriber::start(cons, sample_rate, model_path, app.clone()) {
        Ok(transcriber) => TranscriberSetup {
            transcriber: Some(transcriber),
            producer: Some(prod),
        },
        Err(e) => {
            eprintln!("Streaming transcription failed to start: {e}");
            TranscriberSetup { transcriber: None, producer: None }
        }
    }
}

fn finish_capture(
    warning: Option<String>,
    transcriber: Option<StreamingTranscriber>,
) -> CaptureThreadResult {
    match transcriber {
        Some(t) => {
            let result = t.stop();
            CaptureThreadResult {
                warning,
                transcript_text: Some(result.text),
                transcript_language: Some(result.language),
            }
        }
        None => CaptureThreadResult {
            warning,
            transcript_text: None,
            transcript_language: None,
        },
    }
}

// ---------------------------------------------------------------------------
// Capture modes
// ---------------------------------------------------------------------------

fn capture_mic_only(
    output_path: &PathBuf,
    device: &cpal::Device,
    config: &cpal::SupportedStreamConfig,
    transcription_mode: &str,
    model_path: Option<PathBuf>,
    app: &AppHandle,
    stop_flag: Arc<AtomicBool>,
) -> std::result::Result<CaptureThreadResult, Box<dyn std::error::Error>> {
    let sample_rate = config.sample_rate().0;
    let rb = HeapRb::<f32>::new(RING_BUF_CAPACITY);
    let (mic_prod, mic_cons) = rb.split();

    let ts = setup_transcriber(transcription_mode, model_path, app, sample_rate);

    let mic_stream = build_mic_stream(device, config, mic_prod)?;
    mic_stream.play()?;

    let mixer = MixerHandle::start_with_transcriber(mic_cons, None, ts.producer, output_path, sample_rate)?;

    while !stop_flag.load(Ordering::Relaxed) {
        std::thread::sleep(Duration::from_millis(100));
    }

    drop(mic_stream);
    mixer.stop();

    Ok(finish_capture(None, ts.transcriber))
}

fn capture_system_only(
    output_path: &PathBuf,
    sample_rate: u32,
    transcription_mode: &str,
    model_path: Option<PathBuf>,
    app: &AppHandle,
    stop_flag: Arc<AtomicBool>,
) -> std::result::Result<CaptureThreadResult, Box<dyn std::error::Error>> {
    if !LoopbackCapture::is_available() {
        return Err("System audio capture is not available on this system".into());
    }

    let rb = HeapRb::<f32>::new(RING_BUF_CAPACITY);
    let (sys_prod, sys_cons) = rb.split();

    let loopback = LoopbackCapture::start(sys_prod, sample_rate)?;

    let mic_rb = HeapRb::<f32>::new(1024);
    let (_mic_prod, mic_cons) = mic_rb.split();

    let ts = setup_transcriber(transcription_mode, model_path, app, sample_rate);

    let mixer = MixerHandle::start_with_transcriber(mic_cons, Some(sys_cons), ts.producer, output_path, sample_rate)?;

    while !stop_flag.load(Ordering::Relaxed) {
        std::thread::sleep(Duration::from_millis(100));
    }

    loopback.stop();
    mixer.stop();

    Ok(finish_capture(None, ts.transcriber))
}

fn capture_both(
    output_path: &PathBuf,
    mic_device: &cpal::Device,
    mic_config: &cpal::SupportedStreamConfig,
    transcription_mode: &str,
    model_path: Option<PathBuf>,
    app: &AppHandle,
    stop_flag: Arc<AtomicBool>,
) -> std::result::Result<CaptureThreadResult, Box<dyn std::error::Error>> {
    let sample_rate = mic_config.sample_rate().0;

    let mic_rb = HeapRb::<f32>::new(RING_BUF_CAPACITY);
    let (mic_prod, mic_cons) = mic_rb.split();

    let sys_rb = HeapRb::<f32>::new(RING_BUF_CAPACITY);
    let (sys_prod, sys_cons) = sys_rb.split();

    let mic_stream = build_mic_stream(mic_device, mic_config, mic_prod)?;
    mic_stream.play()?;

    let loopback = match LoopbackCapture::start(sys_prod, sample_rate) {
        Ok(lb) => Some(lb),
        Err(e) => {
            eprintln!("System audio unavailable, falling back to mic-only: {e}");
            None
        }
    };

    let warning = if loopback.is_none() {
        Some("System audio unavailable — recording mic only".to_string())
    } else {
        None
    };

    let system_cons = if loopback.is_some() { Some(sys_cons) } else { None };

    let ts = setup_transcriber(transcription_mode, model_path, app, sample_rate);

    let mixer = MixerHandle::start_with_transcriber(mic_cons, system_cons, ts.producer, output_path, sample_rate)?;

    while !stop_flag.load(Ordering::Relaxed) {
        std::thread::sleep(Duration::from_millis(100));
    }

    drop(mic_stream);
    if let Some(lb) = loopback {
        lb.stop();
    }
    mixer.stop();

    Ok(finish_capture(warning, ts.transcriber))
}

/// Build a cpal input stream that pushes f32 samples into a ring buffer producer.
fn build_mic_stream(
    device: &cpal::Device,
    config: &cpal::SupportedStreamConfig,
    mut producer: ringbuf::HeapProd<f32>,
) -> std::result::Result<cpal::Stream, Box<dyn std::error::Error>> {
    let err_fn = |err| eprintln!("Mic stream error: {err}");

    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => device.build_input_stream(
            &config.clone().into(),
            move |data: &[f32], _| {
                let _ = producer.push_slice(data);
            },
            err_fn,
            None,
        )?,
        cpal::SampleFormat::I16 => {
            device.build_input_stream(
                &config.clone().into(),
                move |data: &[i16], _| {
                    for &sample in data {
                        let f = sample as f32 / i16::MAX as f32;
                        let _ = producer.push_iter(std::iter::once(f));
                    }
                },
                err_fn,
                None,
            )?
        }
        _ => return Err("Unsupported mic sample format".into()),
    };

    Ok(stream)
}
