import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "@minuta/core";

export interface TranscriptionResult {
  text: string;
  language: string;
}

export interface SaveNoteRequest {
  vault_path: string;
  output_folder: string;
  title: string;
  summary: string;
  transcript: string;
  language: string;
  duration_minutes: number;
  wikilink_attendees: boolean;
  transcript_mode: string;
}

export interface SaveNoteResult {
  file_path: string;
  vault_name: string;
  relative_path: string;
}

export const tauriCommands = {
  startRecording: (): Promise<string> => invoke("start_recording"),

  stopRecording: (): Promise<string> => invoke("stop_recording"),

  transcribeAudio: (audioPath: string, model: string): Promise<TranscriptionResult> =>
    invoke("transcribe_audio", { audioPath, model }),

  summarizeTranscript: (
    transcript: string,
    language: string,
    ollamaUrl: string,
    ollamaModel: string
  ): Promise<string> =>
    invoke("summarize_transcript", { transcript, language, ollamaUrl, ollamaModel }),

  saveNote: (request: SaveNoteRequest): Promise<SaveNoteResult> =>
    invoke("save_note", { request }),

  loadSettings: (): Promise<AppSettings> => invoke("load_settings"),

  saveSettings: (settings: AppSettings): Promise<void> =>
    invoke("save_settings", { settings }),
};
