import { cn } from "@minuta/ui";
import { FileText, Home, Search, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { NoteMetadata } from "../hooks/use-notes";

type Page = "home" | "settings";

interface SidebarProps {
  page: Page;
  onNavigate: (page: Page) => void;
  recentNotes: NoteMetadata[];
  isLoading: boolean;
}

export function Sidebar({ page, onNavigate, recentNotes, isLoading }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="flex w-[220px] shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          <Search className="h-3.5 w-3.5" />
          <span>{t("sidebar.search")}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-2 py-1">
        <button
          type="button"
          onClick={() => onNavigate("home")}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer",
            page === "home"
              ? "bg-accent text-accent-foreground"
              : "text-foreground hover:bg-accent/60",
          )}
        >
          <Home className="h-4 w-4" />
          {t("nav.home")}
        </button>
        <button
          type="button"
          onClick={() => onNavigate("settings")}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer",
            page === "settings"
              ? "bg-accent text-accent-foreground"
              : "text-foreground hover:bg-accent/60",
          )}
        >
          <Settings className="h-4 w-4" />
          {t("nav.settings")}
        </button>
      </nav>

      {/* Recents */}
      <div className="mt-4 flex flex-col px-2">
        <span className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("sidebar.recents")}
        </span>
        <div className="flex flex-col gap-0.5">
          {isLoading
            ? ["s1", "s2", "s3"].map((id) => (
                <div key={id} className="mx-3 my-1 h-5 animate-pulse rounded-md bg-muted" />
              ))
            : recentNotes.slice(0, 8).map((note) => (
                <button
                  type="button"
                  key={`${note.date}-${note.time}-${note.title}`}
                  className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-foreground hover:bg-accent/60 transition-colors duration-150 cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{note.title}</span>
                </button>
              ))}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom */}
      <div className="border-t border-sidebar-border px-3 py-3 mt-auto">
        <p className="text-sm font-medium text-sidebar-foreground">{t("app.title")}</p>
      </div>
    </aside>
  );
}
