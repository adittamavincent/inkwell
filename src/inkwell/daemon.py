import os
import sys
import sqlite3
from datetime import datetime, timezone
import Quartz
from AppKit import NSWorkspace

DB_PATH = "/Users/adittama/inkwell.db"
tap = None

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS keystrokes (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            app_name  TEXT,
            key_char  TEXT,
            key_code  INTEGER
        );
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ts ON keystrokes(timestamp);")
    conn.commit()
    conn.close()

def log_keystroke(app_name, key_char, key_code):
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA journal_mode=WAL;")
        timestamp = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "INSERT INTO keystrokes (timestamp, app_name, key_char, key_code) VALUES (?, ?, ?, ?)",
            (timestamp, app_name, key_char, key_code)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error logging to DB: {e}", file=sys.stderr)

def get_key_char(event, key_code):
    flags = Quartz.CGEventGetFlags(event)
    has_cmd = bool(flags & Quartz.kCGEventFlagMaskCommand)
    has_opt = bool(flags & Quartz.kCGEventFlagMaskAlternate)
    has_ctrl = bool(flags & Quartz.kCGEventFlagMaskControl)
    has_shift = bool(flags & Quartz.kCGEventFlagMaskShift)

    special_keys = {
        51: "⌫",
        117: "⌦",
        36: "↵",
        48: "⇥",
        49: " ",
        123: "←",
        124: "→",
        125: "↓",
        126: "↑",
        53: "ESC",
    }

    is_special = key_code in special_keys
    if is_special:
        base = special_keys[key_code]
    else:
        # Get Unicode string representation
        actual_length, characters = Quartz.CGEventKeyboardGetUnicodeString(event, 100, None, None)
        base = characters if actual_length > 0 else ""

    # Determine modifier prefix
    prefix = ""
    if has_cmd or has_opt or has_ctrl:
        if has_cmd: prefix += "⌘"
        if has_opt: prefix += "⌥"
        if has_ctrl: prefix += "⌃"
        if has_shift: prefix += "⇧"

    if prefix:
        if is_special and base == " ":
            return f"[{prefix} ]"
        return f"[{prefix}{base.upper() if not is_special else base}]"
    else:
        if is_special:
            if base == " ":
                return " "
            return f"[{base}]"
        else:
            if has_shift:
                return base.upper()
            return base

def keyboard_callback(proxy, event_type, event, refcon):
    global tap
    if event_type == Quartz.kCGEventTapDisabledByTimeout:
        if tap:
            Quartz.CGEventTapEnable(tap, True)
        return event

    if event_type == Quartz.kCGEventKeyDown:
        try:
            key_code = Quartz.CGEventGetIntegerValueField(event, Quartz.kCGKeyboardEventKeycode)
            
            # Get frontmost app name
            front_app = NSWorkspace.sharedWorkspace().frontmostApplication()
            app_name = front_app.localizedName() if front_app else "Unknown"

            key_char = get_key_char(event, key_code)
            if key_char:
                log_keystroke(app_name, key_char, key_code)
        except Exception as e:
            print(f"Callback error: {e}", file=sys.stderr)

    return event

def main():
    global tap
    init_db()
    print(f"Inkwell daemon started → {DB_PATH}")
    sys.stdout.flush()

    event_mask = (1 << Quartz.kCGEventKeyDown)
    tap = Quartz.CGEventTapCreate(
        Quartz.kCGSessionEventTap,
        Quartz.kCGTailAppendEventTap,
        Quartz.kCGEventTapOptionListenOnly,
        event_mask,
        keyboard_callback,
        None
    )

    if not tap:
        print("Error: CGEventTapCreate failed. Check Input Monitoring permissions.", file=sys.stderr)
        sys.exit(1)

    run_loop_source = Quartz.CFMachPortCreateRunLoopSource(None, tap, 0)
    Quartz.CFRunLoopAddSource(Quartz.CFRunLoopGetCurrent(), run_loop_source, Quartz.kCFRunLoopCommonModes)
    Quartz.CGEventTapEnable(tap, True)
    Quartz.CFRunLoopRun()

if __name__ == "__main__":
    main()
