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
bash dev.sh                    # start Tauri + Vite dev server (canonical)
```

**Why `dev.sh` and not `pnpm tauri:dev`?**
`whisper-rs` uses `bindgen` to generate Rust→C++ bindings for Whisper.cpp at compile time. `bindgen` requires `libclang`, which on macOS comes from Homebrew LLVM — not the system Clang. `dev.sh` exports `LIBCLANG_PATH` and prepends LLVM to `PATH` before invoking `cargo tauri dev`. It also starts Ollama if it isn't already running. Skipping it causes a `libclang not found` compile error.

### Useful scripts
```sh
bash dev.sh                    # canonical dev start (LLVM env + Ollama guard + tauri dev)
pnpm desktop:build             # production build (Vite + cargo)
pnpm typecheck                 # type-check all packages
pnpm lint                      # lint all packages
```

> `pnpm tauri:dev` / `pnpm desktop:dev` work only if `LIBCLANG_PATH` and the LLVM `bin/` directory are already exported in your shell session. Prefer `dev.sh`.

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

<!-- sync:begin:tauri-commands -->
```
load_settings
save_note
save_settings
start_recording
stop_recording
summarize_transcript
transcribe_audio
```
<!-- sync:end:tauri-commands -->

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

> Auto-generated from `AppSettings` in `src-tauri/src/settings.rs`. Run `bash scripts/sync-docs.sh` (or commit — lefthook does it automatically) to regenerate after struct changes.

<!-- sync:begin:settings -->
| Key | Type | Default |
|---|---|---|
| `vault_path` | `String` | `""` |
| `output_folder` | `String` | `"meetings"` |
| `whisper_model` | `String` | `"base"` |
| `ollama_base_url` | `String` | `"http://localhost:11434"` |
| `ollama_model` | `String` | `"llama3"` |
| `openai_api_key` | `Option<String>` | `None` |
| `anthropic_api_key` | `Option<String>` | `None` |
| `wikilink_attendees` | `bool` | `true` |
| `transcript_mode` | `String` | `"collapsed"` |
| `language` | `String` | `"en"` |
<!-- sync:end:settings -->

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

## Documentation Maintenance

### What is auto-synced

`scripts/sync-docs.sh` regenerates two sections in this file from Rust source. It runs automatically on every commit (lefthook pre-commit). You can also run it manually:

```sh
bash scripts/sync-docs.sh
```

| Sentinel | Source | What it tracks |
|---|---|---|
| `tauri-commands` | `src-tauri/src/*.rs` — all `#[tauri::command]` fns | Every command available via `invoke()` |
| `settings` | `src-tauri/src/settings.rs` — `AppSettings` struct + `Default` impl | All settings keys, their Rust types, and default values |

**Do not edit content between `<!-- sync:begin:* -->` and `<!-- sync:end:* -->` markers by hand.** Your changes will be overwritten on the next commit.

### What agents must update manually

When you make any of the following changes, update the relevant doc section before committing:

| Change | Update |
|---|---|
| Add/remove a Rust module | `Repository Layout` tree in this file |
| Add a new npm/pnpm script to `package.json` | `Dev Workflow → Useful scripts` in this file |
| Change audio pipeline / WAV format requirements | `Common Pitfalls → Whisper audio requirements` |
| Change Tauri capability scopes | `Common Pitfalls → Tauri capabilities` |
| Add a new cross-package dependency | `Shared Packages` section |
| Make an architectural decision | `.context/notes.md` — add a dated entry |
| Discover a new footgun | `Common Pitfalls` |

### .context/ is a living document

Always append to `.context/notes.md` when you make a non-obvious architectural decision. Always update `.context/todos.md` when starting and finishing a task. These files are the primary handoff mechanism between agents.

---

## Common Pitfalls

- **Dev start:** Always use `bash dev.sh`, never `pnpm tauri:dev` directly — the latter skips the LLVM env setup that `whisper-rs`/`bindgen` requires
- **LIBCLANG_PATH:** If you ever run `cargo` commands manually (e.g. `cargo check`, `cargo clippy`), export these first: `export LIBCLANG_PATH=$(brew --prefix llvm)/lib && export PATH=$(brew --prefix llvm)/bin:$PATH`
- **Ollama must be running:** `dev.sh` guards this, but if you start the app another way and Ollama is down, summarization will silently fail at runtime
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
