export interface VaultConfig {
  vaultPath: string;
  outputFolder: string;
  filenameFormat: string;
}

export interface OutputSettings {
  wikilinkAttendees: boolean;
  transcriptMode: TranscriptMode;
}

export type TranscriptMode = "always" | "never" | "collapsed";
