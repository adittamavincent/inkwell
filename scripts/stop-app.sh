#!/bin/bash

PLIST_DST="$HOME/Library/LaunchAgents/com.inkwell.app.plist"
UID_NUM="$(id -u)"

STOPPED=0

# Stop the launchd-managed instance (the canonical way it runs)
if launchctl list 2>/dev/null | grep -q "com.inkwell.app"; then
    launchctl stop com.inkwell.app 2>/dev/null || true
    launchctl unload "$PLIST_DST" 2>/dev/null || true
    STOPPED=1
fi

# Fallback: kill any orphaned inkwell GUI python processes
if pkill -f "inkwell.app:main" 2>/dev/null; then
    STOPPED=1
fi
pkill -f "inkwell/app.py" 2>/dev/null || true

if [ $STOPPED -eq 1 ]; then
    echo "✅ Inkwell stopped."
else
    echo "ℹ️  No running Inkwell instance found."
fi
