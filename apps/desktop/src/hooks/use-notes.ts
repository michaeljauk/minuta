import { useCallback, useEffect, useState } from "react";
import { useSettings } from "../context/settings-context";
import type { NoteMetadata } from "../lib/tauri-commands";
import { tauriCommands } from "../lib/tauri-commands";

export type { NoteMetadata } from "../lib/tauri-commands";

export function useNotes() {
  const { settings, isLoading: settingsLoading } = useSettings();
  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!settings.vaultPath) {
      setNotes([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const result = await tauriCommands.listNotes(settings.vaultPath, settings.outputFolder);
      setNotes(result);
    } catch {
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  }, [settings.vaultPath, settings.outputFolder]);

  useEffect(() => {
    if (!settingsLoading) {
      refresh();
    }
  }, [settingsLoading, refresh]);

  return { notes, isLoading: isLoading || settingsLoading, refresh };
}
