import { FileText, Lock } from "lucide-react";
import type { NoteMetadata } from "../lib/tauri-commands";

interface MeetingRowProps {
  note: NoteMetadata;
  onClick: (note: NoteMetadata) => void;
}

export function MeetingRow({ note, onClick }: MeetingRowProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(note)}
      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/60 cursor-pointer transition-colors duration-150 w-full text-left"
    >
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{note.title}</p>
        <p className="text-xs text-muted-foreground truncate">Me</p>
      </div>
      <span className="text-xs tabular-nums text-muted-foreground shrink-0">{note.time}</span>
      <Lock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
    </button>
  );
}
