#!/bin/bash
# @raycast.schemaVersion 1
# @raycast.title Inkwell Launch
# @raycast.mode silent

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_SRC="$DIR/com.inkwell.app.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.inkwell.app.plist"
LOG_DIR="$HOME/Library/Logs"
mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

# Always refresh the installed plist from the repo copy
cp "$PLIST_SRC" "$PLIST_DST"

UID_NUM="$(id -u)"

# Load the agent into launchd if it isn't loaded yet.
if ! launchctl list 2>/dev/null | grep -q "com.inkwell.app"; then
    launchctl load "$PLIST_DST" 2>/dev/null || true
fi

# (Re)start it under launchd. This makes the process a child of launchd,
# NOT of this terminal — so closing the terminal can never kill it.
if launchctl kickstart -k "gui/$UID_NUM/com.inkwell.app" 2>/dev/null; then
    :
elif launchctl start com.inkwell.app 2>/dev/null; then
    :
else
    echo "Inkwell failed to start — check $LOG_DIR/inkwell-app-error.log"
    exit 1
fi

echo "Inkwell launched via launchd. You can safely close this terminal — it keeps running."
