#!/bin/bash
# @raycast.schemaVersion 1
# @raycast.title Inkwell Diary
# @raycast.mode silent

/opt/homebrew/bin/uv run --cwd /Users/adittama/repositories/Inkwell src/inkwell/diary.py >/dev/null 2>&1
open /Users/adittama/Desktop/writing-history.md
