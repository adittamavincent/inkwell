import os
import sys
import sqlite3
import re
from datetime import datetime, timedelta, timezone

DB_PATH = os.path.expanduser("~/inkwell.db")
OUTPUT_PATH = os.path.expanduser("~/Desktop/writing-history.md")
BOUNDARY_MARKER = "<!-- LOG-BELOW — external tools may only append below this line -->"

def delete_selection(buffer, sel):
    start, end = min(sel), max(sel)
    del buffer[start:end]
    return start

def reconstruct_text(chars: list[str]) -> tuple[str, bool]:
    buffer = []
    cursor = 0
    selection = None
    contains_undo = False

    for token in chars:
        if not token:
            continue
        
        # Check if plain character (1 char and not '[')
        if len(token) == 1 and token != '[':
            if selection is not None:
                cursor = delete_selection(buffer, selection)
                selection = None
            buffer.insert(cursor, token)
            cursor += 1
        elif token == "[⌫]":
            if selection is not None:
                cursor = delete_selection(buffer, selection)
                selection = None
            else:
                if cursor > 0:
                    del buffer[cursor - 1]
                    cursor -= 1
        elif token == "[⌦]":
            if selection is not None:
                cursor = delete_selection(buffer, selection)
                selection = None
            else:
                if cursor < len(buffer):
                    del buffer[cursor]
        elif token == "[↵]":
            if selection is not None:
                cursor = delete_selection(buffer, selection)
                selection = None
            buffer.insert(cursor, "\n")
            cursor += 1
        elif token == "[←]":
            cursor = max(0, cursor - 1)
            selection = None
        elif token == "[→]":
            cursor = min(len(buffer), cursor + 1)
            selection = None
        elif token == "[↑]" or token == "[↓]":
            pass
        elif token == "[⇥]":
            if selection is not None:
                cursor = delete_selection(buffer, selection)
                selection = None
            buffer.insert(cursor, "\t")
            cursor += 1
        elif token == "[⌘A]":
            selection = (0, len(buffer))
        elif token == "[⇧←]":
            anchor = selection[0] if selection is not None else cursor
            new_cursor = max(0, cursor - 1)
            selection = (anchor, new_cursor) if anchor != new_cursor else None
            cursor = new_cursor
        elif token == "[⇧→]":
            anchor = selection[0] if selection is not None else cursor
            new_cursor = min(len(buffer), cursor + 1)
            selection = (anchor, new_cursor) if anchor != new_cursor else None
            cursor = new_cursor
        elif token == "[⌘⌫]":
            if selection is not None:
                cursor = delete_selection(buffer, selection)
                selection = None
            else:
                newline_idx = -1
                for i in range(cursor - 1, -1, -1):
                    if buffer[i] == "\n":
                        newline_idx = i
                        break
                start = newline_idx + 1
                del buffer[start:cursor]
                cursor = start
        elif token == "[⌥⌫]":
            if selection is not None:
                cursor = delete_selection(buffer, selection)
                selection = None
            else:
                start = cursor
                while start > 0 and buffer[start - 1].isspace():
                    start -= 1
                if start > 0:
                    if buffer[start - 1].isalnum():
                        while start > 0 and buffer[start - 1].isalnum():
                            start -= 1
                    else:
                        start -= 1
                del buffer[start:cursor]
                cursor = start
        elif token == "[⌘Z]":
            contains_undo = True
        elif token.startswith("[") and token.endswith("]"):
            pass
        else:
            if selection is not None:
                cursor = delete_selection(buffer, selection)
                selection = None
            for char in token:
                buffer.insert(cursor, char)
                cursor += 1

    return "".join(buffer), contains_undo

def read_sessions(days: int = 7, target_date_str: str | None = None) -> list[dict]:
    if not os.path.exists(DB_PATH):
        return []

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        if target_date_str:
            # Filter specifically for target date (e.g. YYYY-MM-DD in local time)
            cursor.execute(
                "SELECT timestamp, app_name, key_char FROM keystrokes ORDER BY timestamp ASC"
            )
        else:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
            cursor.execute(
                "SELECT timestamp, app_name, key_char FROM keystrokes WHERE timestamp >= ? ORDER BY timestamp ASC",
                (cutoff,)
            )
        rows = cursor.fetchall()
    except sqlite3.OperationalError as e:
        print(f"Database error: {e}")
        return []
    finally:
        conn.close()

    sessions = []
    current_session = None

    for row in rows:
        ts_str = row['timestamp']
        app_name = row['app_name'] or "Unknown"
        key_char = row['key_char'] or ""

        try:
            dt = datetime.fromisoformat(ts_str)
        except Exception:
            continue

        if target_date_str:
            local_date = dt.astimezone().strftime("%Y-%m-%d")
            if local_date != target_date_str:
                continue

        if current_session is None:
            current_session = {
                'app_name': app_name,
                'start_time': dt,
                'last_time': dt,
                'chars': [key_char]
            }
        elif app_name == current_session['app_name'] and (dt - current_session['last_time']).total_seconds() <= 120:
            current_session['chars'].append(key_char)
            current_session['last_time'] = dt
        else:
            sessions.append(current_session)
            current_session = {
                'app_name': app_name,
                'start_time': dt,
                'last_time': dt,
                'chars': [key_char]
            }

    if current_session:
        sessions.append(current_session)

    return sessions

def generate_diary_blocks(sessions: list[dict], min_chars: int = 5) -> list[tuple[datetime, str]]:
    blocks = []
    for session in sessions:
        text, contains_undo = reconstruct_text(session['chars'])
        cleaned_text = text.strip()
        
        if not bool(re.search(r'[a-zA-Z0-9\u00C0-\u024F]', text)):
            continue

        if len(cleaned_text) < min_chars:
            continue

        local_dt = session['start_time'].astimezone()
        time_str = local_dt.strftime("%Y-%m-%d %H:%M")
        
        app_name = session['app_name']
        undo_warning = "> ⚠️ *Session contains Undo, reconstructed text may be approximate*\n\n" if contains_undo else ""
        block_text = f"## {time_str} — {app_name}\n\n{undo_warning}{cleaned_text}\n\n---"
        blocks.append((session['start_time'], block_text))
    return blocks

def export_desktop_diary(days: int = 7, output_path: str = OUTPUT_PATH) -> int:
    sessions = read_sessions(days=days)
    blocks = generate_diary_blocks(sessions)
    blocks.sort(key=lambda x: x[0], reverse=True)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    if not blocks:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("")
        return 0

    content = "\n\n".join(b[1] for b in blocks) + "\n"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)
    return len(blocks)

def export_to_obsidian_keylog(vault_path: str, date_str: str | None = None) -> tuple[bool, str]:
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")
    
    # Path inside Obsidian vault: Daily/YYYY-MM-DD/YYYY-MM-DD - keylog.md
    day_folder = os.path.join(vault_path, "Daily", date_str)
    keylog_file = os.path.join(day_folder, f"{date_str} - keylog.md")

    sessions = read_sessions(target_date_str=date_str)
    blocks = generate_diary_blocks(sessions)
    # Order chronological for daily note
    blocks.sort(key=lambda x: x[0])

    if not blocks:
        return True, "No typing sessions found for today."

    os.makedirs(day_folder, exist_ok=True)
    body = "\n\n".join(b[1] for b in blocks) + "\n"

    if os.path.exists(keylog_file):
        with open(keylog_file, "r", encoding="utf-8") as f:
            existing_content = f.read()

        if BOUNDARY_MARKER not in existing_content:
            new_content = f"{BOUNDARY_MARKER}\n\n{body}"
        else:
            # Preserve anything above boundary marker
            parts = existing_content.split(BOUNDARY_MARKER, 1)
            header = parts[0]
            new_content = f"{header}{BOUNDARY_MARKER}\n\n{body}"

        with open(keylog_file, "w", encoding="utf-8") as f:
            f.write(new_content)
    else:
        with open(keylog_file, "w", encoding="utf-8") as f:
            f.write(f"{BOUNDARY_MARKER}\n\n{body}")

    return True, f"Successfully synced {len(blocks)} sessions to {keylog_file}"

def main():
    count = export_desktop_diary()
    print(f"Done. {count} sessions written to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
