interface RecordingTimerProps {
  duration: number;
  compact?: boolean;
}

export function RecordingTimer({ duration, compact }: RecordingTimerProps) {
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = duration % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  const timeStr =
    hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;

  if (compact) {
    return <span className="tabular-nums">{timeStr}</span>;
  }

  return <div className="font-mono text-2xl tabular-nums text-foreground">{timeStr}</div>;
}
