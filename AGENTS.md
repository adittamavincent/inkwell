# Inkwell — LLM Agent Context

Paste file ini ke awal conversation LLM manapun untuk langsung kerja tanpa perlu jelasin ulang.

---

## Apa ini

Inkwell adalah macOS keystroke daemon berbasis CGEventTap. Tujuannya satu: rekam semua yang diketik user di app manapun, simpan ke SQLite lokal, dan sediakan cara mudah untuk lihat histori tersebut.

Ini pet project personal, bukan produk komersial.

---

## Kenapa dibuat

Awalnya mencoba screenpipe (open source Rewind alternative) untuk tujuan yang sama. Tapi screenpipe pakai Accessibility API bukan CGEventTap, sehingga backspace, delete, dan modifier keys tidak ter-capture. Terlalu bloated untuk kebutuhan sederhana ini. Inkwell adalah pengganti yang jauh lebih simpel dan tepat sasaran.

---

## Tech stack

- Python 3 dengan uv/uvx sebagai package manager (bukan pip, bukan venv manual)
- pyobjc-framework-Quartz untuk CGEventTap
- pyobjc-framework-AppKit untuk deteksi frontmost app
- SQLite sebagai storage (WAL mode)
- LaunchAgent (launchd) sebagai daemon runner di macOS
- Raycast Script Command untuk trigger viewer via hotkey

Tidak ada server, tidak ada cloud, tidak ada dependency eksternal selain pyobjc.

---

## Environment

- MacBook Pro M1 Pro 2021, 14 inch, 16 GB unified memory
- macOS Tahoe 26
- Shell: zsh
- uv installed via Homebrew
- Raycast + Hyperkey untuk hotkey management
- Username: adittama

---

## Arsitektur

```
inkwell/
├── AGENTS.md              ← file ini
├── README.md
├── pyproject.toml         ← uv project config
├── src/
│   └── inkwell/
│       ├── daemon.py      ← CGEventTap daemon, tulis ke DB
│       └── diary.py       ← baca DB, output writing-history.md
├── scripts/
│   └── inkwell-diary.sh   ← Raycast Script Command wrapper
└── com.inkwell.daemon.plist ← LaunchAgent template
```

---

## Database schema

Lokasi: `~/inkwell.db`

```sql
CREATE TABLE keystrokes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,  -- ISO 8601 UTC
    app_name  TEXT,
    key_char  TEXT,           -- rendered character atau simbol [⌫][⌘C] dst
    key_code  INTEGER
);
CREATE INDEX idx_ts ON keystrokes(timestamp);
```

---

## Key design decisions

- CGEventTap di `kCGSessionEventTap` + `kCGTailAppendEventTap` + `kCGEventTapOptionListenOnly` — listen only, tidak intercept/swallow events
- Timestamp disimpan UTC, ditampilkan dalam local time (WIB, UTC+7) via `.astimezone()`
- Key rendering: huruf biasa jadi plaintext, special keys jadi simbol unicode ([⌫][↵][⇥] dst), modifier combos jadi [⌘C][⌥⌫] dst
- Session grouping di diary: gap lebih dari 120 detik di app yang sama = sesi baru
- Daemon auto-restart via `KeepAlive: true` di LaunchAgent

---

## macOS permissions yang dibutuhkan

- Input Monitoring — wajib untuk CGEventTap keyboard capture
- Tidak butuh Screen Recording, tidak butuh Accessibility, tidak butuh Microphone

Buka via:
```bash
open "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent"
```

---

## Cara run (development)

```bash
cd ~/repos/inkwell
uv run src/inkwell/daemon.py
```

Cek data masuk:
```bash
sqlite3 ~/inkwell.db "SELECT timestamp, app_name, key_char FROM keystrokes ORDER BY timestamp DESC LIMIT 10;"
```

Generate diary:
```bash
uv run src/inkwell/diary.py
# output: ~/Desktop/writing-history.md
```

---

## Cara deploy (production)

Copy plist ke LaunchAgents, update path sesuai lokasi uv:
```bash
cp com.inkwell.daemon.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.inkwell.daemon.plist
```

Cek status:
```bash
launchctl list | grep inkwell
# kolom pertama harus PID angka, bukan tanda minus
```

---

## Raycast integration

Hotkey: Hyperkey + Y
Script: `scripts/inkwell-diary.sh`
Mode: silent
Aksi: jalankan diary.py lalu buka writing-history.md

---

## Status saat ini

- [ ] daemon.py — draft ada, belum pakai uv/pyproject.toml
- [ ] diary.py — belum dibuat untuk Inkwell (masih versi screenpipe lama)
- [ ] pyproject.toml — belum dibuat
- [ ] LaunchAgent plist — belum dibuat
- [ ] Raycast script — belum dibuat
- [ ] README.md — belum dibuat

Next step: scaffold pyproject.toml dan daemon.py dengan uv.

---

## Hal yang JANGAN dilakukan

- Jangan pakai pip install manual atau venv manual, selalu pakai uv
- Jangan pakai screenpipe atau Accessibility API untuk keyboard capture
- Jangan simpan password, API key, atau konten dari password manager (Secure Keyboard Entry otomatis block CGEventTap, tapi tetap perlu diingat)
- Jangan intercept/swallow events, selalu listen only
