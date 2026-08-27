#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UV_BIN="$(command -v uv || which uv || echo "/opt/homebrew/bin/uv")"
if [ ! -x "$UV_BIN" ] && [ -f "$HOME/.cargo/bin/uv" ]; then
    UV_BIN="$HOME/.cargo/bin/uv"
fi

if [ ! -x "$UV_BIN" ]; then
    echo "❌ Error: 'uv' executable not found. Please install uv (e.g. brew install uv or curl -LsSf https://astral.sh/uv/install.sh)."
    exit 1
fi

PLIST_DEST="$HOME/Library/LaunchAgents/com.inkwell.daemon.plist"
LOG_DIR="$HOME/Library/Logs"
mkdir -p "$LOG_DIR"
mkdir -p "$HOME/Library/LaunchAgents"

echo "📦 Generating LaunchAgent plist at $PLIST_DEST..."

cat <<EOF > "$PLIST_DEST"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.inkwell.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>$UV_BIN</string>
        <string>run</string>
        <string>src/inkwell/daemon.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/inkwell.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/inkwell-error.log</string>
</dict>
</plist>
EOF

# Unload previous instance if loaded
launchctl unload "$PLIST_DEST" 2>/dev/null || true

echo "🚀 Loading com.inkwell.daemon into launchd..."
launchctl load "$PLIST_DEST"

echo "✅ Inkwell daemon successfully installed and loaded!"
echo ""
echo "⚠️  Important: Ensure macOS has granted Input Monitoring permissions:"
echo "   Open System Settings → Privacy & Security → Input Monitoring"
echo "   Ensure Terminal / Python / your runner is enabled."
