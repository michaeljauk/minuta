import type { MeetingStatus } from "@minuta/core";
import { Button, Input } from "@minuta/ui";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { TranscriptSegment } from "../lib/tauri-commands";
import { RecordingTimer } from "./recording-timer";

interface RecordingCardProps {
  status: MeetingStatus;
  duration: number;
  meetingTitle: string;
  audioSource?: string;
  liveSegments?: TranscriptSegment[];
  onTitleChange: (title: string) => void;
  onStop: () => void;
}

export function RecordingCard({
  status,
  duration,
  meetingTitle,
  audioSource,
  liveSegments,
  onTitleChange,
  onStop,
}: RecordingCardProps) {
  const { t } = useTranslation();
  const isRecording = status === "recording";
  const isProcessing = ["transcribing", "summarizing", "saving"].includes(status);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll live transcript to bottom when new segments arrive
  const segmentCount = liveSegments?.length ?? 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on segment count change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segmentCount]);

  if (!isRecording && !isProcessing) return null;

  const hasLiveText = liveSegments && liveSegments.length > 0;

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
            {audioSource && audioSource !== "mic" && (
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {audioSource === "both" ? t("recording.sourceBoth") : t("recording.sourceSystem")}
              </span>
            )}
          </div>

          {/* Progress bar animation */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-full animate-pulse rounded-full bg-recording/40" />
          </div>

          {/* Live transcript */}
          {hasLiveText && (
            <div
              ref={scrollRef}
              className="max-h-32 overflow-y-auto rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground"
            >
              <p className="text-xs font-medium text-muted-foreground/70 mb-1.5">
                {t("recording.liveTranscript")}
              </p>
              {liveSegments.map((seg) => (
                <span
                  key={`${seg.start_ms}-${seg.end_ms}`}
                  className={
                    seg.is_partial ? "text-muted-foreground/60 italic" : "text-foreground/80"
                  }
                >
                  {seg.text}{" "}
                </span>
              ))}
            </div>
          )}

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
