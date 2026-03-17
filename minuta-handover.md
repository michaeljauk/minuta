# Minuta — Agent Handover Prompt

> Copy the entire content below and hand it to an AI coding agent (Claude, Cursor, etc.) to start implementation.

---

## HANDOVER PROMPT

You are implementing **Minuta** — an open-source, local-first AI meeting note taker with Obsidian as its primary output target.

### Goal for this session
Implement **v0.1 MVP**: Record meeting audio → transcribe locally → generate AI summary → write `.md` file to Obsidian Vault.

---

### Repository Setup

Initialize a new repository called `minuta` with the following Turborepo monorepo structure:

```
minuta/
  apps/
    desktop/               ← Tauri v2 app (this is the v0.1 focus)
    mobile/                ← Tauri v2 Mobile (scaffold only, not implemented yet)
    web/                   ← Next.js 16 (scaffold only, not implemented yet)
  packages/
    ui/                    ← shared shadcn/ui + Tailwind components
    core/                  ← shared TypeScript: types, Obsidian schema, vault writer logic
    ollama-client/         ← shared Ollama API wrapper
  src-tauri/               ← Rust workspace
  turbo.json
  pnpm-workspace.yaml
  package.json
```

**Package manager:** pnpm (never npm or yarn)
**Monorepo tool:** Turborepo

---

### Tech Stack

#### Desktop App (`apps/desktop`)
- **Framework:** Tauri v2
- **UI:** React + TypeScript + Vite
- **Styling:** Tailwind CSS + shadcn/ui
- **i18n:** react-i18next (languages: EN [default], DE)

#### Rust Backend (`src-tauri`)
- **Audio Capture:** `cpal` crate — cross-platform (CoreAudio on macOS, WASAPI on Windows, ALSA on Linux). Must capture both system audio output (speaker) AND microphone input simultaneously.
- **Transcription:** `whisper-rs` crate (Whisper.cpp bindings) — 100% local. Default model: `base`. User can switch model in settings.
- **Summarization:** HTTP calls to local Ollama instance. Default model: `llama3`. Optional: user can configure OpenAI or Anthropic API key as fallback.
- **Vault Writer:** Direct filesystem writes via `std::fs`. No Obsidian plugin or API required.

#### Shared Packages
- `packages/core`: TypeScript types for `MeetingNote`, `MeetingConfig`, `VaultConfig`, Obsidian frontmatter schema
- `packages/ui`: shadcn/ui components shared across apps
- `packages/ollama-client`: TypeScript wrapper for Ollama REST API

---

### v0.1 Feature Scope

Implement ONLY these features for v0.1:

1. **Audio Recording**
   - Capture both sides: system audio (speaker output) + microphone
   - Manual start/stop via UI button
   - Show recording duration in UI

2. **Local Transcription**
   - Run Whisper.cpp via whisper-rs after recording stops
   - Default model: `base` (user-configurable in settings)
   - Show progress indicator during transcription

3. **AI Summary Generation**
   - Send transcript to local Ollama instance
   - Use structured prompt (see Prompt Template below)
   - Show progress indicator

4. **Vault Output**
   - Write `.md` file to configured vault path
   - Filename format: `YYYY-MM-DD_HH-mm_Title.md` (configurable)
   - Default folder: `meetings/` within vault (configurable)

5. **Settings Screen**
   - Vault path (folder picker)
   - Whisper model selector (tiny / base / small / large-v3)
   - Ollama base URL (default: http://localhost:11434)
   - Ollama model (default: llama3)
   - Optional: OpenAI API key / Anthropic API key as Ollama fallback
   - Output folder name (default: meetings)
   - Wikilink format for attendees toggle (default: on)
   - Transcript in output: always / never / collapsed (default: collapsed)
   - Language: EN / DE (default: EN)

DO NOT implement in v0.1: Calendar integration, Live RAG, screen-share-hide, Quick Capture, templates, GitHub Releases.

---

### Obsidian Output Schema

**File path:** `{vault_path}/{output_folder}/{YYYY-MM-DD}_{HH-mm}_{title}.md`

**Frontmatter:**
```yaml
---
title: "{meeting title or 'Untitled Meeting'}"
date: YYYY-MM-DD
time: HH:mm
duration: {minutes}
attendees: []              # empty in v0.1, filled by Calendar in v0.2
meeting-type: call         # hardcoded in v0.1, from Calendar in v0.2
tags: [meeting]
source: minuta
language: {detected by Whisper}
---
```

**Note body:**
```markdown
# Summary

{AI generated paragraph summary}

# Key Decisions

{AI generated bullet list — or "None identified" if none}

# Action Items

{AI generated checkbox list — or "None identified" if none}

# Transcript

<details>
<summary>Full transcript</summary>

{full whisper transcript}

</details>
```

If wikilinks are enabled in settings, attendee names should be wrapped in `[[double brackets]]`.
If transcript setting is "always": show transcript inline without `<details>`.
If transcript setting is "never": omit transcript section entirely.

---

### Ollama Prompt Template

```
You are a professional meeting notes assistant. Based on the following transcript, generate structured meeting notes.

Respond in {detected_language} (same language as the transcript).

Output EXACTLY in this format with these exact section headers:

## Summary
[2-4 sentence paragraph summarizing the meeting]

## Key Decisions
[Bullet list of decisions made. Write "None identified." if none.]

## Action Items
[Checkbox list in format "- [ ] Action item (Owner if mentioned)". Write "None identified." if none.]

---
TRANSCRIPT:
{transcript}
```

---

### License

Use **FSL-1.1-Apache-2.0** (Functional Source License).

Add `LICENSE` file at repo root with FSL-1.1 text. Key properties:
- Free for personal/self-hosted use
- Commercial hosting by third parties is prohibited
- Each release converts to Apache 2.0 after 2 years

See: https://fsl.software

---

### UI/UX Guidelines

- Minimal, clean interface — Granola is the UX reference
- shadcn/ui components with Tailwind
- Dark mode support from day one
- Main screen: large record button, recording status, recent notes list
- During recording: live waveform or simple timer, stop button
- Processing state: progress steps (Transcribing... → Summarizing... → Saving...)
- After completion: show note preview, button to open in Obsidian (via `obsidian://` URI)

---

### Obsidian URI Integration

After saving a note, offer a button: "Open in Obsidian"
Use URI: `obsidian://open?vault={vault_name}&file={relative_file_path}`

---

### i18n Setup

Use `react-i18next` for the Tauri app.

Languages: `en` (default), `de`

Translate all UI strings. The AI-generated note content should be in the language detected by Whisper (not the app UI language).

---

### What to NOT do

- Do not use npm or yarn — use pnpm only
- Do not implement Calendar integration (v0.2)
- Do not implement Live RAG / LanceDB (v0.3)
- Do not implement Quick Capture / global hotkey (v0.4)
- Do not implement the web app (Next.js) beyond scaffold
- Do not use cloud APIs for transcription or embeddings — everything local by default
- Do not use Next.js in the Tauri app — use Vite + React
- Do not add Co-Authored-By trailers to git commits

---

### Reference Projects (for inspiration, do not copy code)

- Meetily (Tauri + Whisper + Ollama, good audio capture reference): https://github.com/zackriya-solutions/meetily
- OpenGranola (RAG approach reference): https://github.com/yazinsai/opengranola
- whisper-rs: https://github.com/tazz4843/whisper-rs
- cpal: https://github.com/RustAudio/cpal
- LanceDB (needed in v0.3, not v0.1): https://github.com/lancedb/lancedb

---

### First Steps for the Agent

1. Initialize Turborepo monorepo with pnpm
2. Scaffold `apps/desktop` with `create-tauri-app` (React + TypeScript + Vite)
3. Set up `packages/core` with TypeScript types
4. Add `cpal` to Rust workspace and implement audio capture command
5. Add `whisper-rs` and implement transcription Tauri command
6. Implement Ollama HTTP client in `packages/ollama-client`
7. Implement vault writer in Rust (`std::fs`)
8. Wire up the UI: record → transcribe → summarize → save flow
9. Implement Settings screen
10. Add react-i18next with EN + DE translations
11. Add FSL license file
