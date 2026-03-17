import { Button } from "@minuta/ui";
import { open } from "@tauri-apps/plugin-shell";
import { ArrowLeft, Clock, Copy, ExternalLink, Globe, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { NoteMetadata } from "../lib/tauri-commands";
import { tauriCommands } from "../lib/tauri-commands";

interface NoteDetailPageProps {
  note: NoteMetadata;
  onBack: () => void;
  onDeleted: () => void;
}

export function NoteDetailPage({ note, onBack, onDeleted }: NoteDetailPageProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    tauriCommands
      .readNote(note.filePath)
      .then((text) => setContent(text))
      .catch(() => setContent(null))
      .finally(() => setIsLoading(false));
  }, [note.filePath]);

  const openInObsidian = useCallback(async () => {
    const encodedVault = encodeURIComponent(note.vaultName);
    const encodedFile = encodeURIComponent(note.relativePath);
    const uri = `obsidian://open?vault=${encodedVault}&file=${encodedFile}`;
    await open(uri);
  }, [note.vaultName, note.relativePath]);

  const copyTranscript = useCallback(async () => {
    if (!content) return;
    // Extract transcript section from markdown
    const transcriptMatch = content.match(/# Transcript\n\n([\s\S]*?)(?:$)/);
    const transcript = transcriptMatch ? transcriptMatch[1].trim() : content;
    // Strip <details> tags if present
    const cleaned = transcript
      .replace(/<\/?details>/g, "")
      .replace(/<summary>.*?<\/summary>/g, "")
      .trim();
    await navigator.clipboard.writeText(cleaned);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleDelete = useCallback(async () => {
    try {
      await tauriCommands.deleteNote(note.filePath);
      onDeleted();
    } catch {
      // Stay on page if delete fails
    }
  }, [note.filePath, onDeleted]);

  // Strip frontmatter from content for rendering
  const markdownContent = content ? content.replace(/^---[\s\S]*?---\n*/, "") : "";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-8 pt-6 pb-4 border-b border-border">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("nav.home")}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-8">
          {/* Title */}
          <h1 className="text-2xl font-semibold tracking-tight mb-4">{note.title}</h1>

          {/* Metadata bar */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-6 pb-4 border-b border-border">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {note.date} {note.time}
            </span>
            {note.durationMinutes > 0 && (
              <span>
                {note.durationMinutes} {t("noteDetail.minutes")}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" />
              {t("noteDetail.local")}
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Button variant="outline" size="sm" onClick={openInObsidian} className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              {t("note.openInObsidian")}
            </Button>
            <Button variant="outline" size="sm" onClick={copyTranscript} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              {copied ? t("noteDetail.copied") : t("noteDetail.copyTranscript")}
            </Button>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  {t("noteDetail.confirmDelete")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  {t("noteDetail.cancel")}
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("noteDetail.delete")}
              </Button>
            )}
          </div>

          {/* Markdown content */}
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {["sk1", "sk2", "sk3", "sk4", "sk5"].map((id) => (
                <div key={id} className="h-4 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : content ? (
            <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:tracking-tight prose-headings:font-semibold prose-p:text-foreground prose-li:text-foreground prose-a:text-primary">
              <Markdown remarkPlugins={[remarkGfm]}>{markdownContent}</Markdown>
            </article>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noteDetail.loadError")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
