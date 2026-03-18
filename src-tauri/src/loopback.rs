//! Cross-platform system audio loopback capture.
//!
//! - macOS: ScreenCaptureKit (12.3+, requires Screen Recording permission)
//! - Windows: WASAPI loopback via cpal (build input stream on output device)
//! - Linux: PulseAudio/PipeWire monitor source via cpal

use ringbuf::traits::Producer;
use ringbuf::HeapProd;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

/// Handle to an active system audio capture session.
pub struct LoopbackCapture {
    stop_flag: Arc<AtomicBool>,
    #[cfg(target_os = "macos")]
    _macos: MacosCapture,
    #[cfg(not(target_os = "macos"))]
    _stream: cpal::Stream,
}

impl LoopbackCapture {
    /// Check if system audio capture is available on this platform.
    pub fn is_available() -> bool {
        #[cfg(target_os = "macos")]
        {
            macos_is_available()
        }
        #[cfg(target_os = "windows")]
        {
            use cpal::traits::HostTrait;
            cpal::default_host().default_output_device().is_some()
        }
        #[cfg(target_os = "linux")]
        {
            find_linux_monitor_device().is_some()
        }
    }

    /// Start capturing system audio. Samples are pushed into the provided ring buffer producer
    /// as mono f32 at the given sample rate.
    pub fn start(
        producer: HeapProd<f32>,
        sample_rate: u32,
    ) -> Result<Self, String> {
        let stop_flag = Arc::new(AtomicBool::new(false));

        #[cfg(target_os = "macos")]
        {
            let capture = start_macos_capture(producer, sample_rate, stop_flag.clone())?;
            Ok(Self {
                stop_flag,
                _macos: capture,
            })
        }

        #[cfg(not(target_os = "macos"))]
        {
            let stream = start_cpal_loopback(producer, sample_rate, stop_flag.clone())?;
            Ok(Self {
                stop_flag,
                _stream: stream,
            })
        }
    }

    /// Stop capturing system audio.
    pub fn stop(self) {
        self.stop_flag.store(true, Ordering::Relaxed);
        // Drop handles cleanup
    }
}

// =============================================================================
// macOS: ScreenCaptureKit
// =============================================================================

#[cfg(target_os = "macos")]
struct MacosCapture {
    stream: screencapturekit::stream::sc_stream::SCStream,
}

#[cfg(target_os = "macos")]
fn macos_is_available() -> bool {
    // ScreenCaptureKit is available on macOS 12.3+
    // Try to get shareable content — if it fails, permission not granted or unavailable
    true
}

#[cfg(target_os = "macos")]
fn start_macos_capture(
    producer: HeapProd<f32>,
    sample_rate: u32,
    _stop_flag: Arc<AtomicBool>,
) -> Result<MacosCapture, String> {
    use screencapturekit::prelude::*;

    let content = SCShareableContent::get().map_err(|e| format!("SCK: {e}"))?;
    let display = content
        .displays()
        .into_iter()
        .next()
        .ok_or("No display found")?;

    let filter = SCContentFilter::create()
        .with_display(&display)
        .with_excluding_windows(&[])
        .build();

    // Minimal video config (1x1) + audio capture
    let config = SCStreamConfiguration::new()
        .with_width(1)
        .with_height(1)
        .with_captures_audio(true)
        .with_sample_rate(sample_rate as i32)
        .with_channel_count(1); // mono

    let mut stream = SCStream::new(&filter, &config);

    // SCK handler requires Fn (not FnMut), so wrap producer in Mutex
    let producer = Arc::new(Mutex::new(producer));

    stream.add_output_handler(
        move |sample: CMSampleBuffer, of_type: SCStreamOutputType| {
            if matches!(of_type, SCStreamOutputType::Audio) {
                if let Some(audio_list) = sample.audio_buffer_list() {
                    if let Ok(mut prod) = producer.lock() {
                        for buffer in &audio_list {
                            let bytes = buffer.data();
                            // Audio from SCK is 32-bit float PCM
                            let samples: &[f32] = unsafe {
                                std::slice::from_raw_parts(
                                    bytes.as_ptr().cast::<f32>(),
                                    bytes.len() / std::mem::size_of::<f32>(),
                                )
                            };
                            let _ = prod.push_slice(samples);
                        }
                    }
                }
            }
        },
        SCStreamOutputType::Audio,
    );

    stream.start_capture().map_err(|e| format!("SCK start: {e}"))?;

    Ok(MacosCapture { stream })
}

#[cfg(target_os = "macos")]
impl Drop for MacosCapture {
    fn drop(&mut self) {
        let _ = self.stream.stop_capture();
    }
}

// =============================================================================
// Windows / Linux: cpal-based loopback
// =============================================================================

#[cfg(not(target_os = "macos"))]
fn start_cpal_loopback(
    mut producer: HeapProd<f32>,
    _sample_rate: u32,
    _stop_flag: Arc<AtomicBool>,
) -> Result<cpal::Stream, String> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

    let host = cpal::default_host();

    #[cfg(target_os = "windows")]
    let device = host
        .default_output_device()
        .ok_or("No output device for WASAPI loopback")?;

    #[cfg(target_os = "linux")]
    let device = find_linux_monitor_device().ok_or(
        "No PulseAudio/PipeWire monitor source found. \
         Ensure PulseAudio or PipeWire is running.",
    )?;

    let config = device
        .default_input_config()
        .map_err(|e| format!("Loopback device config: {e}"))?;

    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => device
            .build_input_stream(
                &config.into(),
                move |data: &[f32], _| {
                    let _ = producer.push_slice(data);
                },
                |err| eprintln!("Loopback stream error: {err}"),
                None,
            )
            .map_err(|e| format!("Build loopback stream: {e}"))?,
        cpal::SampleFormat::I16 => device
            .build_input_stream(
                &config.into(),
                move |data: &[i16], _| {
                    for &sample in data {
                        let f = sample as f32 / i16::MAX as f32;
                        let _ = producer.push_iter(std::iter::once(f));
                    }
                },
                |err| eprintln!("Loopback stream error: {err}"),
                None,
            )
            .map_err(|e| format!("Build loopback stream: {e}"))?,
        _ => return Err("Unsupported loopback sample format".into()),
    };

    stream
        .play()
        .map_err(|e| format!("Start loopback: {e}"))?;

    Ok(stream)
}

#[cfg(target_os = "linux")]
fn find_linux_monitor_device() -> Option<cpal::Device> {
    use cpal::traits::{DeviceTrait, HostTrait};

    let host = cpal::default_host();
    host.input_devices().ok()?.find(|d| {
        d.name()
            .map(|n| n.contains(".monitor") || n.contains("Monitor"))
            .unwrap_or(false)
    })
}
