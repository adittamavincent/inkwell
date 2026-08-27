#!/bin/bash
set -e

PLIST_DEST="$HOME/Library/LaunchAgents/com.inkwell.daemon.plist"

if [ -f "$PLIST_DEST" ]; then
    echo "🛑 Unloading com.inkwell.daemon..."
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
    rm -f "$PLIST_DEST"
    echo "✅ Inkwell daemon successfully uninstalled."
else
    echo "ℹ️ Inkwell daemon plist not found at $PLIST_DEST."
fi
