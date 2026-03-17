import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { NoteMetadata } from "../hooks/use-notes";
import { MeetingRow } from "./meeting-row";

interface MeetingListProps {
  notes: NoteMetadata[];
}

function formatDateHeader(dateStr: string, todayStr: string, t: (key: string) => string): string {
  if (dateStr === todayStr) {
    const date = new Date(dateStr);
    const month = date.toLocaleDateString("en-US", { month: "long" });
    const day = date.getDate();
    return `${t("home.today")} — ${month} ${day}`;
  }
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function MeetingList({ notes }: MeetingListProps) {
  const { t } = useTranslation();

  const grouped = useMemo(() => {
    const groups: Map<string, NoteMetadata[]> = new Map();
    for (const note of notes) {
      const existing = groups.get(note.date);
      if (existing) {
        existing.push(note);
      } else {
        groups.set(note.date, [note]);
      }
    }
    return groups;
  }, [notes]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      {Array.from(grouped.entries()).map(([date, dateNotes]) => (
        <div key={date}>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-4 mb-2">
            {formatDateHeader(date, today, t)}
          </p>
          <div className="flex flex-col">
            {dateNotes.map((note) => (
              <MeetingRow key={`${note.date}-${note.time}-${note.title}`} note={note} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
