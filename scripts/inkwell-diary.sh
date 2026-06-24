#!/bin/bash
# @raycast.schemaVersion 1
# @raycast.title Inkwell Diary
# @raycast.mode silent

cd /Users/adittama/repositories/Inkwell
/opt/homebrew/bin/uv run src/inkwell/diary.py >/dev/null 2>&1
open /Users/adittama/Desktop/writing-history.md
