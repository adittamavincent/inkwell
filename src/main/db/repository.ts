import { getDatabase } from './connection';
import { encrypt, decrypt } from './crypto';
import { groupSessions, SessionPreview } from '../sync/sessionGrouper';

export function insertKeystroke(
  timestamp: string,
  appName: string,
  keyChar: string,
  keyCode: number
): void {
  const db = getDatabase();
  const encryptedChar = encrypt(keyChar);
  const stmt = db.prepare(`
    INSERT INTO keystrokes (timestamp, app_name, key_char, key_code)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(timestamp, appName, encryptedChar, keyCode);
}

export function querySessionsSince(sinceIso: string): Array<[string, string, string]> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT timestamp, app_name, key_char
    FROM keystrokes
    WHERE timestamp >= ?
    ORDER BY id ASC
  `);
  const rows = stmt.all(sinceIso) as Array<{
    timestamp: string;
    app_name: string;
    key_char: string;
  }>;

  return rows.map((r) => [r.timestamp, r.app_name || 'Unknown', decrypt(r.key_char)]);
}

export function loadAllHistory(idleTimeoutSecs = 60): SessionPreview[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT timestamp, app_name, key_char
    FROM keystrokes
    ORDER BY id ASC
  `);
  const rows = stmt.all() as Array<{
    timestamp: string;
    app_name: string;
    key_char: string;
  }>;

  const decryptedRows: Array<[string, string, string]> = rows.map((r) => [
    r.timestamp,
    r.app_name || 'Unknown',
    decrypt(r.key_char),
  ]);

  return groupSessions(decryptedRows, idleTimeoutSecs);
}

export function clearHistory(): void {
  const db = getDatabase();
  db.prepare('DELETE FROM keystrokes').run();
  db.exec('VACUUM');
}
