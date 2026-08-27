#!/bin/bash
# @raycast.schemaVersion 1
# @raycast.title Inkwell Diary
# @raycast.mode silent

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"
/opt/homebrew/bin/uv run src/inkwell/diary.py >/dev/null 2>&1
open "$HOME/Desktop/writing-history.md"
