use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
pub enum AppError {
    #[error("Audio error: {0}")]
    Audio(String),
    #[error("Transcription error: {0}")]
    Transcription(String),
    #[error("Summarization error: {0}")]
    Summarization(String),
    #[error("Vault error: {0}")]
    Vault(String),
    #[error("Settings error: {0}")]
    Settings(String),
    #[error("IO error: {0}")]
    Io(String),
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
