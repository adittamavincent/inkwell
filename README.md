# Inkwell

macOS keystroke daemon. CGEventTap capture, SQLite storage, diary generation.

---

## Quick Start

### 1. Prerequisites
- macOS Tahoe 26+
- `uv` installed (via Homebrew)
- GitHub CLI `gh` (optional, for remote setup)

### 2. Grant Permissions
EventTap requires **Input Monitoring** permissions.
1. Open System Settings:
   ```bash
   open "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent"
   ```
2. Add and enable `/opt/homebrew/bin/uv` or your terminal app.

---

## Development

### 1. Run Daemon
Start logging keystrokes:
```bash
uv run src/inkwell/daemon.py
```
*Keys are logged to `/Users/adittama/inkwell.db`.*

### 2. Query Database
```bash
sqlite3 ~/inkwell.db "SELECT timestamp, app_name, key_char FROM keystrokes ORDER BY timestamp DESC LIMIT 10;"
```

### 3. Generate Diary
Export session diary to `~/Desktop/writing-history.md`:
```bash
uv run src/inkwell/diary.py
```

---

## Production Deployment (LaunchAgent)

1. Deploy plist:
   ```bash
   cp com.inkwell.daemon.plist ~/Library/LaunchAgents/
   ```
2. Load agent:
   ```bash
   launchctl load ~/Library/LaunchAgents/com.inkwell.daemon.plist
   ```
3. Check status (should display PID):
   ```bash
   launchctl list | grep inkwell
   ```
4. View logs:
   - Stdout: `~/Library/Logs/inkwell.log`
   - Stderr: `~/Library/Logs/inkwell-error.log`

---

## Raycast Setup

1. Open Raycast Settings → Extensions → Script Commands.
2. Click **Add Directory**, choose `/Users/adittama/repositories/Inkwell/scripts`.
3. Trigger "Inkwell Diary" via hotkey (e.g. Hyperkey + Y).
