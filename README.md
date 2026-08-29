# Inkwell – System‑wide Keystroke Logger for Obsidian 🖋️

> **A lightweight macOS utility that captures your keystrokes system‑wide and writes them into an Obsidian note.**
>
> Inkwell is a **pure‑Rust desktop app** built with the [`iced`](https://github.com/iced-rs/iced) GUI framework — no Tauri, no web frontend.
> It records keystrokes across all macOS apps (Chrome, Terminal, Slack, WhatsApp, etc.) and, when you opt in, appends them to a daily *keylog* note managed by the [Cogdex Vault Companion](https://github.com/adittamavincent/cogdex-vault-companion) Obsidian plugin.

---

## How it works

1. A CoreGraphics event tap captures every key-down system-wide (requires the **Input Monitoring** (or Accessibility) permission in System Settings).
2. Each keystroke is encrypted at rest (AES‑256‑GCM) and stored locally in a SQLite database under `~/Library/Application Support/com.inkwell.app/`.
   The encryption key lives in a `0600` file next to the database, so anyone who can only read the `.db` file sees ciphertext, not keystrokes.
3. When Cogdex sync is **enabled (opt-in, off by default)**, captured sessions are reconstructed into readable text and appended to today's keylog note, strictly **below** the `<!-- LOG-BELOW -->` boundary marker that Cogdex writes.
   This keeps Inkwell's output from colliding with anything Cogdex writes above the line.

The keylog path mirrors Cogdex's own layout:

```
<Vault>/Daily/YYYY-MM-DD/YYYY-MM-DD - keylog.md
```

i.e. `<dailyFolderRoot>/<day>/<day><keylogSuffix>.md`.
The vault root, folder root, day pattern (`%Y-%m-%d`, the chrono equivalent of Cogdex's `YYYY-MM-DD`), keylog suffix, and idle timeout are all configurable from the app's UI.

---

## Features

- **System‑wide keystroke capture** – works across all macOS apps.
- **Frontmost‑app aware** – every keystroke is tagged with the name of the app it was typed into, so sessions can be filtered after the fact.
- **App exclusion** – password managers and any other apps you list are skipped at capture time and never reach the log (configurable from the UI; ships with common password managers excluded by default).
- **Encrypted at rest** – captured keystrokes are stored AES‑256‑GCM encrypted on disk.
- **Smart reconstruction** – backspaces, word deletions, and line clears are merged so the resulting log mirrors what you actually typed.
- **Optional Cogdex sync** – append sessions to the Cogdex-managed daily keylog note, below the `LOG-BELOW` marker. Off by default; toggle and configure it from Inkwell's settings UI.
- **Local-only** – nothing leaves your machine; the database lives in the app support folder.

---

## Building & running

Inkwell is a single Rust binary crate (no separate frontend).

```bash
cargo run --release          # build + launch the GUI
cargo check                  # type-check only
cargo test                   # run the reconstruction unit tests
```

### Packaging a native macOS `.app` / `.dmg`

Bundling is handled by [`cargo-packager`](https://github.com/crabnebula-dev/cargo-packager) (replacing the old Tauri CLI bundler).
Configuration lives in the `[package.metadata.packager]` section of `Cargo.toml`, and the icon is `icons/icon.icns`.

```bash
rustup target add aarch64-apple-darwin     # Apple Silicon (host on M-series Macs)
cargo install cargo-packager --locked       # install the packager once
cargo packager --release                    # produces .app + .dmg for the host arch
# explicitly target Apple Silicon from any machine:
cargo packager --release --target aarch64-apple-darwin
```

Output lands in `target/aarch64-apple-darwin/release/`:

```
target/aarch64-apple-darwin/release/Inkwell.app
target/aarch64-apple-darwin/release/Inkwell_0.1.0_aarch64.dmg
```

The bundle is **not code-signed** by default, so macOS Gatekeeper will block the first launch.
Open it via right‑click → *Open*, or run `xattr -dr com.apple.quarantine target/aarch64-apple-darwin/release/Inkwell.app`.
For distribution, set `signing-identity` under `[package.metadata.packager.macos]` and notarize.

On first run, grant the app **Input Monitoring** permission in **System Settings → Privacy & Security**, then restart it.

---

## Configuration (Cogdex sync)

Sync is opt-in and configured entirely from the app's UI, which maps 1:1 onto the fields of `sync::CogdexSyncConfig` (defaults are read dynamically via `sync::config_snapshot()` — nothing is hardcoded):

- **Enable Cogdex sync** – toggle to turn sync on (default off).
- **Vault Path** – absolute path to your Obsidian vault.
- **Daily Root** – default `Daily`.
- **Day Pattern** – chrono strftime pattern; default `%Y-%m-%d` (matches Cogdex).
- **Keylog Suffix** – default ` - keylog`.
- **Idle Timeout (seconds)** – gap that splits one typing session from the next.
- **Excluded apps** – comma‑separated app names whose keystrokes are never captured (e.g. `1Password, Bitwarden`). Case‑insensitive; common password managers are excluded by default.

Press *Apply Sync Settings* to persist, then *Force Sync* to push captured keystrokes into today's keylog note (below the `LOG-BELOW` marker).

---

## Known limitations

- **Sync is on demand** (triggered by *Force Sync*), not live-streamed.
- **Encryption key** is stored in a local `0600` file, not the macOS Keychain. This keeps keystrokes confidential from any process that can only read the database file, but a process running as your user can still read the key. For stronger protection, move the key into the Keychain.

## License

MIT License
