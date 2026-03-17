#!/usr/bin/env bash
# scripts/sync-docs.sh — regenerates auto-managed sections in AGENT.md
#
# Sections are delimited by:
#   <!-- sync:begin:NAME -->
#   <!-- sync:end:NAME -->
#
# Managed sections:
#   tauri-commands  — extracted from #[tauri::command] in src-tauri/src/*.rs
#   settings        — extracted from AppSettings struct + Default impl in settings.rs
#
# Run directly or via the lefthook pre-commit hook.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
AGENT_MD="$REPO/AGENT.md"

python3 - "$REPO" "$AGENT_MD" <<'PYEOF'
import sys, re, pathlib

repo      = pathlib.Path(sys.argv[1])
agent_md  = pathlib.Path(sys.argv[2])

# ── helpers ───────────────────────────────────────────────────────────────────

def replace_section(text, name, new_content):
    pattern = re.compile(
        r'(<!-- sync:begin:' + re.escape(name) + r' -->)'
        r'.*?'
        r'(<!-- sync:end:' + re.escape(name) + r' -->)',
        re.DOTALL,
    )
    replacement = (
        f'<!-- sync:begin:{name} -->\n'
        f'{new_content}\n'
        f'<!-- sync:end:{name} -->'
    )
    new_text, count = pattern.subn(replacement, text)
    if count == 0:
        print(f"  WARNING: sentinel '{name}' not found in {agent_md.name}", file=sys.stderr)
    return new_text

# ── 1. Tauri commands ─────────────────────────────────────────────────────────

commands = []
rs_dir = repo / 'src-tauri' / 'src'
for rs_file in sorted(rs_dir.glob('*.rs')):
    lines = rs_file.read_text().splitlines()
    for i, line in enumerate(lines):
        if '#[tauri::command]' in line:
            # Search up to 10 lines ahead for the fn signature (handles multi-line sigs)
            for j in range(i + 1, min(i + 10, len(lines))):
                m = re.search(r'pub\s+(?:async\s+)?fn\s+(\w+)', lines[j])
                if m:
                    commands.append(m.group(1))
                    break

commands.sort()
tauri_block = '```\n' + '\n'.join(commands) + '\n```'

# ── 2. Settings reference ─────────────────────────────────────────────────────

settings_src = (repo / 'src-tauri' / 'src' / 'settings.rs').read_text()

# Struct fields: pub field_name: TypeName
struct_match = re.search(
    r'pub struct AppSettings\s*\{([^}]+)\}', settings_src, re.DOTALL
)
fields = {}
if struct_match:
    for m in re.finditer(r'pub\s+(\w+)\s*:\s*([^,\n]+)', struct_match.group(1)):
        fields[m.group(1)] = m.group(2).strip()

# Default values from impl Default
default_match = re.search(
    r'impl Default for AppSettings\b.*?Self\s*\{([^}]+)\}', settings_src, re.DOTALL
)
defaults = {}
if default_match:
    for m in re.finditer(r'(\w+)\s*:\s*([^,\n]+)', default_match.group(1)):
        raw = m.group(2).strip()
        raw = re.sub(r'"([^"]+)"\.to_string\(\)', r'"\1"', raw)
        raw = re.sub(r'String::new\(\)', '""', raw)
        defaults[m.group(1)] = raw

rows = ['| Key | Type | Default |', '|---|---|---|']
for field, typ in fields.items():
    default = defaults.get(field, '—')
    rows.append(f'| `{field}` | `{typ}` | `{default}` |')

settings_block = '\n'.join(rows)

# ── Apply ─────────────────────────────────────────────────────────────────────

text = agent_md.read_text()
text = replace_section(text, 'tauri-commands', tauri_block)
text = replace_section(text, 'settings', settings_block)
agent_md.write_text(text)

print(
    f"  sync-docs: {len(commands)} Tauri commands, "
    f"{len(fields)} settings fields → {agent_md.name}"
)
PYEOF
