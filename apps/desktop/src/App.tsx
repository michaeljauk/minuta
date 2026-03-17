import { useEffect, useState } from "react";
import { Sidebar } from "./components/sidebar";
import { TopBar } from "./components/top-bar";
import { SettingsProvider } from "./context/settings-context";
import { useMeetingFlow } from "./hooks/use-meeting-flow";
import { useNotes } from "./hooks/use-notes";
import { HomePage } from "./pages/home";
import { SettingsPage } from "./pages/settings";
import "./i18n";

type Page = "home" | "settings";

function AppShell() {
  const [page, setPage] = useState<Page>("home");
  const [dark, setDark] = useState(false);
  const meetingFlow = useMeetingFlow();
  const { notes, isLoading } = useNotes();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <div className="flex h-screen overflow-hidden bg-sidebar text-foreground">
      <Sidebar page={page} onNavigate={setPage} recentNotes={notes} isLoading={isLoading} />
      <main className="flex-1 flex flex-col bg-background overflow-hidden">
        <TopBar
          dark={dark}
          onToggleDark={() => setDark((d) => !d)}
          status={meetingFlow.status}
          duration={meetingFlow.duration}
          onStartRecording={meetingFlow.startRecording}
          onStopRecording={() => meetingFlow.stopAndProcess()}
        />
        <div className="flex-1 overflow-y-auto">
          {page === "home" && (
            <HomePage notes={notes} isLoading={isLoading} meetingFlow={meetingFlow} />
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
