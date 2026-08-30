# Inkwell – System‑wide Keystroke Logger for Obsidian 🖋️

> **A lightweight macOS desktop utility that captures your keystrokes system‑wide and writes them into an Obsidian note.**
>
> Inkwell is built with **Electron + React + Tailwind CSS** with TypeScript.
> It records keystrokes across all macOS apps (Chrome, Terminal, Slack, WhatsApp, etc.) and, when you opt in, appends them to a daily *keylog* note managed by the [Cogdex Vault Companion](https://github.com/adittamavincent/cogdex-vault-companion) Obsidian plugin.

---

## How it works

1. Global keystrokes are captured system-wide via `uiohook-napi` in the Electron main process (requires **Input Monitoring** / Accessibility permission in macOS System Settings).
2. Each keystroke is encrypted at rest with **AES-256-GCM** before being inserted into SQLite (`better-sqlite3` in WAL mode) located in `~/Library/Application Support/com.inkwell.app/inkwell.db`.
   The encryption key lives in a `0600` file (`db.key`) next to the database.
3. When Cogdex sync is **enabled (opt-in, off by default)**, captured sessions are reconstructed into readable text and appended directly to today's dedicated daily keylog note (`<dailyFolderRoot>/<day>/<day><keylogSuffix>.md`).
4. Live UI typing feed reconstructs text in real-time with cursor tracking, arrow navigation, word deletions, and selection overwriting.

The keylog note path mirrors Cogdex:

```text
<Vault>/Daily/YYYY-MM-DD/YYYY-MM-DD - keylog.md
```

i.e. `<dailyFolderRoot>/<day>/<day><keylogSuffix>.md`.

---

## Features

- **System‑wide keystroke capture** – works across all macOS apps.
- **Frontmost‑app detection** – every keystroke is tagged with the active app name (cached for 250ms for zero capture latency).
- **App exclusion** – password managers (1Password, Bitwarden, KeePass, etc.) and Inkwell itself are excluded by default.
- **Encrypted at rest** – AES-256-GCM encrypted database with graceful plaintext degradation fallback.
- **Smart token reconstruction** – backspaces `[⌫]`, forward delete `[⌦]`, word deletions `[⌥⌫]`, line clears `[⌘⌫]`, selection overwriting `[⇧←] [⇧→]`, and select-all `[⌘A]` faithfully reconstruct what you typed.
- **Session grouping** – sessions split automatically on active app switch or idle timeout (default 60s).
- **Collapsible settings drawer** – smooth slide-out panel for Cogdex sync settings.
- **macOS System Tray** – menu bar icon showing real-time capture status with pause/resume controls.

---

## Development & Testing

```bash
pnpm install              # install dependencies
pnpm run dev              # launch Electron + React dev server with HMR
pnpm run test             # run all Vitest unit tests
pnpm run typecheck        # TypeScript typecheck
pnpm run build:renderer   # build renderer & electron main/preload bundles
pnpm run build            # build and package for macOS (.dmg + .zip)
```

---

## Packaging & Releases

Bundling is handled by `electron-builder` targeting macOS Apple Silicon (`arm64`):

```bash
pnpm run build
# or to output unpacked .app directory only:
pnpm run pack
```

### Local Dev Signing Setup

To prevent macOS from revoking Accessibility and Input Monitoring permissions on every local rebuild, Inkwell is signed with a stable local code-signing certificate named `Inkwell Dev`.

#### One-Time Setup:
1. Open **Keychain Access** on macOS.
2. In the menu bar, navigate to **Keychain Access → Certificate Assistant → Create a Certificate...**
3. Configure the certificate:
   - **Name**: `Inkwell Dev`
   - **Identity Type**: `Self Signed Root`
   - **Certificate Type**: `Code Signing`
4. Click **Create**, then **Continue**.

Permissions granted in macOS System Settings will now persist across `pnpm run build` and reinstall cycles.

> **Note**: CI/release builds (`.github/workflows/release.yml`) use Apple Developer ID certificates via the `CSC_NAME` secret, which takes precedence over local signing in CI environments.

#### Permission Reset (Clean Slate):
To completely reset granted TCC permissions for testing:
```bash
pnpm run reset-permissions
```
Or manually:
```bash
tccutil reset Accessibility com.inkwell.app
tccutil reset ListenEvent com.inkwell.app
```

---

## License

MIT
