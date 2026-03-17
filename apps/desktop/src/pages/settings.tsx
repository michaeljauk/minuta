import { useTranslation } from "react-i18next";
import { ScrollArea } from "@minuta/ui";
import { SettingsForm } from "../components/settings-form";

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <h1 className="text-lg font-semibold">{t("settings.title")}</h1>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-lg mx-auto">
          <SettingsForm />
        </div>
      </ScrollArea>
    </div>
  );
}
