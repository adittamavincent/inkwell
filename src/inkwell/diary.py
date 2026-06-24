import os
import sys
import sqlite3
from datetime import datetime

DB_PATH = "/Users/adittama/inkwell.db"
OUTPUT_PATH = "/Users/adittama/Desktop/writing-history.md"

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

        # Parse timestamp (expecting UTC ISO 8601 string)
        try:
            # fromisoformat handles 'Z' or '+00:00' in Python 3.11+
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
        text = "".join(session['chars'])
        cleaned_text = text.strip()
        
        # Skip sessions with content less than 5 characters after strip
        if len(cleaned_text) < 5:
            continue

        # Convert start time to local time and format
        local_dt = session['start_time'].astimezone()
        time_str = local_dt.strftime("%Y-%m-%d %H:%M")
        
        app_name = session['app_name']
        block_text = f"## {time_str} — {app_name}\n\n{cleaned_text}\n\n---"
        blocks.append((session['start_time'], block_text))

    # Sort newest sessions on top
    blocks.sort(key=lambda x: x[0], reverse=True)

    if not blocks:
        print("No sessions to write.")
        # Ensure writing empty file or notify
        with open(OUTPUT_PATH, "w") as f:
            f.write("")
        print(f"Done. 0 sessions written to {OUTPUT_PATH}")
        return

    output_content = "\n\n".join(b[1] for b in blocks) + "\n"
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        f.write(output_content)

    print(f"Done. {len(blocks)} sessions written to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
