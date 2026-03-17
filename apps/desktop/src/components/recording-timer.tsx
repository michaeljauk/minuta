interface RecordingTimerProps {
  duration: number;
}

export function RecordingTimer({ duration }: RecordingTimerProps) {
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = duration % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (hours > 0) {
    return (
      <div className="font-mono text-2xl tabular-nums text-foreground">
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </div>
    );
  }

  return (
    <div className="font-mono text-2xl tabular-nums text-foreground">
      {pad(minutes)}:{pad(seconds)}
    </div>
  );
}
