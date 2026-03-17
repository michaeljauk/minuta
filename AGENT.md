# AGENT.md — Minuta

Agent guidance for the Minuta codebase. Read this before making any changes.

---

## Project Overview

**Minuta** is a local-first AI meeting note taker. It records audio, transcribes locally via Whisper.cpp, summarizes via a local Ollama instance, and writes structured Markdown notes directly to an Obsidian vault. No cloud services. No data leaves the machine.

**Current milestone:** v0.1 MVP — desktop app only (mobile and web scaffolds exist but are not implemented).

---

## Repository Layout

```
/
├── apps/
│   ├── desktop/          # Tauri v2 + React 19 + Vite — the active product
│   ├── mobile/           # Tauri mobile scaffold (not implemented)
│   └── web/              # Next.js 16 scaffold (not implemented)
├── packages/
│   ├── core/             # Shared TS types, interfaces, Zod schemas
│   ├── ui/               # shadcn/ui component library (Tailwind CSS)
│   └── ollama-client/    # TypeScript HTTP wrapper for Ollama REST API
├── src-tauri/            # Rust backend (audio, transcription, summarization, vault I/O)
│   ├── src/              # Rust modules (see architecture below)
│   ├── capabilities/     # Tauri security capability configs
│   └── tauri.conf.json   # Tauri configuration
├── .context/             # Agent scratch space (gitignored)
│   ├── todos.md          # In-progress task tracking
│   └── notes.md          # Cross-agent notes and decisions
├── minuta-handover.md    # Full product spec and implementation reference
└── README.md             # User-facing documentation
```

---

## Tech Stack

### Frontend (apps/desktop)
| Concern | Tool |
|---|---|
| Framework | Tauri v2 (desktop shell) |
| UI | React 19 + Vite 6 |
| Styling | Tailwind CSS 3 + shadcn/ui |
| Routing | React Router 7 |
| i18n | react-i18next (UI default: `en`, also `de`) |
| Icons | Lucide React |
| Language | TypeScript 5.8 (strict) |
| Dev port | 1420 |

### Backend (src-tauri)
| Concern | Crate |
|---|---|
| Runtime | Tauri 2.0 + tokio (full) |
| Audio capture | cpal 0.15 + hound 3.5 (WAV) |
| Transcription | whisper-rs 0.14 (Whisper.cpp bindings) |
| Summarization | reqwest 0.12 → Ollama HTTP API |
| Error handling | thiserror 2.0 |
| Serialization | serde + serde_json |
| File paths | dirs 6.0 |

### Shared Packages
- **@minuta/core** — TypeScript types and interfaces consumed by all apps
- **@minuta/ui** — shadcn/ui components, exported for apps
- **@minuta/ollama-client** — Thin HTTP wrapper around Ollama REST API

### Monorepo
- **Package manager:** pnpm (v10.29.3) — never use npm or yarn
- **Build orchestration:** Turborepo v2

---

## Dev Workflow

### Starting development
```sh
pnpm install                   # install all workspaces
pnpm desktop:dev               # start Tauri + Vite dev server
```

### Useful scripts
```sh
pnpm desktop:dev               # Vite on :1420 + Tauri watcher
pnpm desktop:build             # production build (Vite + cargo)
pnpm tauri:dev                 # alternative direct tauri invocation
pnpm typecheck                 # type-check all packages
pnpm lint                      # lint all packages
```

### Running a single package script
```sh
pnpm --filter @minuta/desktop <script>
pnpm --filter @minuta/core build
```

### Build outputs
- Frontend bundle: `apps/desktop/dist/`
- Desktop app bundle: `src-tauri/target/release/bundle/`
- Package declarations: `packages/*/dist/`

---

## Architecture — Rust Backend

```
src-tauri/src/
├── main.rs          # Entry point — plugin registration, invoke_handler
├── state.rs         # AppState (Mutex<RecordingState>)
├── audio.rs         # start_recording / stop_recording commands
├── transcribe.rs    # whisper-rs integration, resample → 16kHz mono
├── summarize.rs     # Ollama HTTP client, prompt building
├── vault.rs         # Markdown note generation, YAML frontmatter, file write
├── settings.rs      # Settings load/save (JSON in app data dir)
└── error.rs         # AppError enum — Audio, Transcription, Summarization, Vault, Settings, Io
```

**Key patterns:**
- All public Rust functions exposed to JS are `#[tauri::command]` annotated
- Shared mutable state via `Mutex<T>` managed by Tauri's state system
- Blocking CPU work (Whisper inference) goes in `tokio::task::spawn_blocking`
- Audio capture spawns OS threads via cpal; not async
- Errors flow through `AppError` → serialized to JSON → propagated to frontend

**Tauri commands available to JS:**
```
start_recording, stop_recording
transcribe_audio
summarize_transcript
save_note
load_settings, save_settings
```

**File locations at runtime:**
- Recordings: `{app_data_dir}/recording_YYYYMMDD_HHMMSS.wav`
- Settings: `{app_data_dir}/settings.json`
- Notes: user-configured Obsidian vault path

---

## Architecture — React Frontend

```
apps/desktop/src/
├── App.tsx                    # Root: navigation shell, dark mode toggle
├── main.tsx                   # React entry, i18n init
├── pages/
│   ├── home.tsx               # Recording interface + processing steps
│   └── settings.tsx           # Settings form
├── context/
│   └── SettingsContext.tsx    # App-wide settings via React Context
└── i18n/
    ├── en.json                # English translations
    └── de.json                # German translations
```

**State management:**
- `SettingsContext` for global settings (vault path, model selection, etc.)
- Local `useState` for page navigation, dark mode, recording state, and processing status
- No external state library — keep it that way unless complexity demands it

**Tauri IPC pattern:**
```ts
import { invoke } from "@tauri-apps/api/core";
const result = await invoke<ReturnType>("command_name", { param: value });
```

---

## Shared Packages

### @minuta/core
- Source: `packages/core/src/types/`
- Contains: TypeScript interfaces for `Note`, `TranscriptSegment`, `Settings`, `RecordingState`, etc.
- Must be built before apps: `pnpm --filter @minuta/core build`
- All types are strict — no `any`, no `unknown` unless explicitly typed

### @minuta/ui
- Source: `packages/ui/src/components/`
- shadcn/ui components re-exported for all apps
- Styled with Tailwind CSS — do not inline raw colors, use design tokens
- Add new components with the shadcn CLI: `pnpm dlx shadcn@latest add <component>`

### @minuta/ollama-client
- Source: `packages/ollama-client/src/`
- Thin wrapper around Ollama's REST API (TypeScript)
- Used by the desktop frontend for any JS-side Ollama calls (Rust side has its own reqwest client)

---

## Note Output Format

Notes written to Obsidian follow this structure:

```markdown
---
title: Meeting Title
date: YYYY-MM-DD
time: HH:MM
duration: Xm
language: en
whisper_model: base
ollama_model: llama3
tags: [meeting, minuta]
---

## Summary
...

## Key Decisions
...

## Action Items
- [ ] ...

## Transcript
> [!note]- Recording Transcript
> ...
```

Transcript inclusion is controlled by the `transcript_mode` setting: `never`, `always`, or `collapsed` (default).

---

## Settings Reference

| Key | Type | Default | Notes |
|---|---|---|---|
| `vault_path` | string | — | Required — path to Obsidian vault root |
| `output_folder` | string | `"Meetings"` | Subfolder inside vault |
| `whisper_model` | enum | `"base"` | tiny / base / small / large-v3 |
| `ollama_url` | string | `http://localhost:11434` | Ollama base URL |
| `ollama_model` | string | `"llama3"` | Model name as known by Ollama |
| `transcript_mode` | enum | `"collapsed"` | never / always / collapsed |
| `language` | string | `"en"` | UI language (en/de) |

---

## Conventions

### TypeScript
- Strict mode everywhere — no `any`, no `!` non-null assertions without comment justification
- ES modules (`"type": "module"` in all package.json files)
- Use `@minuta/core` types — never redefine them in app code
- Imports: use package aliases (`@minuta/ui`, `@minuta/core`) not relative cross-package paths

### Rust
- Follow existing module structure — add new commands to the appropriate module, not main.rs
- New Tauri commands must be registered in `invoke_handler` in `main.rs`
- Return `Result<T>` using the local `error::Result<T>` alias, not `std::result::Result<T, Box<dyn std::error::Error>>`
- Use `AppError` variants — add new variants to `error.rs` if needed
- Format with `cargo fmt` before committing

### Styling
- Tailwind utility classes only — no inline `style` props unless absolutely necessary
- Dark mode via `dark:` variants (already wired up via `App.tsx` toggle)
- Component additions go in `@minuta/ui`; app-specific one-offs can live in `apps/desktop/src/components/`

### i18n
- All user-facing strings must have entries in both `en.json` and `de.json`
- Use `useTranslation` hook — never hardcode strings in JSX
- Keys: `namespace.section.label` pattern (e.g., `home.recording.start`)
- AI-generated note content language follows Whisper language detection — not the UI language setting

---

## Common Pitfalls

- **Zod:** Always use Zod v3 — v4 breaks `@hookform/resolvers`
- **pnpm only:** Never use npm or yarn. Never commit a `package-lock.json`
- **Whisper audio requirements:** Input must be 16kHz mono F32 — `transcribe.rs` handles resampling, but raw cpal samples are F32/I16 mixed; check `audio.rs` before modifying capture logic
- **Tauri capabilities:** Filesystem and shell plugin permissions are scoped in `src-tauri/capabilities/`. Expand scopes conservatively
- **Cross-package builds:** `@minuta/core` and `@minuta/ui` must be built before the apps. Turbo handles this via `^build` dependency — don't break the dependency graph
- **Blocking in async context:** Whisper inference is CPU-bound — always use `spawn_blocking`, never `.await` it directly in an async Tauri command
- **No cloud:** Nothing in this codebase should make outbound network requests except to `localhost` (Ollama). Enforce this in code review

---

## Context Directory

Use `.context/` (gitignored) to coordinate across agents in the same workspace:

- `.context/todos.md` — active tasks, WIP state, blockers
- `.context/notes.md` — architectural decisions, research findings, cross-agent handoff notes

Write to these files when starting a non-trivial task and when completing one. Check them before starting work.

---

## References

- **Product spec:** `minuta-handover.md` — full feature scope, Obsidian schema, Ollama prompt template
- **User docs:** `README.md`
- **Tauri v2 docs:** https://v2.tauri.app
- **whisper-rs:** https://github.com/tazz4843/whisper-rs
- **Ollama API:** http://localhost:11434/api (local only)
- **shadcn/ui:** https://ui.shadcn.com
