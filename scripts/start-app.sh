#!/bin/bash

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
        echo "ℹ️  Inkwell is already running in background (PID: $PID)."
        exit 0
    fi
fi

echo "🚀 Starting Inkwell in the background..."
nohup "$UV_BIN" run inkwell >> "$LOG_FILE" 2>&1 &
APP_PID=$!
echo "$APP_PID" > "$PID_FILE"

echo "✅ Inkwell is now running in the background (PID: $APP_PID)."
echo "🖋️ Check your macOS Menu Bar!"
