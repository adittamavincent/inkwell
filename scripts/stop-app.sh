#!/bin/bash

PID_FILE="$HOME/.inkwell_app.pid"

STOPPED=0

if [ -f "$PID_FILE" ]; then
    PID="$(cat "$PID_FILE")"
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "🛑 Stopping Inkwell process (PID: $PID)..."
        kill "$PID" 2>/dev/null || true
        rm -f "$PID_FILE"
        STOPPED=1
    fi
fi

# Also kill any orphaned inkwell python processes if found
pkill -f "inkwell.app" 2>/dev/null || true

if [ $STOPPED -eq 1 ]; then
    echo "✅ Inkwell stopped successfully."
else
    echo "ℹ️  No running Inkwell instance found."
fi
