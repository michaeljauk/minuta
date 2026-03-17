import type { AppSettings } from "@minuta/core";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@minuta/ui";
import { open } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "../context/settings-context";

export function SettingsForm() {
  const { t, i18n } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const [local, setLocal] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<AppSettings>) => setLocal((s) => ({ ...s, ...patch }));

  const browseVault = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") update({ vaultPath: selected });
  };

  const handleSave = async () => {
    await updateSettings(local);
    i18n.changeLanguage(local.language);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Vault */}
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">{t("settings.vault")}</h2>
        <div className="flex flex-col gap-2">
          <Label>{t("settings.vaultPath")}</Label>
          <div className="flex gap-2">
            <Input
              value={local.vaultPath}
              onChange={(e) => update({ vaultPath: e.target.value })}
              placeholder={t("settings.vaultPathPlaceholder")}
            />
            <Button variant="outline" onClick={browseVault}>
              {t("settings.browse")}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("settings.outputFolder")}</Label>
          <Input
            value={local.outputFolder}
            onChange={(e) => update({ outputFolder: e.target.value })}
            placeholder={t("settings.outputFolderPlaceholder")}
          />
        </div>
      </div>

      {/* AI Models */}
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">{t("settings.aiModels")}</h2>
        <div className="flex flex-col gap-2">
          <Label>{t("settings.whisperModel")}</Label>
          <Select
            value={local.whisperModel}
            onValueChange={(v) => update({ whisperModel: v as AppSettings["whisperModel"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tiny">{t("settings.modelTiny")}</SelectItem>
              <SelectItem value="base">{t("settings.modelBase")}</SelectItem>
              <SelectItem value="small">{t("settings.modelSmall")}</SelectItem>
              <SelectItem value="large-v3">{t("settings.modelLargeV3")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("settings.ollamaUrl")}</Label>
          <Input
            value={local.ollamaBaseUrl}
            onChange={(e) => update({ ollamaBaseUrl: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("settings.ollamaModel")}</Label>
          <Input
            value={local.ollamaModel}
            onChange={(e) => update({ ollamaModel: e.target.value })}
          />
        </div>
      </div>

      {/* API Keys */}
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">{t("settings.apiKeys")}</h2>
        <div className="flex flex-col gap-2">
          <Label>{t("settings.openaiKey")}</Label>
          <Input
            type="password"
            value={local.openaiApiKey ?? ""}
            onChange={(e) => update({ openaiApiKey: e.target.value || undefined })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("settings.anthropicKey")}</Label>
          <Input
            type="password"
            value={local.anthropicApiKey ?? ""}
            onChange={(e) => update({ anthropicApiKey: e.target.value || undefined })}
          />
        </div>
      </div>

      {/* Output */}
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">{t("settings.output")}</h2>
        <div className="flex items-center justify-between">
          <div>
            <Label>{t("settings.wikilinkAttendees")}</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("settings.wikilinkAttendeesDesc")}
            </p>
          </div>
          <Switch
            checked={local.wikilinkAttendees}
            onCheckedChange={(v) => update({ wikilinkAttendees: v })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("settings.transcriptMode")}</Label>
          <Select
            value={local.transcriptMode}
            onValueChange={(v) => update({ transcriptMode: v as AppSettings["transcriptMode"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="always">{t("settings.transcriptAlways")}</SelectItem>
              <SelectItem value="never">{t("settings.transcriptNever")}</SelectItem>
              <SelectItem value="collapsed">{t("settings.transcriptCollapsed")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* General */}
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">{t("settings.general")}</h2>
        <div className="flex flex-col gap-2">
          <Label>{t("settings.language")}</Label>
          <Select
            value={local.language}
            onValueChange={(v) => update({ language: v as AppSettings["language"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="de">Deutsch</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} className="bg-primary text-primary-foreground">
          {saved ? t("settings.saved") : t("settings.save")}
        </Button>
      </div>
    </div>
  );
}
