# Minuta

A local-first AI meeting note taker for your Obsidian vault. Record a meeting, get a structured markdown note — all processed on your machine, no cloud required.

## What it does

1. **Record** — captures microphone audio during a meeting
2. **Transcribe** — runs Whisper locally via whisper-rs
3. **Summarize** — sends the transcript to a local Ollama model
4. **Save** — writes a structured markdown file directly to your Obsidian vault

Notes include YAML frontmatter, a summary, key decisions, and action items. The output language matches the transcript language automatically.

## Requirements

- **macOS** (primary target for v0.1)
- [Ollama](https://ollama.ai) running locally (`http://localhost:11434`)
- A Whisper model (e.g. `ggml-base.bin`) placed in `~/.minuta/models/`
- An Obsidian vault on disk

### Pull an Ollama model

```sh
ollama pull llama3.2
```

### Download a Whisper model

```sh
mkdir -p ~/.minuta/models
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin \
  -o ~/.minuta/models/ggml-base.bin
```

## Development

### Prerequisites

- [Rust](https://rustup.rs) (stable)
- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io) 10+
- Tauri v2 CLI: `cargo install tauri-cli --version "^2"`

### Install dependencies

```sh
pnpm install
```

### Run the desktop app

```sh
bash dev.sh
```

`dev.sh` is the canonical dev launcher. It:
- Locates the Homebrew LLVM installation and exports `LIBCLANG_PATH` + prepends LLVM to `PATH` — required at compile time by `whisper-rs` (which uses `bindgen` to generate Rust bindings for Whisper.cpp)
- Starts Ollama in the background if it isn't already running
- Then executes `cargo tauri dev`

**Do not use `pnpm tauri:dev` directly** — it skips the LLVM env setup and the build will fail with a `libclang not found` error unless you've already exported those vars in your shell session.

### Build for production

```sh
pnpm desktop:build
```

## Project structure

```
apps/
  desktop/        # Tauri v2 + React 19 + Vite (main app)
  mobile/         # Tauri Mobile scaffold (v0.x)
  web/            # Next.js 16 scaffold (v0.x)
packages/
  core/           # Shared TypeScript types & schemas
  ollama-client/  # HTTP client for Ollama
  ui/             # shadcn/ui component library
src-tauri/        # Rust backend (audio, transcription, summarization, vault I/O)
```

## Settings

Configured in-app via the Settings page:

| Setting | Description |
|---|---|
| Vault path | Absolute path to your Obsidian vault |
| Output folder | Subfolder inside the vault (default: `Meeting Notes`) |
| Whisper model | `tiny` / `base` / `small` / `large-v3` |
| Ollama URL | Default: `http://localhost:11434` |
| Ollama model | Default: `llama3.2` |
| Transcript | Never / Always / Collapsed |
| Wikilinks | Format links as `[[...]]` |
| Language | English / Deutsch |

## Output format

Each note is saved as `YYYY-MM-DD_HH-mm_Title.md` inside your configured vault folder:

```markdown
---
title: "Weekly Sync"
date: 2026-03-17
duration: "00:23:41"
participants: []
tags: [meeting-notes]
---

## Summary
...

## Key Decisions
- ...

## Action Items
- [ ] ...

## Transcript
...
```

## Roadmap

| Version | Focus |
|---|---|
| v0.1 | Record → Transcribe → Summarize → Obsidian (current) |
| v0.2 | Calendar integration (pre-fill title, participants) |
| v0.3 | Live RAG with LanceDB — search past notes |
| v0.4 | Quick Capture with global hotkey |

## License

[FSL-1.1-Apache-2.0](./LICENSE) — free for personal and self-hosted use. Commercial hosting requires a separate agreement.
