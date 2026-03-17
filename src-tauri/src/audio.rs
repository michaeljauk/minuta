use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use hound::{WavSpec, WavWriter};
use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use tauri::AppHandle;

use crate::error::{AppError, Result};
use crate::state::AppState;

#[tauri::command]
pub async fn start_recording(app: AppHandle, state: tauri::State<'_, AppState>) -> Result<String> {
    let mut rec = state.recording.lock().map_err(|e| AppError::Audio(e.to_string()))?;
    if rec.is_recording {
        return Err(AppError::Audio("Already recording".to_string()));
    }

    let data_dir = app.path().app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| AppError::Audio(e.to_string()))?;

    let audio_path = data_dir.join(format!(
        "recording_{}.wav",
        chrono::Local::now().format("%Y%m%d_%H%M%S")
    ));

    let path_str = audio_path.to_string_lossy().to_string();
    rec.audio_path = Some(path_str.clone());
    rec.is_recording = true;

    // Spawn audio capture in background
    let path_clone = path_str.clone();
    std::thread::spawn(move || {
        if let Err(e) = capture_audio(path_clone) {
            eprintln!("Audio capture error: {e}");
        }
    });

    Ok(path_str)
}

#[tauri::command]
pub fn stop_recording(state: tauri::State<'_, AppState>) -> Result<String> {
    let mut rec = state.recording.lock().map_err(|e| AppError::Audio(e.to_string()))?;
    if !rec.is_recording {
        return Err(AppError::Audio("Not recording".to_string()));
    }
    rec.is_recording = false;
    let path = rec.audio_path.clone().unwrap_or_default();
    Ok(path)
}

fn capture_audio(output_path: String) -> std::result::Result<(), Box<dyn std::error::Error>> {
    let host = cpal::default_host();
    let device = host.default_input_device()
        .ok_or("No input device available")?;

    let config = device.default_input_config()?;
    let sample_rate = config.sample_rate().0;
    let channels = config.channels();

    let spec = WavSpec {
        channels,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let writer = Arc::new(Mutex::new(Some(WavWriter::create(&output_path, spec)?)));
    let writer_clone = writer.clone();

    let err_fn = |err| eprintln!("Stream error: {err}");

    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => {
            device.build_input_stream(
                &config.into(),
                move |data: &[f32], _| {
                    if let Ok(mut guard) = writer_clone.lock() {
                        if let Some(w) = guard.as_mut() {
                            for &sample in data {
                                let s = (sample * i16::MAX as f32) as i16;
                                let _ = w.write_sample(s);
                            }
                        }
                    }
                },
                err_fn,
                None,
            )?
        }
        cpal::SampleFormat::I16 => {
            device.build_input_stream(
                &config.into(),
                move |data: &[i16], _| {
                    if let Ok(mut guard) = writer_clone.lock() {
                        if let Some(w) = guard.as_mut() {
                            for &sample in data {
                                let _ = w.write_sample(sample);
                            }
                        }
                    }
                },
                err_fn,
                None,
            )?
        }
        _ => return Err("Unsupported sample format".into()),
    };

    stream.play()?;

    // Keep streaming until file is removed or process ends
    loop {
        std::thread::sleep(std::time::Duration::from_millis(100));
        if !std::path::Path::new(&output_path).exists() {
            break;
        }
        // Check if recording has a sentinel stop file
        let stop_file = format!("{output_path}.stop");
        if std::path::Path::new(&stop_file).exists() {
            let _ = std::fs::remove_file(&stop_file);
            break;
        }
    }

    drop(stream);
    if let Ok(mut guard) = writer.lock() {
        if let Some(w) = guard.take() {
            w.finalize()?;
        }
    }

    Ok(())
}
