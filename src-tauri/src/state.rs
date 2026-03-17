use std::sync::{mpsc, Mutex};

#[derive(Default)]
pub struct RecordingState {
    pub is_recording: bool,
    pub audio_path: Option<String>,
    pub done_rx: Option<mpsc::Receiver<()>>,
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
