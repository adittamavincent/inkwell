import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const LOG_DIR = path.join(os.homedir(), 'Library', 'Logs', 'Inkwell');
const LOG_FILE = path.join(LOG_DIR, 'inkwell.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_LOG_FILES = 3;

let logStream: fs.WriteStream | null = null;

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    } catch {
      // Cannot create log dir — silently fail
    }
  }
}

function rotateIfNeeded(): void {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > MAX_LOG_SIZE) {
        // Shift existing rotated logs
        for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
          const from = path.join(LOG_DIR, `inkwell.${i}.log`);
          const to = path.join(LOG_DIR, `inkwell.${i + 1}.log`);
          if (fs.existsSync(from)) {
            if (i + 1 >= MAX_LOG_FILES) {
              fs.unlinkSync(from);
            } else {
              fs.renameSync(from, to);
            }
          }
        }
        fs.renameSync(LOG_FILE, path.join(LOG_DIR, 'inkwell.1.log'));
      }
    }
  } catch {
    // Rotation failure is non-critical
  }
}

function getStream(): fs.WriteStream | null {
  if (logStream) return logStream;
  ensureLogDir();
  rotateIfNeeded();
  try {
    logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
    return logStream;
  } catch {
    return null;
  }
}

function timestamp(): string {
  return new Date().toISOString();
}

function write(level: string, component: string, message: string, data?: unknown): void {
  const stream = getStream();
  if (!stream) return;

  let line = `${timestamp()} [${level}] [${component}] ${message}`;
  if (data !== undefined) {
    try {
      const serialized = data instanceof Error
        ? `${data.message}\n${data.stack}`
        : typeof data === 'string'
          ? data
          : JSON.stringify(data, null, 2);
      line += ` | ${serialized}`;
    } catch {
      line += ` | [unserializable]`;
    }
  }
  stream.write(line + '\n');
}

export const logger = {
  info(component: string, message: string, data?: unknown): void {
    write('INFO', component, message, data);
  },

  warn(component: string, message: string, data?: unknown): void {
    write('WARN', component, message, data);
    // Also write to stderr for dev mode visibility
    console.warn(`Inkwell [${component}]: ${message}`, data ?? '');
  },

  error(component: string, message: string, data?: unknown): void {
    write('ERROR', component, message, data);
    console.error(`Inkwell [${component}]: ${message}`, data ?? '');
  },

  debug(component: string, message: string, data?: unknown): void {
    write('DEBUG', component, message, data);
  },

  /** Flush and close the log stream. Call before app quits. */
  close(): void {
    if (logStream) {
      try {
        logStream.end();
      } catch {
        // Ignore
      }
      logStream = null;
    }
  },

  /** Returns the log file path for display to the user. */
  getLogPath(): string {
    return LOG_FILE;
  },
};
