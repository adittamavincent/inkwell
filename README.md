# Inkwell 🖋️

> **Ambient Keystroke & Writing Journal for macOS**

Inkwell captures your typing flow across macOS applications in the background, reconstructs your editing sessions into clean prose, and exports ambient writing diaries directly to your Desktop or your **Obsidian** daily hub notes (paired seamlessly with the [Cogdex](https://github.com/adittamavincent/cogdex-vault-companion) plugin).

---

## Features

- **🖋️ Menu Bar Status App**: Sits quietly in your macOS top menu bar. Live recording status, one-click pause/resume, and direct export actions.
- **⚡ System-Wide Capture**: Powered by macOS `CGEventTap` (Quartz/Cocoa) to log keystrokes seamlessly across Chrome, Cursor, Slack, WhatsApp, Terminal, and Obsidian.
- **🧠 Smart Text Reconstruction**: Intelligently models backspaces, deletions, word erasures (`⌥⌫`), line clears (`⌘⌫`), and select-all replacements (`⌘A`) into readable paragraphs.
- **📓 Desktop Diary Export**: Export 7-day writing history to `~/Desktop/writing-history.md`.
- **💎 Obsidian / Cogdex Integration**: One-click sync to your active Obsidian vault under `Daily/YYYY-MM-DD/YYYY-MM-DD - keylog.md` below the `<!-- LOG-BELOW -->` boundary.
- **🔒 Privacy First**: Everything stays 100% offline in your local SQLite database (`~/inkwell.db`). No cloud telemetry.

---

## Quick Start

### 1. Prerequisites
- macOS 12+
- `uv` installed (`brew install uv`)
- Python 3.11+

### 2. Permissions
`CGEventTap` requires macOS **Input Monitoring** permissions:
1. Open **System Settings → Privacy & Security → Input Monitoring**.
2. Add your Terminal application or the compiled `Inkwell.app`.
3. Ensure the toggle is switched **ON**.

### 3. Run the Menu Bar App
```bash
uv run inkwell
```
You will see the 🖋️ icon appear in your macOS menu bar!

---

## Menu Bar Actions

- **● Logging Active / ⏸ Paused**: View current recording state.
- **Pause / Resume Recording**: Temporarily halt keylogging during private sessions.
- **Generate Diary (Desktop)**: Export and open `~/Desktop/writing-history.md`.
- **Sync to Obsidian Keylog**: Automatically format and append today's typing history to your configured Obsidian vault note.
- **Set Obsidian Vault Path...**: Native folder picker to configure your Obsidian vault root directory.
- **Clean Database...**: Prune records older than 30 days and vacuum SQLite.
- **Reveal inkwell.db in Finder**: Quick access to your database file.

---

## Companion Obsidian Plugin

Inkwell pairs seamlessly with **[Cogdex Vault Companion](https://github.com/adittamavincent/cogdex-vault-companion)** for Obsidian:
- In Obsidian Settings → **Cogdex Vault Companion** → Enable **Inkwell Companion App Sync**.
- Obsidian will automatically and continuously ingest ambient keystrokes logged by Inkwell without needing manual export.

---

## Building Standalone macOS App Bundle

To compile Inkwell into a native `.app`:
```bash
uv run --with pyinstaller pyinstaller --windowed --name Inkwell src/inkwell/app.py
```
Move `dist/Inkwell.app` to `/Applications` or your User Applications folder.

---

## License

MIT License
