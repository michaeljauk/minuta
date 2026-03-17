import type { TranscriptMode } from "./vault";

export type WhisperModel = "tiny" | "base" | "small" | "large-v3";

export type AppLanguage = "en" | "de";

export interface AppSettings {
  vaultPath: string;
  outputFolder: string;
  whisperModel: WhisperModel;
  ollamaBaseUrl: string;
  ollamaModel: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  wikilinkAttendees: boolean;
  transcriptMode: TranscriptMode;
  language: AppLanguage;
}

export const DEFAULT_SETTINGS: AppSettings = {
  vaultPath: "",
  outputFolder: "meetings",
  whisperModel: "base",
  ollamaBaseUrl: "http://localhost:11434",
  ollamaModel: "llama3",
  wikilinkAttendees: true,
  transcriptMode: "collapsed",
  language: "en",
};
