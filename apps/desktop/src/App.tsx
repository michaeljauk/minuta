import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/sidebar";
import { TopBar } from "./components/top-bar";
import { SettingsProvider, useSettings } from "./context/settings-context";
import { useMeetingFlow } from "./hooks/use-meeting-flow";
import { useNotes } from "./hooks/use-notes";
import type { NoteMetadata } from "./lib/tauri-commands";
import { HomePage } from "./pages/home";
import { NoteDetailPage } from "./pages/note-detail";
import { SettingsPage } from "./pages/settings";
import "./i18n";

type Page = "home" | "settings" | "note";

function AppShell() {
  const { settings, updateSettings } = useSettings();
  const [page, setPage] = useState<Page>("home");
  const [selectedNote, setSelectedNote] = useState<NoteMetadata | null>(null);
  const meetingFlow = useMeetingFlow();
  const { notes, isLoading, refresh } = useNotes();

  // Resolve effective dark mode from persisted theme setting
  const resolvedDark =
    settings.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : settings.theme === "dark";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedDark);
  }, [resolvedDark]);

  const toggleDark = useCallback(async () => {
    const nextTheme = resolvedDark ? "light" : "dark";
    await updateSettings({ ...settings, theme: nextTheme });
  }, [resolvedDark, settings, updateSettings]);

  const handleNavigate = useCallback((p: "home" | "settings") => {
    setPage(p);
    setSelectedNote(null);
  }, []);

  const handleSelectNote = useCallback((note: NoteMetadata) => {
    setSelectedNote(note);
    setPage("note");
  }, []);

  const handleNoteDeleted = useCallback(() => {
    setPage("home");
    setSelectedNote(null);
    refresh();
  }, [refresh]);

  // Refresh notes list after a recording completes
  useEffect(() => {
    if (meetingFlow.status === "completed") {
      refresh();
    }
  }, [meetingFlow.status, refresh]);

  return (
    <div className="flex h-screen overflow-hidden bg-sidebar text-foreground">
      <Sidebar
        page={page === "note" ? "home" : page}
        onNavigate={handleNavigate}
        recentNotes={notes}
        isLoading={isLoading}
        onSelectNote={handleSelectNote}
      />
      <main className="flex-1 flex flex-col bg-background overflow-hidden">
        <TopBar
          dark={resolvedDark}
          onToggleDark={toggleDark}
          status={meetingFlow.status}
          duration={meetingFlow.duration}
          onStartRecording={meetingFlow.startRecording}
          onStopRecording={() => meetingFlow.stopAndProcess()}
        />
        <div className="flex-1 overflow-y-auto">
          {page === "home" && (
            <HomePage
              notes={notes}
              isLoading={isLoading}
              meetingFlow={meetingFlow}
              onSelectNote={handleSelectNote}
            />
          )}
          {page === "note" && selectedNote && (
            <NoteDetailPage
              note={selectedNote}
              onBack={() => handleNavigate("home")}
              onDeleted={handleNoteDeleted}
            />
          )}
          {page === "settings" && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppShell />
    </SettingsProvider>
  );
}
