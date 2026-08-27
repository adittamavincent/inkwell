# Inkwell Keystroke‑to‑File Logger 🖋️

> **A lightweight macOS utility that captures your keystrokes and writes them directly into an Obsidian note**

The Inkwell keystroke‑to‑file logger runs as a background Tauri app. It records everything you type system‑wide (Chrome, Terminal, Slack, etc.) and streams the reconstructed text into a daily *keylog* note in your Obsidian vault. This complements the **Cogdex Vault Companion** plugin, giving you a complete provenance‑aware workflow.

---

## Features

- **System‑wide keystroke capture** – works across all macOS apps.
- **Smart reconstruction** – backspaces, word deletions, and line clears are intelligently merged so the resulting log mirrors what you actually typed.
- **Automatic daily note routing** – each session is appended to `Daily/YYYY‑MM‑DD/2024‑MM‑DD - keylog.md` inside your vault, below the `<!-- LOG‑BELOW -->` marker.
- **Configurable output path** – set the target vault folder and note name in the preferences.
- **Minimal footprint** – lightweight Tauri bundle, no additional runtime dependencies.

---

## Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/adittamavincent/inkwell-keystroke-to-file-logger.git
   cd inkwell-keystroke-to-file-logger
   ```
2. **Install dependencies** (ensure Node 18+ and pnpm are installed)
   ```bash
   pnpm install
   ```
3. **Build the Tauri app**
   ```bash
   pnpm tauri build   # creates a macOS .app bundle in ./src-tauri/target/release
   ```
4. **Run the app**
   ```bash
   pnpm tauri dev    # launches the logger in development mode
   ```
   The app will appear as a menu‑bar icon. Click it to start/stop logging.

---

## Configuration

- **Vault path** – open the app preferences (gear icon) and set the absolute path to your Obsidian vault.
- **Note naming pattern** – default is `Daily/YYYY‑MM‑DD/$(date) - keylog.md`. You can edit the template in `src/settings.ts`.
- **Log boundary** – the logger always appends below the marker `<!-- LOG‑BELOW -->`. Ensure this line exists in your daily keylog note (Cogdex creates it automatically).

---

## Usage

1. Start the logger from the menu bar.
2. Type anywhere on your Mac. The logger silently records your input.
3. Stop the logger when you’re done. The captured text is instantly written to the daily keylog note.
4. Open Obsidian → Daily hub note → scroll to the bottom to see the freshly appended keystrokes.

---

## Development

The project is built with **Tauri** (Rust + WebView) and **TypeScript**.

```bash
# Run the UI in hot‑reload mode
pnpm tauri dev

# Run unit tests (if any)
pnpm test
```

Feel free to explore `src/` – the core logic lives in `src/logger.ts` and the UI components in `src/ui/`.

---

## Contributing

Contributions are welcome! Please:

1. Fork the repo.
2. Create a feature branch.
3. Run `pnpm install && pnpm tauri dev` to verify your changes.
4. Submit a pull request with a clear description of what you changed.

All code follows the repository’s ESLint configuration and the Tauri best‑practice guidelines.

---

## License

MIT License
