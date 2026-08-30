import activeWin from 'active-win';
import { BrowserWindow } from 'electron';

let cachedAppName = 'Unknown';
let lastQueryTime = 0;
const CACHE_TTL_MS = 250;
let isQuerying = false;
let pollingInterval: NodeJS.Timeout | null = null;

function broadcastActiveApp(appName: string): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('inkwell:activeAppChanged', appName);
    }
  }
}

async function refreshActiveApp(): Promise<void> {
  if (isQuerying) return;
  isQuerying = true;
  try {
    const result = await activeWin({
      accessibilityPermission: false,
      screenRecordingPermission: false,
    });
    if (result && result.owner && result.owner.name) {
      const newName = result.owner.name.trim() || 'Unknown';
      if (newName !== cachedAppName) {
        cachedAppName = newName;
        broadcastActiveApp(cachedAppName);
      }
    }
  } catch {
    // If permission or query fails, retain cached or fallback
  } finally {
    lastQueryTime = Date.now();
    isQuerying = false;
  }
}

/**
 * Starts continuous background tracking of frontmost application.
 * Enables live UI indicators to update immediately without waiting for keystrokes.
 */
export function startActiveAppTracker(intervalMs = 250): void {
  if (pollingInterval) return;
  refreshActiveApp();
  pollingInterval = setInterval(() => {
    refreshActiveApp();
  }, intervalMs);
}

export function stopActiveAppTracker(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/**
 * Returns the currently frontmost application name.
 * Reads from a fast in-memory cache and refreshes every 250ms
 * so the keystroke capture loop is never blocked by OS window inspection.
 */
export function getFrontmostAppName(): string {
  const now = Date.now();
  if (now - lastQueryTime > CACHE_TTL_MS) {
    // Trigger async refresh without awaiting
    refreshActiveApp();
  }
  return cachedAppName;
}

export async function forceUpdateActiveApp(): Promise<string> {
  await refreshActiveApp();
  return cachedAppName;
}
