import fs from 'node:fs';
import path from 'node:path';
import { getAppDataDir } from '../db/crypto';

function getLastSyncPath(): string {
  return path.join(getAppDataDir(), 'last_sync.txt');
}

/**
 * Returns the timestamp of the last successful sync,
 * or null if never synced before.
 */
export function getLastSync(): Date | null {
  try {
    const p = getLastSyncPath();
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8').trim();
      const d = new Date(content);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function writeLastSync(date: Date): void {
  try {
    const p = getLastSyncPath();
    fs.writeFileSync(p, date.toISOString(), 'utf8');
  } catch (err) {
    console.warn('Inkwell: Could not write last_sync.txt:', err);
  }
}
