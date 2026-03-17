import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RecordButton } from "../components/record-button";
import { RecordingTimer } from "../components/recording-timer";
import { ProcessingStatus } from "../components/processing-status";
import { NotePreview } from "../components/note-preview";
import { useMeetingFlow } from "../hooks/use-meeting-flow";
import { Button } from "@minuta/ui";

export function HomePage() {
  const { t } = useTranslation();
  const { status, duration, error, savedNote, startRecording, stopAndProcess, reset } =
    useMeetingFlow();
  const [meetingTitle, setMeetingTitle] = useState("Meeting");

  const isProcessing = ["transcribing", "summarizing", "saving"].includes(status);
  const isRecording = status === "recording";

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-12">
      {/* Title input when idle */}
      {status === "idle" && (
        <input
          value={meetingTitle}
          onChange={(e) => setMeetingTitle(e.target.value)}
          className="w-64 text-center text-lg font-medium bg-transparent border-b border-border focus:outline-none focus:border-primary pb-1"
          placeholder="Meeting title..."
        />
      )}

      {/* Recording timer */}
      {isRecording && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground animate-pulse">
            {t("home.recording")}
          </p>
          <RecordingTimer duration={duration} />
        </div>
      )}

      {/* Record button */}
      {(status === "idle" || isRecording) && (
        <RecordButton
          status={status}
          onStart={startRecording}
          onStop={() => stopAndProcess(meetingTitle)}
        />
      )}

      {/* Processing steps */}
      {isProcessing && <ProcessingStatus status={status} />}

      {/* Completed note */}
      {status === "completed" && savedNote && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-green-600 dark:text-green-400 font-medium">
            {t("processing.completed")}
          </p>
          <NotePreview note={savedNote} />
          <Button variant="outline" onClick={() => { reset(); setMeetingTitle("Meeting"); }}>
            {t("home.startRecording")} {t("nav.home").toLowerCase()}
          </Button>
        </div>
      )}

      {/* Error */}
      {status === "error" && error && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
