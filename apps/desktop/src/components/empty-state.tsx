import { Mic } from "lucide-react";
import { useTranslation } from "react-i18next";

export function EmptyState() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
        <Mic className="w-8 h-8 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{t("home.noMeetingsYet")}</p>
        <p className="text-xs text-muted-foreground mt-1">{t("home.noMeetingsDesc")}</p>
      </div>
    </div>
  );
}
