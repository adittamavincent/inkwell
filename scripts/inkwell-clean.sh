#!/bin/bash
# @raycast.schemaVersion 1
# @raycast.title Inkwell Clean DB
# @raycast.mode compact
# @raycast.argument1 { "type": "text", "placeholder": "days (default 30)", "optional": true }

/opt/homebrew/bin/uv run --cwd /Users/adittama/repositories/Inkwell src/inkwell/clean.py "$1"
