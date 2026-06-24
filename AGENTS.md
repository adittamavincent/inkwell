# Inkwell — LLM Agent Context

Paste file ini ke awal conversation LLM manapun untuk langsung kerja tanpa perlu jelasin ulang.

---

## Apa ini

macOS keystroke daemon berbasis CGEventTap. Rekam semua yang diketik di app manapun, simpan ke SQLite lokal, tampilkan sebagai diary markdown.

Pet project personal. Bukan produk komersial.

---

## Kenapa dibuat

Screenpipe pakai Accessibility API, bukan CGEventTap. Backspace, delete, modifier keys tidak ter-capture. Terlalu bloated. Inkwell adalah pengganti yang lebih simpel dan tepat sasaran.

---

## Environment

- MacBook Pro M1 Pro 2021, 14 inch, 16 GB
- macOS Tahoe 26
- Username: adittama
- Home: /Users/adittama
- Shell: zsh
- uv: installed via Homebrew
- Raycast + Hyperkey untuk hotkey

---

## Tech stack

- Python 3.11+ dengan uv (BUKAN pip, BUKAN venv manual, BUKAN --break-system-packages)
- pyobjc-framework-Quartz — CGEventTap
- pyobjc-framework-AppKit — deteksi frontmost app
- SQLite WAL mode — storage lokal
- launchd LaunchAgent — daemon runner
- Raycast Script Command — hotkey trigger

---

## Struktur repo (kondisi SEKARANG)

```
/Users/adittama/repositories/Inkwell/
├── AGENTS.md              ← file ini
├── README.md              ← stub, belum diisi
└── pyproject.toml         ← sudah ada, isinya di bawah
```

File yang BELUM ADA dan harus dibuat:

```
src/inkwell/__init__.py
src/inkwell/daemon.py
src/inkwell/diary.py
scripts/inkwell-diary.sh
com.inkwell.daemon.plist
```

JANGAN cari file-file di atas di luar repo. Mereka belum exist. Buat dari scratch berdasarkan spec di bawah.

---

## pyproject.toml (sudah ada, jangan overwrite)

```toml
[project]
name = "inkwell"
version = "0.1.0"
description = "macOS keystroke daemon using CGEventTap"
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
    "pyobjc-framework-Quartz>=10.2",
    "pyobjc-framework-Cocoa>=10.2",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

---

## Database schema

Lokasi: `/Users/adittama/inkwell.db`

```sql
CREATE TABLE IF NOT EXISTS keystrokes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    app_name  TEXT,
    key_char  TEXT,
    key_code  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ts ON keystrokes(timestamp);
```

---

## Spec: daemon.py

Path: `src/inkwell/daemon.py`

Yang harus dilakukan:

- Buat CGEventTap di `kCGSessionEventTap` + `kCGTailAppendEventTap` + `kCGEventTapOptionListenOnly`
- Listen `kCGEventKeyDown` saja
- Handle `kCGEventTapDisabledByTimeout` dengan re-enable tap
- Mapping key_code ke karakter:
  - Huruf/angka/simbol: plaintext
  - Backspace (51): `[⌫]`
  - Forward delete (117): `[⌦]`
  - Enter (36): `[↵]`
  - Tab (48): `[⇥]`
  - Space (49): ` ` (spasi biasa)
  - Arrow keys (123/124/125/126): `[←][→][↓][↑]`
  - Escape (53): `[ESC]`
- Modifier detection via CGEventGetFlags bitmask:
  - Cmd: bit 20 (0x100000)
  - Option: bit 19 (0x80000)
  - Ctrl: bit 18 (0x40000)
  - Shift: bit 17 (0x20000)
- Modifier combos dirender sebagai prefix: `[⌘C]`, `[⌥⌫]`, dst
- Shift + huruf = uppercase, tanpa prefix `[⇧]`
- Ambil frontmost app via `NSWorkspace.sharedWorkspace().frontmostApplication().localizedName()`
- Simpan ke `/Users/adittama/inkwell.db` dengan timestamp ISO 8601 UTC
- Print log ke stdout saat startup: `Inkwell daemon started → /Users/adittama/inkwell.db`

---

## Spec: diary.py

Path: `src/inkwell/diary.py`

Yang harus dilakukan:

- Baca tabel `keystrokes` dari `/Users/adittama/inkwell.db` urut ascending
- Filter hanya 7 hari terakhir: `timestamp >= datetime.now(timezone.utc) - timedelta(days=7)`
- Group jadi sesi: gap lebih dari 120 detik di app yang sama = sesi baru
- Concatenate `key_char` per sesi jadi satu string
- Skip sesi yang setelah di-strip panjangnya kurang dari 5 karakter
- Timestamp ditampilkan dalam local time via `.astimezone()` (bukan UTC)
- Format output per sesi:

  ```
  ## 2026-06-24 14:32 — Arc · Claude

  apa yang diketik di sini...

  ---
  ```

- Tulis ke `/Users/adittama/Desktop/writing-history.md`
- Urut terbaru di atas
- Print: `Done. N sessions written to /Users/adittama/Desktop/writing-history.md`

---

## Spec: clean.py & scripts/inkwell-clean.sh

Path: `src/inkwell/clean.py` & `/Users/adittama/repositories/Inkwell/scripts/inkwell-clean.sh`

- Hapus baris di `keystrokes` yang lebih lama dari N hari (default 30)
- Jalankan `VACUUM` setelah delete
- Raycast command `@raycast.mode compact`, terima 1 parameter opsional (jumlah hari)

---

## Spec: scripts/inkwell-diary.sh

Path: `/Users/adittama/repositories/Inkwell/scripts/inkwell-diary.sh`

```bash
#!/bin/bash
# @raycast.schemaVersion 1
# @raycast.title Inkwell Diary
# @raycast.mode silent

cd /Users/adittama/repositories/Inkwell
/opt/homebrew/bin/uv run src/inkwell/diary.py
open /Users/adittama/Desktop/writing-history.md
```

Permission: chmod +x wajib setelah dibuat.

---

## Spec: com.inkwell.daemon.plist

Path di repo: `/Users/adittama/repositories/Inkwell/com.inkwell.daemon.plist`
Deploy ke: `/Users/adittama/Library/LaunchAgents/com.inkwell.daemon.plist`

Key yang wajib ada:

- Label: `com.inkwell.daemon`
- ProgramArguments: path ke compiled binary `/Users/adittama/repositories/Inkwell/dist/inkwell-daemon`
- WorkingDirectory: `/Users/adittama/repositories/Inkwell`
- RunAtLoad: true
- KeepAlive: true
- StandardOutPath: `/Users/adittama/Library/Logs/inkwell.log`
- StandardErrorPath: `/Users/adittama/Library/Logs/inkwell-error.log`

---

## Permissions yang dibutuhkan

Input Monitoring SAJA. Tidak perlu Screen Recording, Accessibility, Microphone.

```bash
open "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent"
```

Tambahkan compiled binary `/Users/adittama/repositories/Inkwell/dist/inkwell-daemon` ke list, toggle ON.

---

## Cara run development

```bash
cd /Users/adittama/repositories/Inkwell
uv run src/inkwell/daemon.py
```

Ketik sesuatu, cek DB:

```bash
sqlite3 /Users/adittama/inkwell.db \
  "SELECT timestamp, app_name, key_char FROM keystrokes ORDER BY timestamp DESC LIMIT 10;"
```

---

## Cara deploy production

```bash
# cek path uv dulu
which uv

# copy plist
cp /Users/adittama/repositories/Inkwell/com.inkwell.daemon.plist \
   /Users/adittama/Library/LaunchAgents/

# load
launchctl load /Users/adittama/Library/LaunchAgents/com.inkwell.daemon.plist

# verifikasi (harus ada PID, bukan tanda minus)
launchctl list | grep inkwell
```

---

## Raycast setup

1. Raycast Settings → Extensions → Script Commands → Add Directory
2. Pilih `/Users/adittama/repositories/Inkwell/scripts`
3. Command "Inkwell Diary" akan muncul
4. Set hotkey: Hyperkey + Y

---

## Hal yang JANGAN dilakukan

- Jangan pakai pip atau venv, selalu uv
- Jangan cari file source di luar `/Users/adittama/repositories/Inkwell/` — semua dibuat dari scratch
- Jangan swallow keyboard events, selalu listen-only
- Jangan hardcode path uv tanpa cek `which uv` dulu
- Jangan pakai relative path di plist atau Raycast script

---

## Next step

Buat file-file ini secara berurutan:

1. `src/inkwell/__init__.py` (kosong)
2. `src/inkwell/daemon.py`
3. `src/inkwell/diary.py`
4. `scripts/inkwell-diary.sh`
5. `com.inkwell.daemon.plist`

Setelah semua file ada, commit dan push ke GitHub.
