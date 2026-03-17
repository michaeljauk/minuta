import { Button } from "@minuta/ui";
import { Home, Moon, Settings, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsProvider } from "./context/settings-context";
import { HomePage } from "./pages/home";
import { SettingsPage } from "./pages/settings";
import "./i18n";

type Page = "home" | "settings";

function AppShell() {
  const { t } = useTranslation();
  const [page, setPage] = useState<Page>("home");
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-1">
          <Button
            variant={page === "home" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPage("home")}
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            {t("nav.home")}
          </Button>
          <Button
            variant={page === "settings" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPage("settings")}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            {t("nav.settings")}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground">{t("app.title")}</span>
          <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {page === "home" ? <HomePage /> : <SettingsPage />}
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
