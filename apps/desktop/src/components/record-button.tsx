import { Mic, Square } from "lucide-react";
import { cn } from "@minuta/ui";
import type { MeetingStatus } from "@minuta/core";

interface RecordButtonProps {
  status: MeetingStatus;
  onStart: () => void;
  onStop: () => void;
}

export function RecordButton({ status, onStart, onStop }: RecordButtonProps) {
  const isRecording = status === "recording";
  const isProcessing = ["transcribing", "summarizing", "saving"].includes(status);

  return (
    <button
      onClick={isRecording ? onStop : onStart}
      disabled={isProcessing || status === "completed"}
      className={cn(
        "relative flex h-24 w-24 items-center justify-center rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2",
        isRecording
          ? "bg-red-500 hover:bg-red-600 focus:ring-red-500 shadow-lg shadow-red-500/30 animate-pulse"
          : "bg-primary hover:bg-primary/90 focus:ring-primary shadow-lg",
        (isProcessing || status === "completed") && "opacity-50 cursor-not-allowed"
      )}
    >
      {isRecording ? (
        <Square className="h-10 w-10 text-white" />
      ) : (
        <Mic className="h-10 w-10 text-primary-foreground" />
      )}
    </button>
  );
}
