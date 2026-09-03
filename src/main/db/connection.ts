import Database from 'better-sqlite3';
import path from 'node:path';
import { getAppDataDir } from './crypto';
import { logger } from '../logger';

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = path.join(getAppDataDir(), 'inkwell.db');
  try {
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');

    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS keystrokes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        app_name TEXT,
        key_char TEXT,
        key_code INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_ts ON keystrokes(timestamp);
    `);

    logger.info('db', `Database opened at ${dbPath}`);
    return dbInstance;
  } catch (err) {
    logger.error('db', `Failed to open database at ${dbPath}`, err);
    throw err;
  }
}
