import type { MeetingStatus } from "@minuta/core";
import { cn } from "@minuta/ui";
import { Check, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ProcessingStatusProps {
  status: MeetingStatus;
}

const STEPS: { key: MeetingStatus; labelKey: string }[] = [
  { key: "transcribing", labelKey: "processing.transcribing" },
  { key: "summarizing", labelKey: "processing.summarizing" },
  { key: "saving", labelKey: "processing.saving" },
];

export function ProcessingStatus({ status }: ProcessingStatusProps) {
  const { t } = useTranslation();

  const stepOrder = ["transcribing", "summarizing", "saving", "completed"];
  const currentIndex = stepOrder.indexOf(status);

  return (
    <div className="flex flex-col gap-3 w-full max-w-xs">
      {STEPS.map(({ key, labelKey }, i) => {
        const stepIndex = stepOrder.indexOf(key);
        const isDone = currentIndex > stepIndex;
        const isActive = status === key;

        return (
          <div key={key} className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                isDone && "bg-green-500 text-white",
                isActive && "bg-primary text-primary-foreground",
                !isDone && !isActive && "bg-muted text-muted-foreground",
              )}
            >
              {isDone ? (
                <Check className="h-4 w-4" />
              ) : isActive ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>{i + 1}</span>
              )}
            </div>
            <span
              className={cn(
                "text-sm",
                isActive && "font-medium text-foreground",
                isDone && "text-muted-foreground line-through",
                !isDone && !isActive && "text-muted-foreground",
              )}
            >
              {t(labelKey)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
