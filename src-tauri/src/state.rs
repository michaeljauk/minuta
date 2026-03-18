use std::sync::atomic::AtomicBool;
use std::sync::{mpsc, Arc, Mutex};

/// Result sent from the capture thread back to the main thread.
pub struct CaptureThreadResult {
    pub warning: Option<String>,
    /// If streaming transcription was active, the final transcript text.
    pub transcript_text: Option<String>,
    /// Detected language from streaming transcription.
    pub transcript_language: Option<String>,
}

#[derive(Default)]
pub struct RecordingState {
    pub is_recording: bool,
    pub audio_path: Option<String>,
    pub done_rx: Option<mpsc::Receiver<CaptureThreadResult>>,
    pub stop_flag: Option<Arc<AtomicBool>>,
}

pub struct AppState {
    pub recording: Mutex<RecordingState>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            recording: Mutex::new(RecordingState::default()),
        }
    }
}
