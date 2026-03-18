import type { TranscriptMode } from "./vault";

export type WhisperModel = "tiny" | "base" | "small" | "large-v3";

export type AppLanguage = "en" | "de";

export type AppTheme = "system" | "light" | "dark";

export interface ObsidianConnector {
  enabled: boolean;
  vaultPath: string;
  outputFolder: string;
}

export interface Connectors {
  obsidian?: ObsidianConnector;
}

export interface AppSettings {
  storageDir: string;
  outputFolder: string;
  whisperModel: WhisperModel;
  ollamaBaseUrl: string;
  ollamaModel: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  wikilinkAttendees: boolean;
  transcriptMode: TranscriptMode;
  language: AppLanguage;
  theme: AppTheme;
  connectors: Connectors;
}

export const DEFAULT_SETTINGS: AppSettings = {
  storageDir: "",
  outputFolder: "meetings",
  whisperModel: "base",
  ollamaBaseUrl: "http://localhost:11434",
  ollamaModel: "llama3",
  wikilinkAttendees: true,
  transcriptMode: "collapsed",
  language: "en",
  theme: "light",
  connectors: {},
};
