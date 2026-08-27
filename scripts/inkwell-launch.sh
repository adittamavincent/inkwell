#!/bin/bash
# @raycast.schemaVersion 1
# @raycast.title Inkwell Launch
# @raycast.mode silent

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

UV_BIN="$(command -v uv || which uv || echo "/opt/homebrew/bin/uv")"
if [ ! -x "$UV_BIN" ] && [ -f "$HOME/.cargo/bin/uv" ]; then
    UV_BIN="$HOME/.cargo/bin/uv"
fi

PID_FILE="$HOME/.inkwell_app.pid"
LOG_FILE="$HOME/Library/Logs/inkwell.log"
mkdir -p "$HOME/Library/Logs"

if [ -f "$PID_FILE" ]; then
    PID="$(cat "$PID_FILE")"
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "Inkwell is already running (PID: $PID)."
        exit 0
    fi
fi

nohup "$UV_BIN" run inkwell >> "$LOG_FILE" 2>&1 &
echo "$!" > "$PID_FILE"
echo "Inkwell started. Check the Menu Bar!"
