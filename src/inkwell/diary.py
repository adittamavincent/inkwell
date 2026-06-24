import os
import sys
import sqlite3
import re
from datetime import datetime

DB_PATH = "/Users/adittama/inkwell.db"
OUTPUT_PATH = "/Users/adittama/Desktop/writing-history.md"

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

def read_sessions():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return []

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT timestamp, app_name, key_char FROM keystrokes ORDER BY timestamp ASC")
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

def main():
    sessions = read_sessions()
    blocks = []

    for session in sessions:
        text, contains_undo = reconstruct_text(session['chars'])
        cleaned_text = text.strip()
        
        # Filter sessions that don't contain at least 1 alphanumeric/special char
        if not bool(re.search(r'[a-zA-Z0-9\u00C0-\u024F]', text)):
            continue

        # Skip sessions with content less than 5 characters after strip
        if len(cleaned_text) < 5:
            continue

        local_dt = session['start_time'].astimezone()
        time_str = local_dt.strftime("%Y-%m-%d %H:%M")
        
        app_name = session['app_name']
        undo_warning = "> ⚠️ sesi ini mengandung Undo, hasil rekonstruksi mungkin tidak akurat\n\n" if contains_undo else ""
        block_text = f"## {time_str} — {app_name}\n\n{undo_warning}{cleaned_text}\n\n---"
        blocks.append((session['start_time'], block_text))

    blocks.sort(key=lambda x: x[0], reverse=True)

    if not blocks:
        print("No sessions to write.")
        with open(OUTPUT_PATH, "w") as f:
            f.write("")
        print(f"Done. 0 sessions written to {OUTPUT_PATH}")
        return

    output_content = "\n\n".join(b[1] for b in blocks) + "\n"
    
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        f.write(output_content)

    print(f"Done. {len(blocks)} sessions written to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
