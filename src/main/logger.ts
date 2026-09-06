import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const LOG_DIR = path.join(os.homedir(), 'Library', 'Logs', 'Inkwell');
const LOG_FILE = path.join(LOG_DIR, 'inkwell.log');
const HEARTBEAT_FILE = path.join(LOG_DIR, 'heartbeat.json');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_LOG_FILES = 3;
const HEARTBEAT_INTERVAL_MS = 20_000; // 20 seconds

let logStream: fs.WriteStream | null = null;
const runId = `${process.pid}-${Date.now().toString(36)}`;
const startedAt = Date.now();
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

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
    // A logging failure must never become the application failure. This is
    // especially important in tests and when the log directory is unavailable.
    logStream.on('error', () => {
      logStream = null;
    });
    return logStream;
  } catch {
    return null;
  }
}

function timestamp(): string {
  return new Date().toISOString();
}

function serializeData(data: unknown): unknown {
  if (data instanceof Error) {
    return { name: data.name, message: data.message, stack: data.stack, cause: data.cause };
  }
  if (typeof data === 'string') return data;
  return data;
}

function write(level: string, component: string, message: string, data?: unknown): void {
  const stream = getStream();
  if (!stream) return;

  let line = `${timestamp()} [${level}] [${component}] [pid=${process.pid} run=${runId} uptimeMs=${Math.round(process.uptime() * 1000)}] ${message}`;
  if (data !== undefined) {
    try {
      line += ` | ${JSON.stringify(serializeData(data))}`;
    } catch {
      line += ` | [unserializable]`;
    }
  }
  stream.write(line + '\n');
}

// ── Heartbeat mechanism (unclean-shutdown detection) ─────────────────────────
// Writes a small JSON file periodically so the *next* boot can detect if the
// previous session ended without a clean shutdown (native crash, SIGSEGV, etc).

function writeHeartbeatFile(extra?: Record<string, unknown>): void {
  try {
    ensureLogDir();
    const payload = {
      runId,
      pid: process.pid,
      lastHeartbeatAt: new Date().toISOString(),
      ...extra,
    };
    fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify(payload), 'utf-8');
  } catch {
    // Heartbeat failure must never affect the app
  }
}

function startHeartbeat(): void {
  if (heartbeatTimer) return;
  writeHeartbeatFile();
  heartbeatTimer = setInterval(() => writeHeartbeatFile(), HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/** Call on clean shutdown to mark this runId as cleanly exited. */
function writeCleanShutdown(): void {
  writeHeartbeatFile({ cleanShutdown: true });
  stopHeartbeat();
}

/**
 * Read the heartbeat file left by the previous run. Returns null if no file
 * exists or it cannot be read. Otherwise returns the parsed JSON.
 */
function readPreviousHeartbeat(): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(HEARTBEAT_FILE)) return null;
    const raw = fs.readFileSync(HEARTBEAT_FILE, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
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

  /** Start the periodic heartbeat writer. Call once after app.whenReady(). */
  startHeartbeat(): void {
    startHeartbeat();
  },

  /** Stop the heartbeat and write a clean-shutdown marker. */
  writeCleanShutdown(): void {
    writeCleanShutdown();
  },

  /**
   * Check if the previous run ended uncleanly. Logs an ERROR if so.
   * Call at the very start of app.whenReady(), before any other logging.
   */
  checkPreviousRun(): void {
    const prev = readPreviousHeartbeat();
    if (prev && typeof prev.runId === 'string' && !prev.cleanShutdown) {
      write('ERROR', 'main', 'Previous session ended unexpectedly — no clean shutdown detected', {
        previousRunId: prev.runId,
        previousPid: prev.pid,
        lastHeartbeatAt: prev.lastHeartbeatAt,
      });
    }
    // Write initial heartbeat for this run (overwrites the stale file)
    writeHeartbeatFile();
  },

  /** Returns the log file path for display to the user. */
  getLogPath(): string {
    return LOG_FILE;
  },

  getRunContext(): { runId: string; pid: number; startedAt: string } {
    return { runId, pid: process.pid, startedAt: new Date(startedAt).toISOString() };
  },
};
