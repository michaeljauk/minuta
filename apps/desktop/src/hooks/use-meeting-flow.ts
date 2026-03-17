import { useState, useRef } from "react";
import type { MeetingStatus } from "@minuta/core";
import { tauriCommands } from "../lib/tauri-commands";
import type { SaveNoteResult } from "../lib/tauri-commands";
import { useSettings } from "../context/settings-context";

export function useMeetingFlow() {
  const { settings } = useSettings();
  const [status, setStatus] = useState<MeetingStatus>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<SaveNoteResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = async () => {
    try {
      setError(null);
      setStatus("recording");
      setDuration(0);
      startTimeRef.current = Date.now();

      await tauriCommands.startRecording();

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (e) {
      setStatus("error");
      setError(String(e));
    }
  };

  const stopAndProcess = async (title: string = "Meeting") => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);

    try {
      // Stop recording
      const audioPath = await tauriCommands.stopRecording();

      // Transcribe
      setStatus("transcribing");
      const transcription = await tauriCommands.transcribeAudio(
        audioPath,
        settings.whisperModel
      );

      // Summarize
      setStatus("summarizing");
      const summary = await tauriCommands.summarizeTranscript(
        transcription.text,
        transcription.language,
        settings.ollamaBaseUrl,
        settings.ollamaModel
      );

      // Save
      setStatus("saving");
      const result = await tauriCommands.saveNote({
        vault_path: settings.vaultPath,
        output_folder: settings.outputFolder,
        title,
        summary,
        transcript: transcription.text,
        language: transcription.language,
        duration_minutes: Math.round(durationSeconds / 60),
        wikilink_attendees: settings.wikilinkAttendees,
        transcript_mode: settings.transcriptMode,
      });

      setSavedNote(result);
      setStatus("completed");
    } catch (e) {
      setStatus("error");
      setError(String(e));
    }
  };

  const reset = () => {
    setStatus("idle");
    setError(null);
    setSavedNote(null);
    setDuration(0);
  };

  return {
    status,
    duration,
    error,
    savedNote,
    startRecording,
    stopAndProcess,
    reset,
  };
}
