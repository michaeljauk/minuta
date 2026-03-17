#!/usr/bin/env bash
# Minuta v0.1 — full dev environment setup (macOS / Apple Silicon)
# Run once: bash setup.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
MODEL_DIR="$HOME/Library/Application Support/com.minuta.app/models"

print_step() { echo -e "\n\033[1;34m▶ $1\033[0m"; }
print_ok()   { echo -e "\033[1;32m✓ $1\033[0m"; }
print_warn() { echo -e "\033[1;33m⚠ $1\033[0m"; }

# ── 1. Homebrew dependencies ──────────────────────────────────────────────────
print_step "Checking Homebrew dependencies (llvm)"
if brew list llvm &>/dev/null; then
  print_ok "llvm already installed"
else
  brew install llvm
  print_ok "llvm installed"
fi

LLVM_PREFIX="$(brew --prefix llvm)"
export LIBCLANG_PATH="$LLVM_PREFIX/lib"
export PATH="$LLVM_PREFIX/bin:$PATH"

# ── 2. Rust ───────────────────────────────────────────────────────────────────
print_step "Checking Rust"
if command -v rustup &>/dev/null; then
  print_ok "rustup already installed"
elif [ -f "$HOME/.cargo/bin/rustup" ]; then
  export PATH="$HOME/.cargo/bin:$PATH"
  print_ok "rustup found at ~/.cargo/bin"
else
  print_step "Installing Rust via rustup"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
  export PATH="$HOME/.cargo/bin:$PATH"
  print_ok "Rust installed"
fi

export PATH="$HOME/.cargo/bin:$PATH"
rustup default stable
rustup target add aarch64-apple-darwin
print_ok "Rust $(rustc --version)"

# ── 3. tauri-cli ─────────────────────────────────────────────────────────────
print_step "Checking tauri-cli"
if "$HOME/.cargo/bin/cargo" install --list 2>/dev/null | grep -q "^tauri-cli"; then
  print_ok "tauri-cli already installed"
else
  LIBCLANG_PATH="$LLVM_PREFIX/lib" \
    "$HOME/.cargo/bin/cargo" install tauri-cli --version "^2" --locked
  print_ok "tauri-cli installed"
fi

# ── 4. pnpm install ───────────────────────────────────────────────────────────
print_step "Installing Node.js dependencies"
cd "$REPO_ROOT"
pnpm install
print_ok "pnpm install done"

# ── 5. Whisper base model ─────────────────────────────────────────────────────
print_step "Setting up Whisper base model"
mkdir -p "$MODEL_DIR"

MODEL_PATH="$MODEL_DIR/ggml-base.bin"
if [ -f "$MODEL_PATH" ]; then
  print_ok "Whisper base model already present at: $MODEL_PATH"
else
  echo "Downloading ggml-base.bin (~142 MB)…"
  curl -L \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin" \
    -o "$MODEL_PATH" \
    --progress-bar
  print_ok "Model downloaded to: $MODEL_PATH"
fi

# ── 6. Ollama ─────────────────────────────────────────────────────────────────
print_step "Checking Ollama"
if ! command -v ollama &>/dev/null; then
  print_warn "ollama not found — install from https://ollama.com and re-run"
  exit 1
fi

if ! ollama list &>/dev/null; then
  echo "Starting ollama serve in background…"
  ollama serve &>/tmp/ollama.log &
  sleep 3
fi

if ollama list 2>/dev/null | grep -q "^llama3"; then
  print_ok "llama3 already pulled"
else
  echo "Pulling llama3 (~4 GB — this takes a while)…"
  ollama pull llama3
  print_ok "llama3 ready"
fi

# ── 7. Done ───────────────────────────────────────────────────────────────────
cat <<'EOF'

┌──────────────────────────────────────────────────────────────┐
│  Setup complete! Start the dev build:                        │
│                                                              │
│    cd $(git rev-parse --show-toplevel)                       │
│    source ~/.cargo/env                                       │
│    export LIBCLANG_PATH=$(brew --prefix llvm)/lib            │
│    export PATH=$(brew --prefix llvm)/bin:$PATH               │
│    ollama serve &                                            │
│    cargo tauri dev                                           │
│                                                              │
│  Or use the dev.sh wrapper (created by this script):        │
│    bash dev.sh                                               │
└──────────────────────────────────────────────────────────────┘
EOF
