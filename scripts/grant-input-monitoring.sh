#!/bin/bash
# @raycast.schemaVersion 1
# @raycast.title Inkwell Grant Input Monitoring
# @raycast.mode silent

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

PYBIN="$DIR/.venv/bin/python3"
if [ ! -x "$PYBIN" ]; then
    UV_BIN="$(command -v uv || echo /opt/homebrew/bin/uv)"
    "$UV_BIN" run python -c "import sys; print(sys.executable)"
    PYBIN="$("$UV_BIN" run python -c "import sys; print(sys.executable)")"
fi

echo "This binary needs Input Monitoring permission:"
echo "  $PYBIN"
echo ""
echo "Open System Settings → Privacy & Security → Input Monitoring,"
echo "find the python3 entry above, toggle it ON, then Quit & relaunch Inkwell."
echo ""

# Open the Input Monitoring pane
open "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent"

# Reveal the binary in Finder (so it can be dragged into the list if absent)
open -R "$PYBIN"
