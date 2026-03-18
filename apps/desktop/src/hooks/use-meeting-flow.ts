import type { MeetingStatus } from "@minuta/core";
import { listen } from "@tauri-apps/api/event";
import { useRef, useState } from "react";
import { useSettings } from "../context/settings-context";
import type { SaveNoteResult, TranscriptSegment } from "../lib/tauri-commands";
import { tauriCommands } from "../lib/tauri-commands";

export function useMeetingFlow() {
  const { settings } = useSettings();
  const [status, setStatus] = useState<MeetingStatus>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<SaveNoteResult | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [liveSegments, setLiveSegments] = useState<TranscriptSegment[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const isProcessingRef = useRef(false);
  const unlistenRef = useRef<(() => void) | null>(null);

  const startRecording = async () => {
    try {
      setError(null);
      setSyncWarning(null);
      setLiveSegments([]);
      setStatus("recording");
      setDuration(0);
      startTimeRef.current = Date.now();

      // Listen for live transcript segments if in realtime mode
      if (settings.transcriptionMode === "realtime") {
        const unlisten = await listen<TranscriptSegment>("transcript-segment", (event) => {
          setLiveSegments((prev) => {
            // Replace last partial with new segment, or append if last was finalized
            if (prev.length > 0 && prev[prev.length - 1].is_partial) {
              return [...prev.slice(0, -1), event.payload];
            }
            return [...prev, event.payload];
          });
        });
        unlistenRef.current = unlisten;
      }

      await tauriCommands.startRecording(
        settings.audioSource,
        settings.transcriptionMode,
        settings.whisperModel,
      );

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (e) {
      setStatus("error");
      setError(String(e));
    }
  };

  const stopAndProcess = async (title: string = "Meeting") => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Clean up event listener
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }

    const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);

    try {
      // Stop recording — may return streaming transcript
      const stopResult = await tauriCommands.stopRecording();

      let transcriptionText: string;
      let transcriptionLanguage: string;

      if (stopResult.transcript?.text) {
        // Streaming transcription completed — skip batch transcription
        transcriptionText = stopResult.transcript.text;
        transcriptionLanguage = stopResult.transcript.language;
        setStatus("summarizing");
      } else {
        // Batch transcription — original flow
        setStatus("transcribing");
        const transcription = await tauriCommands.transcribeAudio(
          stopResult.audio_path,
          settings.whisperModel,
        );
        transcriptionText = transcription.text;
        transcriptionLanguage = transcription.language;
        setStatus("summarizing");
      }

      // Summarize
      const summary = await tauriCommands.summarizeTranscript(
        transcriptionText,
        transcriptionLanguage,
        settings.ollamaBaseUrl,
        settings.ollamaModel,
      );

      // Save
      setStatus("saving");
      const result = await tauriCommands.saveNote({
        storage_dir: settings.storageDir,
        output_folder: settings.outputFolder,
        title,
        summary,
        transcript: transcriptionText,
        language: transcriptionLanguage,
        duration_minutes: Math.round(durationSeconds / 60),
        wikilink_attendees: settings.wikilinkAttendees,
        transcript_mode: settings.transcriptMode,
        connectors: settings.connectors,
      });

      if (result.connector_warnings.length > 0) {
        setSyncWarning(result.connector_warnings.join("; "));
      }

      setSavedNote(result);
      setStatus("completed");
    } catch (e) {
      setStatus("error");
      setError(String(e));
    } finally {
      isProcessingRef.current = false;
    }
  };

  const reset = () => {
    setStatus("idle");
    setError(null);
    setSavedNote(null);
    setSyncWarning(null);
    setLiveSegments([]);
    setDuration(0);
  };

  return {
    status,
    duration,
    error,
    savedNote,
    syncWarning,
    liveSegments,
    startRecording,
    stopAndProcess,
    reset,
  };
}
