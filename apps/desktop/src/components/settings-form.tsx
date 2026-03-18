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

  const browseStorage = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") update({ storageDir: selected });
  };

  const browseObsidian = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setLocal((s) => ({
        ...s,
        connectors: {
          ...s.connectors,
          obsidian: {
            enabled: s.connectors.obsidian?.enabled ?? true,
            vaultPath: selected,
            outputFolder: s.connectors.obsidian?.outputFolder ?? "meetings",
          },
        },
      }));
    }
  };

  const updateObsidian = (patch: Partial<NonNullable<AppSettings["connectors"]["obsidian"]>>) => {
    setLocal((s) => ({
      ...s,
      connectors: {
        ...s.connectors,
        obsidian: {
          enabled: s.connectors.obsidian?.enabled ?? false,
          vaultPath: s.connectors.obsidian?.vaultPath ?? "",
          outputFolder: s.connectors.obsidian?.outputFolder ?? "meetings",
          ...patch,
        },
      },
    }));
  };

  const handleSave = async () => {
    await updateSettings(local);
    i18n.changeLanguage(local.language);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Storage */}
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">{t("settings.storage")}</h2>
        <div className="flex flex-col gap-2">
          <Label>{t("settings.storageDir")}</Label>
          <div className="flex gap-2">
            <Input
              value={local.storageDir}
              onChange={(e) => update({ storageDir: e.target.value })}
              placeholder={t("settings.storageDirPlaceholder")}
            />
            <Button variant="outline" onClick={browseStorage}>
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

      {/* Connectors */}
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">{t("settings.connectors")}</h2>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t("settings.connectorObsidian")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("settings.connectorObsidianDesc")}
              </p>
            </div>
            <Switch
              checked={local.connectors.obsidian?.enabled ?? false}
              onCheckedChange={(v) => updateObsidian({ enabled: v })}
            />
          </div>
          {local.connectors.obsidian?.enabled && (
            <div className="flex flex-col gap-3 pl-1 border-l-2 border-border ml-1">
              <div className="flex flex-col gap-2 pl-3">
                <Label>{t("settings.connectorObsidianPath")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={local.connectors.obsidian?.vaultPath ?? ""}
                    onChange={(e) => updateObsidian({ vaultPath: e.target.value })}
                    placeholder={t("settings.connectorObsidianPathPlaceholder")}
                  />
                  <Button variant="outline" onClick={browseObsidian}>
                    {t("settings.browse")}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2 pl-3">
                <Label>{t("settings.connectorObsidianFolder")}</Label>
                <Input
                  value={local.connectors.obsidian?.outputFolder ?? "meetings"}
                  onChange={(e) => updateObsidian({ outputFolder: e.target.value })}
                  placeholder={t("settings.outputFolderPlaceholder")}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recording */}
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">{t("settings.recording")}</h2>
        <div className="flex flex-col gap-2">
          <Label>{t("settings.audioSource")}</Label>
          <Select
            value={local.audioSource}
            onValueChange={(v) => update({ audioSource: v as AppSettings["audioSource"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mic">{t("settings.audioSourceMic")}</SelectItem>
              <SelectItem value="system">{t("settings.audioSourceSystem")}</SelectItem>
              <SelectItem value="both">{t("settings.audioSourceBoth")}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("settings.audioSourceHelp")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("settings.transcriptionMode")}</Label>
          <Select
            value={local.transcriptionMode}
            onValueChange={(v) =>
              update({ transcriptionMode: v as AppSettings["transcriptionMode"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="realtime">{t("settings.transcriptionModeRealtime")}</SelectItem>
              <SelectItem value="batch">{t("settings.transcriptionModeBatch")}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("settings.transcriptionModeHelp")}</p>
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
          <Label>{t("settings.theme")}</Label>
          <Select
            value={local.theme}
            onValueChange={(v) => update({ theme: v as AppSettings["theme"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t("settings.themeLight")}</SelectItem>
              <SelectItem value="dark">{t("settings.themeDark")}</SelectItem>
              <SelectItem value="system">{t("settings.themeSystem")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
