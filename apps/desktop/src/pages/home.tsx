import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../components/empty-state";
import { MeetingList } from "../components/meeting-list";
import { NotePreview } from "../components/note-preview";
import { RecordingCard } from "../components/recording-card";
import type { useMeetingFlow } from "../hooks/use-meeting-flow";
import type { NoteMetadata } from "../hooks/use-notes";

interface HomePageProps {
  notes: NoteMetadata[];
  isLoading: boolean;
  meetingFlow: ReturnType<typeof useMeetingFlow>;
}

export function HomePage({ notes, isLoading, meetingFlow }: HomePageProps) {
  const { t } = useTranslation();
  const { status, duration, error, savedNote, reset } = meetingFlow;
  const [meetingTitle, setMeetingTitle] = useState(t("home.meetingTitle"));

  const isRecording = status === "recording";
  const isProcessing = ["transcribing", "summarizing", "saving"].includes(status);

  return (
    <div className="flex flex-col h-full">
      {/* Page heading */}
      <h1 className="text-2xl font-semibold tracking-tight px-8 pt-8 pb-4">{t("home.title")}</h1>

      {/* Recording / Processing card */}
      {(isRecording || isProcessing) && (
        <RecordingCard
          status={status}
          duration={duration}
          meetingTitle={meetingTitle}
          onTitleChange={setMeetingTitle}
          onStop={() => meetingFlow.stopAndProcess(meetingTitle)}
        />
      )}

      {/* Completed note */}
      {status === "completed" && savedNote && (
        <div className="mx-8 mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              {t("processing.completed")}
            </p>
            <NotePreview note={savedNote} />
            <button
              type="button"
              onClick={() => {
                reset();
                setMeetingTitle(t("home.meetingTitle"));
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("home.startRecording")}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {status === "error" && error && (
        <div className="mx-8 mb-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("home.startRecording")}
          </button>
        </div>
      )}

      {/* Meeting list */}
      <div className="px-8 pb-8 flex flex-col gap-6 flex-1">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {["s1", "s2", "s3", "s4"].map((id) => (
              <div key={id} className="h-12 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : notes.length > 0 ? (
          <MeetingList notes={notes} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}
