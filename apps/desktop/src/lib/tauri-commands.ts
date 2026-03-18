import type { AppSettings, Connectors } from "@minuta/core";
import { invoke } from "@tauri-apps/api/core";

export interface TranscriptionResult {
  text: string;
  language: string;
}

export interface SaveNoteRequest {
  storage_dir: string;
  output_folder: string;
  title: string;
  summary: string;
  transcript: string;
  language: string;
  duration_minutes: number;
  wikilink_attendees: boolean;
  transcript_mode: string;
  connectors: Connectors;
}

export interface SaveNoteResult {
  file_path: string;
  storage_name: string;
  relative_path: string;
  connector_warnings: string[];
}

export interface StopRecordingResult {
  audio_path: string;
  transcript: TranscriptionResult | null;
}

export interface TranscriptSegment {
  text: string;
  start_ms: number;
  end_ms: number;
  is_partial: boolean;
}

export interface NoteMetadata {
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  filePath: string;
  relativePath: string;
  storageName: string;
}

export const tauriCommands = {
  startRecording: (
    audioSource?: string,
    transcriptionMode?: string,
    whisperModel?: string,
  ): Promise<string> => invoke("start_recording", { audioSource, transcriptionMode, whisperModel }),

  stopRecording: (): Promise<StopRecordingResult> => invoke("stop_recording"),

  transcribeAudio: (audioPath: string, model: string): Promise<TranscriptionResult> =>
    invoke("transcribe_audio", { audioPath, model }),

  summarizeTranscript: (
    transcript: string,
    language: string,
    ollamaUrl: string,
    ollamaModel: string,
  ): Promise<string> =>
    invoke("summarize_transcript", { transcript, language, ollamaUrl, ollamaModel }),

  saveNote: (request: SaveNoteRequest): Promise<SaveNoteResult> => invoke("save_note", { request }),

  listNotes: (storageDir: string, outputFolder: string): Promise<NoteMetadata[]> =>
    invoke("list_notes", { storageDir, outputFolder }),

  readNote: (filePath: string): Promise<string> => invoke("read_note", { filePath }),

  deleteNote: (filePath: string): Promise<void> => invoke("delete_note", { filePath }),

  loadSettings: (): Promise<AppSettings> => invoke("load_settings"),

  saveSettings: (settings: AppSettings): Promise<void> => invoke("save_settings", { settings }),
};
