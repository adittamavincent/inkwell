# Inkwell – System‑wide Keystroke Logger for Obsidian 🖋️

> **A lightweight macOS utility that captures your keystrokes system‑wide and
> writes them into an Obsidian note.**
>
> Inkwell runs as a background Tauri app. It records keystrokes across all macOS
> apps (Chrome, Terminal, Slack, WhatsApp, etc.) and, when you opt in, appends
> them to a daily *keylog* note managed by the
> [Cogdex Vault Companion](https://github.com/adittamavincent/cogdex-vault-companion)
> Obsidian plugin.

---

## How it works

1. A CoreGraphics event tap captures every key-down system-wide (requires the
   **Input Monitoring** (or Accessibility) permission in System Settings).
2. Each keystroke is stored locally in a SQLite database under
   `~/Library/Application Support/com.inkwell.app/inkwell.db`.
3. When Cogdex sync is **enabled (opt-in, off by default)**, captured sessions
   are reconstructed into readable text and appended to today's keylog note,
   strictly **below** the `<!-- LOG-BELOW -->` boundary marker that Cogdex
   writes. This keeps Inkwell's output from colliding with anything Cogdex
   writes above the line.

The keylog path mirrors Cogdex's own layout:

```
<Vault>/Daily/YYYY-MM-DD/YYYY-MM-DD - keylog.md
```

i.e. `<dailyFolderRoot>/<day>/<day><keylogSuffix>.md`. The vault root, folder
root, day pattern (`%Y-%m-%d`, the chrono equivalent of Cogdex's `YYYY-MM-DD`),
and keylog suffix are all configurable.

---

## Features

- **System‑wide keystroke capture** – works across all macOS apps.
- **Smart reconstruction** – backspaces, word deletions, and line clears are
  merged so the resulting log mirrors what you actually typed.
- **Optional Cogdex sync** – append sessions to the Cogdex-managed daily keylog
  note, below the `LOG-BELOW` marker. Off by default; enable it from Inkwell's
  settings (`configure_cogdex_sync`).
- **Local-only** – nothing leaves your machine; the database lives in the app
  support folder.

---

## Building & running

The app is a Rust/Tauri project rooted at `tauri-app/`. The frontend
(`tauri-app/frontend/`) is currently a placeholder; the menu-bar UI is not yet
built (see *Missing pieces* below).

```bash
# from the repo root
cd tauri-app
cargo tauri dev      # run in development
cargo tauri build    # produce a macOS .app bundle (target/release)
```

`cargo tauri` requires the Tauri CLI (`cargo install tauri-cli` or
`pnpm dlx @tauri-apps/cli`). On first run, grant the app **Input Monitoring**
permission in **System Settings → Privacy & Security**, then restart it.

---

## Configuration (Cogdex sync)

Sync is opt-in. From the UI (or via the `configure_cogdex_sync` command) set:

- `enabled` – `true` to turn sync on (default `false`).
- `vault_path` – absolute path to your Obsidian vault.
- `daily_folder_root` – default `Daily`.
- `day_pattern` – chrono strftime pattern; default `%Y-%m-%d` (matches Cogdex).
- `keylog_suffix` – default ` - keylog`.
- `idle_timeout_secs` – gap that splits one typing session from the next.

`export_diary` writes the last 7 days of captured keystrokes into the Cogdex
keylog note for the supplied vault, below the `LOG-BELOW` marker.

---

## Missing pieces (not yet implemented)

- Menu-bar UI / settings window to drive `configure_cogdex_sync` interactively.
- Real frontmost-app detection (currently logged as `Unknown`).
- Live streaming (today sync is triggered on demand via `sync_to_cogdex`).

## Development

```bash
cargo check        # type-check the Rust side
cargo test         # run the reconstruction unit tests
```

## License

MIT License
