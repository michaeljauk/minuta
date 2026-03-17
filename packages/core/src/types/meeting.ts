export interface MeetingNote {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  attendees: string[];
  meetingType: string;
  tags: string[];
  source: "minuta";
  language: string;
  summary: string;
  keyDecisions: string[];
  actionItems: ActionItem[];
  transcript: string;
  filePath: string;
}

export interface ActionItem {
  text: string;
  owner?: string;
  completed: boolean;
}

export type MeetingStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "summarizing"
  | "saving"
  | "completed"
  | "error";

export interface MeetingConfig {
  title?: string;
  meetingType: string;
  attendees: string[];
}

export interface RecordingState {
  status: MeetingStatus;
  duration: number;
  error?: string;
}
