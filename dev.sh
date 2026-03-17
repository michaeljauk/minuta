#!/usr/bin/env bash
# Minuta dev launcher — sets required env vars and starts cargo tauri dev
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
LLVM_PREFIX="$(brew --prefix llvm 2>/dev/null || echo '')"

if [ -z "$LLVM_PREFIX" ] || [ ! -d "$LLVM_PREFIX/lib" ]; then
  echo "Error: LLVM not found. Run: brew install llvm"
  exit 1
fi

export LIBCLANG_PATH="$LLVM_PREFIX/lib"
export PATH="$LLVM_PREFIX/bin:$HOME/.cargo/bin:$PATH"

# Start Ollama if not running
if ! ollama list &>/dev/null 2>&1; then
  echo "Starting Ollama in background…"
  ollama serve &>/tmp/ollama.log &
  sleep 2
fi

cd "$REPO_ROOT"
exec "$HOME/.cargo/bin/cargo" tauri dev
