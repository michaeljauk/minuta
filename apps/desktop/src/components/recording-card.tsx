import type { MeetingStatus } from "@minuta/core";
import { Button, Input } from "@minuta/ui";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RecordingTimer } from "./recording-timer";

interface RecordingCardProps {
  status: MeetingStatus;
  duration: number;
  meetingTitle: string;
  onTitleChange: (title: string) => void;
  onStop: () => void;
}

export function RecordingCard({
  status,
  duration,
  meetingTitle,
  onTitleChange,
  onStop,
}: RecordingCardProps) {
  const { t } = useTranslation();
  const isRecording = status === "recording";
  const isProcessing = ["transcribing", "summarizing", "saving"].includes(status);

  if (!isRecording && !isProcessing) return null;

  return (
    <div className="mx-8 mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
      {isRecording ? (
        <div className="flex flex-col gap-4">
          {/* Recording header */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-recording opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-recording" />
            </span>
            <span className="text-sm font-medium text-foreground">{t("home.recording")}</span>
            <span className="text-sm tabular-nums text-muted-foreground">
              <RecordingTimer duration={duration} compact />
            </span>
          </div>

          {/* Progress bar animation */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-full animate-pulse rounded-full bg-recording/40" />
          </div>

          {/* Title + Stop */}
          <div className="flex items-center gap-3">
            <Input
              value={meetingTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              className="flex-1 bg-transparent"
              placeholder={t("home.meetingTitle")}
            />
            <Button variant="destructive" size="sm" onClick={onStop} className="shrink-0">
              {t("home.stopRecording")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Processing header */}
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {status === "transcribing" && t("processing.transcribing")}
              {status === "summarizing" && t("processing.summarizing")}
              {status === "saving" && t("processing.saving")}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/60 transition-all duration-500"
              style={{
                width: status === "transcribing" ? "33%" : status === "summarizing" ? "66%" : "90%",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
