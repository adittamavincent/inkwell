import { createRequire } from 'node:module';
import { BrowserWindow, clipboard } from 'electron';
import { mapKeyEventToToken, ModifierState, UiohookKeyboardEventLike, KEY } from './keyMapper';
import { getFrontmostAppName } from './activeApp';
import { checkAccessibilityStatus, checkInputMonitoringStatus } from './permissions';
import { getConfig } from '../config/store';
import { insertKeystroke } from '../db/repository';
import { doSync } from '../sync/cogdexSync';

const require = createRequire(import.meta.url);

interface QueuedKeystroke {
  timestamp: string;
  appName: string;
  keyChar: string;
  keyCode: number;
}

let isRunning = false;
const queue: QueuedKeystroke[] = [];
let isProcessingQueue = false;
const recentKeys: string[] = [];

// Background sync: runs every 5s while capture is active
let syncTimer: ReturnType<typeof setInterval> | null = null;

function startBackgroundSync(): void {
  stopBackgroundSync();
  syncTimer = setInterval(() => {
    const config = getConfig();
    if (!config.enabled || !config.vaultPath) return;
    try {
      doSync(config);
    } catch {
      // background sync is best-effort
    }
  }, 5000);
}

function stopBackgroundSync(): void {
  if (syncTimer !== null) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

// Lazily loaded uiohook handle — only populated after permission granted
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let hook: any = null;

function getHook(): any {
  if (!hook) {
    // Dynamic require defers native addon initialization until after
    // permission is confirmed. Static imports cause macOS to query/prompt prematurely.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    hook = require('uiohook-napi').uIOhook;
  }
  return hook;
}

/** Test-only: inject a mock hook instead of loading the native addon. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function _setHookForTesting(mockHook: any): void {
  hook = mockHook;
}

const modifiers: ModifierState = {
  shift: false,
  ctrl: false,
  alt: false,
  meta: false,
};

function updateModifiers(keycode: number, isDown: boolean): void {
  if (keycode === KEY.Shift || keycode === KEY.ShiftRight) {
    modifiers.shift = isDown;
  } else if (keycode === KEY.Ctrl || keycode === KEY.CtrlRight) {
    modifiers.ctrl = isDown;
  } else if (keycode === KEY.Alt || keycode === KEY.AltRight) {
    modifiers.alt = isDown;
  } else if (keycode === KEY.Meta || keycode === KEY.MetaRight) {
    modifiers.meta = isDown;
  }
}

function isAppExcluded(appName: string, excludedList: string[]): boolean {
  const normalized = (appName || '').trim().toLowerCase();
  if (!normalized) return false;

  for (const excluded of excludedList) {
    const cleanExcluded = (excluded || '').trim().toLowerCase();
    if (cleanExcluded && normalized.includes(cleanExcluded)) {
      return true;
    }
  }
  return false;
}

async function processQueue(): Promise<void> {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) continue;

      // 1. Write to SQLite
      try {
        insertKeystroke(item.timestamp, item.appName, item.keyChar, item.keyCode);
      } catch (err) {
        console.error('Inkwell: Failed to persist keystroke:', err);
      }

      // 2. Broadcast to UI windows
      const allWindows = BrowserWindow.getAllWindows();
      for (const win of allWindows) {
        if (!win.isDestroyed()) {
          win.webContents.send('inkwell:keystroke', {
            timestamp: item.timestamp,
            appName: item.appName,
            keyChar: item.keyChar,
          });
        }
      }
    }
  } finally {
    isProcessingQueue = false;
    if (queue.length > 0) {
      setImmediate(() => {
        processQueue();
      });
    }
  }
}

function handleKeyDown(e: UiohookKeyboardEventLike): void {
  updateModifiers(e.keycode, true);

  const token = mapKeyEventToToken(e, modifiers);
  if (!token) return;

  const appName = getFrontmostAppName();
  const config = getConfig();

  if (isAppExcluded(appName, config.excludedApps)) {
    return;
  }

  let finalToken = token;

  // 1. Paste Token Capture (Cmd+V / Ctrl+V)
  if (token === '[⌘V]') {
    try {
      const clipText = clipboard.readText();
      if (clipText) {
        finalToken = `[PASTE:b64:${Buffer.from(clipText, 'utf8').toString('base64')}]`;
      } else {
        finalToken = `[PASTE:b64:]`;
      }
    } catch {
      finalToken = `[PASTE:b64:]`;
    }
  } else if (token.length === 1 && !token.startsWith('[')) {
    // Single character tracking for q3q / q4q universal snippets
    const lower = token.toLowerCase();
    if (
      lower === 'q' &&
      recentKeys.length >= 2 &&
      recentKeys[recentKeys.length - 2] === 'q' &&
      (recentKeys[recentKeys.length - 1] === '3' || recentKeys[recentKeys.length - 1] === '4')
    ) {
      const isQ3 = recentKeys[recentKeys.length - 1] === '3';
      try {
        const clipText = clipboard.readText();
        if (clipText) {
          finalToken = isQ3
            ? `[Q3Q:b64:${Buffer.from(clipText, 'utf8').toString('base64')}]`
            : `[Q4Q:b64:${Buffer.from(clipText, 'utf8').toString('base64')}]`;
        }
      } catch {
        // Fallback to literal token; reconstructor will expand from its lastPastedContent
      }
    }

    recentKeys.push(lower);
    if (recentKeys.length > 20) {
      recentKeys.shift();
    }
  } else if (token === '[⌫]') {
    recentKeys.pop();
  }

  // Fast push to memory queue (< 0.1ms)
  queue.push({
    timestamp: new Date().toISOString(),
    appName,
    keyChar: finalToken,
    keyCode: e.keycode,
  });

  // Schedule async queue processor without blocking hook callback
  setImmediate(() => {
    processQueue();
  });
}

function handleKeyUp(e: UiohookKeyboardEventLike): void {
  updateModifiers(e.keycode, false);
}

export function startCapture(): boolean {
  if (isRunning) return true;

  // 1. Strict pre-flight verification: NEVER start uIOhook without authorized accessibility & input monitoring
  const accessibility = checkAccessibilityStatus();
  const inputMonitoring = checkInputMonitoringStatus();

  if (accessibility !== 'authorized' || inputMonitoring !== 'authorized') {
    console.warn(
      `Inkwell: Cannot start capture tap — Permissions not fully authorized (Accessibility: ${accessibility}, Input Monitoring: ${inputMonitoring}).`
    );
    isRunning = false;
    return false;
  }

  try {
    const uIOhook = getHook();
    uIOhook.removeAllListeners('keydown');
    uIOhook.removeAllListeners('keyup');
    uIOhook.on('keydown', handleKeyDown);
    uIOhook.on('keyup', handleKeyUp);
    uIOhook.start();

    isRunning = true;
    startBackgroundSync();
    return true;
  } catch (err) {
    console.error('Inkwell: Failed to start uiohook key capture:', err);
    isRunning = false;
    return false;
  }
}

export function stopCapture(): boolean {
  stopBackgroundSync();
  try {
    if (hook) {
      hook.removeAllListeners('keydown');
      hook.removeAllListeners('keyup');
      if (isRunning) {
        hook.stop();
      }
    }
  } catch (err) {
    console.error('Inkwell: Failed to stop uiohook key capture:', err);
  } finally {
    isRunning = false;
  }
  return true;
}

export function restartCapture(): boolean {
  stopCapture();
  return startCapture();
}

export function isCaptureRunning(): boolean {
  return isRunning;
}
