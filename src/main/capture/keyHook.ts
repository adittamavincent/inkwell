import { BrowserWindow } from 'electron';
import { mapKeyEventToToken, ModifierState, UiohookKeyboardEventLike, KEY } from './keyMapper';
import { getFrontmostAppName } from './activeApp';
import { checkAccessibilityPermission } from './permissions';
import { getConfig } from '../config/store';
import { insertKeystroke } from '../db/repository';

export type CaptureHealth = 'unconfirmed' | 'confirmed' | 'stalled';

interface QueuedKeystroke {
  timestamp: string;
  appName: string;
  keyChar: string;
  keyCode: number;
}

let isRunning = false;
let captureHealth: CaptureHealth = 'unconfirmed';
let lastEventReceivedAt = 0;
let healthCheckTimer: NodeJS.Timeout | null = null;
const queue: QueuedKeystroke[] = [];
let isProcessingQueue = false;

// Lazily loaded uiohook handle — only populated after permission granted
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let hook: any = null;

function getHook(): any {
  if (!hook) {
    // Dynamic require defers native addon initialization until after
    // accessibility permission is confirmed. Static imports cause macOS
    // to show the Accessibility dialog immediately at app startup.
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

function broadcastCaptureHealth(health: CaptureHealth): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('inkwell:captureHealthChanged', health);
    }
  }
}

function setCaptureHealth(health: CaptureHealth): void {
  if (captureHealth !== health) {
    captureHealth = health;
    broadcastCaptureHealth(health);
  }
}

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
  lastEventReceivedAt = Date.now();
  if (captureHealth !== 'confirmed') {
    setCaptureHealth('confirmed');
  }

  updateModifiers(e.keycode, true);

  const token = mapKeyEventToToken(e, modifiers);
  if (!token) return;

  const appName = getFrontmostAppName();
  const config = getConfig();

  if (isAppExcluded(appName, config.excludedApps)) {
    return;
  }

  // Fast push to memory queue (< 0.1ms)
  queue.push({
    timestamp: new Date().toISOString(),
    appName,
    keyChar: token,
    keyCode: e.keycode,
  });

  // Schedule async queue processor without blocking hook callback
  setImmediate(() => {
    processQueue();
  });
}

function handleKeyUp(e: UiohookKeyboardEventLike): void {
  lastEventReceivedAt = Date.now();
  if (captureHealth !== 'confirmed') {
    setCaptureHealth('confirmed');
  }
  updateModifiers(e.keycode, false);
}

export function startCapture(): boolean {
  if (isRunning) return true;

  // 1. Strict pre-flight verification: NEVER start uIOhook without trusted accessibility
  const isTrusted = checkAccessibilityPermission(false);
  if (!isTrusted) {
    console.warn('Inkwell: Cannot start capture tap — Accessibility permission is not granted.');
    isRunning = false;
    setCaptureHealth('unconfirmed');
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

    // Track capture health heartbeat for Input Monitoring verification
    if (lastEventReceivedAt === 0) {
      setCaptureHealth('unconfirmed');
      if (healthCheckTimer) clearTimeout(healthCheckTimer);
      healthCheckTimer = setTimeout(() => {
        if (isRunning && captureHealth === 'unconfirmed') {
          // Accessibility is granted, but no keystrokes arrived yet
          setCaptureHealth('stalled');
        }
      }, 2500);
    } else {
      setCaptureHealth('confirmed');
    }

    return true;
  } catch (err) {
    console.error('Inkwell: Failed to start uiohook key capture:', err);
    isRunning = false;
    setCaptureHealth('unconfirmed');
    return false;
  }
}

export function stopCapture(): boolean {
  if (healthCheckTimer) {
    clearTimeout(healthCheckTimer);
    healthCheckTimer = null;
  }

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
    setCaptureHealth('unconfirmed');
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

export function getCaptureHealth(): CaptureHealth {
  return captureHealth;
}

export function getLastEventReceivedAt(): number {
  return lastEventReceivedAt;
}
