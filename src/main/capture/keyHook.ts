import { createRequire } from 'node:module';
import { BrowserWindow, clipboard } from 'electron';
import { mapKeyEventToToken, ModifierState, UiohookKeyboardEventLike, KEY } from './keyMapper';
import { getFrontmostAppName } from './activeApp';
import { checkAccessibilityStatus, checkInputMonitoringStatus } from './permissions';
import { getConfig } from '../config/store';
import { insertKeystroke } from '../db/repository';
import { doSync } from '../sync/cogdexSync';
import { logger } from '../logger';

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
        logger.error('keyHook', 'Failed to persist keystroke', err);
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
  try {
    _handleKeyDownInner(e);
  } catch (err) {
    logger.error('keyHook', 'Unhandled error in handleKeyDown', err);
  }
}

function _handleKeyDownInner(e: UiohookKeyboardEventLike): void {
  updateModifiers(e.keycode, true);

  const token = mapKeyEventToToken(e, modifiers);
  if (!token) return;

  const config = getConfig();

  // Detect paste/snippet triggers synchronously, but defer native calls
  // (clipboard.readText, activeWin, app.getFileIcon, sips) to main thread
  // via setImmediate. The uiohook keydown callback runs on a native event-tap
  // thread — calling Cocoa APIs from there causes EXC_BREAKPOINT / SIGTRAP.
  let finalToken = token;
  let needsClipRead = false;
  let clipTrigger: 'paste' | 'q3q' | 'q4q' | null = null;

  if (token === '[⌘V]') {
    needsClipRead = true;
    clipTrigger = 'paste';
  } else if (token.length === 1 && !token.startsWith('[')) {
    const lower = token.toLowerCase();
    if (
      lower === 'q' &&
      recentKeys.length >= 2 &&
      recentKeys[recentKeys.length - 2] === 'q' &&
      (recentKeys[recentKeys.length - 1] === '3' || recentKeys[recentKeys.length - 1] === '4')
    ) {
      needsClipRead = true;
      clipTrigger = recentKeys[recentKeys.length - 1] === '3' ? 'q3q' : 'q4q';
    }

    recentKeys.push(lower);
    if (recentKeys.length > 20) {
      recentKeys.shift();
    }
  } else if (token === '[⌫]') {
    recentKeys.pop();
  }

  // getFrontmostAppName() reads from a 250 ms cache populated by the
  // polling tracker. Avoid triggering refreshActiveApp() here — it touches
  // activeWin(), fetchAppIcon(), sips, and app.getFileIcon().
  const appName = getFrontmostAppName();

  if (isAppExcluded(appName, config.excludedApps)) {
    return;
  }

  if (needsClipRead) {
    // Defer clipboard read to main thread; enqueue with the literal token for now.
    queue.push({
      timestamp: new Date().toISOString(),
      appName,
      keyChar: finalToken,
      keyCode: e.keycode,
    });
    setImmediate(() => {
      try {
        const clipText = clipboard.readText();
        if (clipText) {
          const b64 = Buffer.from(clipText, 'utf8').toString('base64');
          if (clipTrigger === 'paste') {
            finalToken = `[PASTE:b64:${b64}]`;
          } else if (clipTrigger === 'q3q') {
            finalToken = `[Q3Q:b64:${b64}]`;
          } else {
            finalToken = `[Q4Q:b64:${b64}]`;
          }
          // Update the last queued item with the resolved token
          const last = queue[queue.length - 1];
          if (last && last.keyCode === e.keycode) {
            last.keyChar = finalToken;
          }
        }
      } catch {
        // clipboard read failed — keep the literal token
      }
      processQueue();
    });
  } else {
    // Fast push to memory queue (< 0.1ms) for non-clipboard tokens
    queue.push({
      timestamp: new Date().toISOString(),
      appName,
      keyChar: finalToken,
      keyCode: e.keycode,
    });
    setImmediate(() => {
      processQueue();
    });
  }
}

function handleKeyUp(e: UiohookKeyboardEventLike): void {
  try {
    updateModifiers(e.keycode, false);
  } catch (err) {
    logger.error('keyHook', 'Unhandled error in handleKeyUp', err);
  }
}

export function startCapture(): boolean {
  if (isRunning) return true;

  // 1. Strict pre-flight verification: NEVER start uIOhook without authorized accessibility & input monitoring
  const accessibility = checkAccessibilityStatus();
  const inputMonitoring = checkInputMonitoringStatus();

  if (accessibility !== 'authorized' || inputMonitoring !== 'authorized') {
    logger.warn('keyHook', `Cannot start capture — permissions not fully authorized (Accessibility: ${accessibility}, Input Monitoring: ${inputMonitoring})`);
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
    logger.info('keyHook', 'Capture started successfully');
    return true;
  } catch (err) {
    logger.error('keyHook', 'Failed to start uiohook key capture', err);
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
    logger.info('keyHook', 'Capture stopped');
  } catch (err) {
    logger.error('keyHook', 'Failed to stop uiohook key capture', err);
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
