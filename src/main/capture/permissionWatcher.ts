import { BrowserWindow } from 'electron';
import { checkAccessibilityPermission } from './permissions';
import { startCapture, stopCapture, isCaptureRunning } from './keyHook';

let activeInterval: NodeJS.Timeout | null = null;
let lastKnownState: boolean | null = null;
let statusChangeCallback: ((granted: boolean) => void) | null = null;

function broadcastPermissionState(granted: boolean): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('inkwell:permissionStatusChanged', granted);
      if (granted) {
        win.webContents.send('inkwell:permissionGranted');
      } else {
        win.webContents.send('inkwell:permissionRevoked');
      }
    }
  }
}

/**
 * Checks current macOS accessibility permission and synchronizes capture state.
 * If permission was revoked/disabled, immediately stops capture to prevent event tap freeze.
 * If permission was granted, starts capture.
 */
export function checkAndSyncPermissionState(): boolean {
  const isGranted = checkAccessibilityPermission(false);

  if (lastKnownState === null) {
    lastKnownState = isGranted;
    if (isGranted) {
      if (!isCaptureRunning()) {
        startCapture();
      }
    } else {
      if (isCaptureRunning()) {
        stopCapture();
      }
    }
    return isGranted;
  }

  if (lastKnownState !== isGranted) {
    lastKnownState = isGranted;

    if (isGranted) {
      console.log('Inkwell: Accessibility permission granted/re-enabled. Starting capture.');
      startCapture();
    } else {
      console.warn(
        'Inkwell: Accessibility permission revoked or disabled in macOS System Settings. Stopping capture tap immediately.'
      );
      stopCapture();
    }

    broadcastPermissionState(isGranted);

    if (statusChangeCallback) {
      try {
        statusChangeCallback(isGranted);
      } catch (err) {
        console.error('Inkwell: Error in permission status callback:', err);
      }
    }
  }

  return isGranted;
}

/**
 * Starts continuous background polling for macOS accessibility permission status.
 * Runs continuously for the entire app lifecycle to detect both grants and in-session revocations.
 */
export function startPermissionWatcher(
  onStatusChange?: (granted: boolean) => void,
  pollIntervalMs = 1000
): () => void {
  if (onStatusChange) {
    statusChangeCallback = onStatusChange;
  }

  // Initial check and state synchronization
  checkAndSyncPermissionState();

  if (activeInterval) {
    return () => stopPermissionWatcher();
  }

  activeInterval = setInterval(() => {
    checkAndSyncPermissionState();
  }, pollIntervalMs);

  return () => {
    stopPermissionWatcher();
  };
}

export function stopPermissionWatcher(): void {
  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
}

export function isPermissionWatcherRunning(): boolean {
  return activeInterval !== null;
}

