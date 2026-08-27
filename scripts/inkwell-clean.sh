#!/bin/bash
# @raycast.schemaVersion 1
# @raycast.title Inkwell Clean DB
# @raycast.mode compact
# @raycast.argument1 { "type": "text", "placeholder": "days (default 30)", "optional": true }

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

UV_BIN="$(command -v uv || which uv || echo "/opt/homebrew/bin/uv")"
if [ ! -x "$UV_BIN" ] && [ -f "$HOME/.cargo/bin/uv" ]; then
    UV_BIN="$HOME/.cargo/bin/uv"
fi

"$UV_BIN" run src/inkwell/clean.py "$1"
