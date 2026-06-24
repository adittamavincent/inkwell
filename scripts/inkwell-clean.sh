#!/bin/bash
# @raycast.schemaVersion 1
# @raycast.title Inkwell Clean DB
# @raycast.mode compact
# @raycast.argument1 { "type": "text", "placeholder": "days (default 30)", "optional": true }

cd /Users/adittama/repositories/Inkwell
/opt/homebrew/bin/uv run src/inkwell/clean.py "$1"
