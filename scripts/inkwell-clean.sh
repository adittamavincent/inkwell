#!/bin/bash
# @raycast.schemaVersion 1
# @raycast.title Inkwell Clean DB
# @raycast.mode compact
# @raycast.argument1 { "type": "text", "placeholder": "days (default 30)", "optional": true }

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"
/opt/homebrew/bin/uv run src/inkwell/clean.py "$1"
