import type { MeetingStatus } from "@minuta/core";
import { Button } from "@minuta/ui";
import { Loader2, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RecordingTimer } from "./recording-timer";

interface TopBarProps {
  dark: boolean;
  onToggleDark: () => void;
  status: MeetingStatus;
  duration: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export function TopBar({
  dark,
  onToggleDark,
  status,
  duration,
  onStartRecording,
  onStopRecording,
}: TopBarProps) {
  const { t } = useTranslation();
  const isRecording = status === "recording";
  const isProcessing = ["transcribing", "summarizing", "saving"].includes(status);

  return (
    <header
      className="flex h-11 items-center justify-end gap-2 border-b border-border bg-background px-4"
      data-tauri-drag-region
    >
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleDark}>
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      {isProcessing ? (
        <button
          type="button"
          disabled
          className="flex items-center gap-1.5 rounded-full bg-muted px-4 py-1.5 text-sm font-medium text-muted-foreground"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("home.processing")}
        </button>
      ) : isRecording ? (
        <button
          type="button"
          onClick={onStopRecording}
          className="flex items-center gap-1.5 rounded-full bg-recording px-4 py-1.5 text-sm font-medium text-recording-foreground hover:bg-recording/90 transition-colors active:scale-[0.98] transition-transform cursor-pointer"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-recording-foreground opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-recording-foreground" />
          </span>
          <RecordingTimer duration={duration} compact />
        </button>
      ) : (
        <button
          type="button"
          onClick={onStartRecording}
          className="flex items-center gap-1.5 rounded-full bg-recording px-4 py-1.5 text-sm font-medium text-recording-foreground hover:bg-recording/90 transition-colors active:scale-[0.98] transition-transform cursor-pointer"
        >
          <span className="inline-flex h-2 w-2 rounded-full bg-recording-foreground" />
          {t("home.record")}
        </button>
      )}
    </header>
  );
}
