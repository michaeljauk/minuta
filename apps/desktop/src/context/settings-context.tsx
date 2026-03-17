import React, { createContext, useContext, useEffect, useState } from "react";
import type { AppSettings } from "@minuta/core";
import { DEFAULT_SETTINGS } from "@minuta/core";
import { tauriCommands } from "../lib/tauri-commands";

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (settings: AppSettings) => Promise<void>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    tauriCommands
      .loadSettings()
      .then((s) => setSettings(s))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const updateSettings = async (newSettings: AppSettings) => {
    await tauriCommands.saveSettings(newSettings);
    setSettings(newSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
