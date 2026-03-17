import { useCallback, useState } from "react";

export interface NoteMetadata {
  title: string;
  date: string;
  time: string;
  duration_minutes: number;
  file_path: string;
  relative_path: string;
  vault_name: string;
}

// TODO: replace with real Tauri command `invoke("list_notes")`
const MOCK_NOTES: NoteMetadata[] = [
  {
    title: "Daily Standup",
    date: "2026-03-17",
    time: "13:30",
    duration_minutes: 15,
    file_path: "",
    relative_path: "",
    vault_name: "",
  },
  {
    title: "Refinement Meeting",
    date: "2026-03-17",
    time: "12:17",
    duration_minutes: 45,
    file_path: "",
    relative_path: "",
    vault_name: "",
  },
  {
    title: "Product Review",
    date: "2026-03-14",
    time: "10:00",
    duration_minutes: 60,
    file_path: "",
    relative_path: "",
    vault_name: "",
  },
];

export function useNotes() {
  const [notes] = useState<NoteMetadata[]>(MOCK_NOTES);
  const [isLoading] = useState(false);

  const addNote = useCallback(
    (note: NoteMetadata) => {
      // TODO: refresh from real Tauri command when implemented
      notes.unshift(note);
    },
    [notes],
  );

  return { notes, isLoading, addNote };
}
