import { useTranslation } from "react-i18next";
import { SettingsForm } from "../components/settings-form";

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-xl mx-auto px-8 py-8 flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
      <SettingsForm />
    </div>
  );
}
