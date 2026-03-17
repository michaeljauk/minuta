use std::sync::Mutex;

#[derive(Debug, Default)]
pub struct RecordingState {
    pub is_recording: bool,
    pub audio_path: Option<String>,
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
