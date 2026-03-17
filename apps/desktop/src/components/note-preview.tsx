import { Button } from "@minuta/ui";
import { open } from "@tauri-apps/plugin-shell";
import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SaveNoteResult } from "../lib/tauri-commands";

interface NotePreviewProps {
  note: SaveNoteResult;
}

export function NotePreview({ note }: NotePreviewProps) {
  const { t } = useTranslation();

  const openInObsidian = async () => {
    const encodedVault = encodeURIComponent(note.vault_name);
    const encodedFile = encodeURIComponent(note.relative_path);
    const uri = `obsidian://open?vault=${encodedVault}&file=${encodedFile}`;
    await open(uri);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-lg border bg-card p-4 text-sm text-card-foreground w-full max-w-md">
        <p className="font-medium text-foreground truncate">{note.relative_path}</p>
        <p className="text-muted-foreground mt-1 text-xs truncate">{note.file_path}</p>
      </div>
      <Button onClick={openInObsidian} className="gap-2">
        <ExternalLink className="h-4 w-4" />
        {t("note.openInObsidian")}
      </Button>
    </div>
  );
}
