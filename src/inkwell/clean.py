import sys
import sqlite3
import os
from datetime import datetime, timedelta, timezone

DB_PATH = "/Users/adittama/inkwell.db"

def main():
    days = 30
    if len(sys.argv) > 1 and sys.argv[1].strip():
        try:
            days = int(sys.argv[1])
        except ValueError:
            print("Error: argumen hari harus integer.")
            sys.exit(1)

    if not os.path.exists(DB_PATH):
        print(f"Database tidak ditemukan di {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    try:
        cursor.execute("SELECT COUNT(*) FROM keystrokes")
        before = cursor.fetchone()[0]

        cursor.execute("DELETE FROM keystrokes WHERE timestamp < ?", (cutoff,))
        conn.commit()

        cursor.execute("SELECT COUNT(*) FROM keystrokes")
        after = cursor.fetchone()[0]

        cursor.execute("VACUUM")
        conn.commit()
        
        deleted = before - after
        print(f"Cleaned: Hapus {deleted} baris (> {days} hari). DB di-vacuum.")
    except Exception as e:
        print(f"Error clean DB: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
