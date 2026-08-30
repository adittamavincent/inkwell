import { BrowserWindow } from 'electron';
import {
  checkAccessibilityStatus,
  checkInputMonitoringStatus,
  PermissionStatus,
} from './permissions';
import { startCapture, stopCapture, isCaptureRunning } from './keyHook';
import { startActiveAppTracker, stopActiveAppTracker } from './activeApp';

let activeInterval: NodeJS.Timeout | null = null;
let lastKnownStatus: PermissionStatus | null = null;
let statusChangeCallback: ((status: PermissionStatus) => void) | null = null;

function broadcastPermissionState(status: PermissionStatus): void {
  const isFullyAuthorized =
    status.accessibility === 'authorized' && status.inputMonitoring === 'authorized';

  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('inkwell:permissionStatusChanged', status);
      if (isFullyAuthorized) {
        win.webContents.send('inkwell:permissionGranted');
      } else {
        win.webContents.send('inkwell:permissionRevoked');
      }
    }
  }
}

/**
 * Checks current macOS accessibility & input monitoring permissions and synchronizes capture state.
 * Uses read-only native OS status queries without prompting dialogs.
 */
export function checkAndSyncPermissionState(): PermissionStatus {
  const accessibility = checkAccessibilityStatus();
  const inputMonitoring = checkInputMonitoringStatus();
  const currentStatus: PermissionStatus = { accessibility, inputMonitoring };

  const isFullyAuthorized =
    accessibility === 'authorized' && inputMonitoring === 'authorized';

  if (lastKnownStatus === null) {
    lastKnownStatus = currentStatus;
    if (isFullyAuthorized) {
      startActiveAppTracker();
      if (!isCaptureRunning()) {
        startCapture();
      }
    } else {
      stopActiveAppTracker();
      if (isCaptureRunning()) {
        stopCapture();
      }
    }
    return currentStatus;
  }

  const hasChanged =
    lastKnownStatus.accessibility !== currentStatus.accessibility ||
    lastKnownStatus.inputMonitoring !== currentStatus.inputMonitoring;

  if (hasChanged) {
    lastKnownStatus = currentStatus;

    if (isFullyAuthorized) {
      console.log('Inkwell: Permissions fully authorized. Starting capture tap & app tracker.');
      startActiveAppTracker();
      startCapture();
    } else {
      console.warn(
        `Inkwell: Permissions not fully authorized (Accessibility: ${accessibility}, Input Monitoring: ${inputMonitoring}). Stopping capture tap & app tracker.`
      );
      stopActiveAppTracker();
      stopCapture();
    }

    broadcastPermissionState(currentStatus);

    if (statusChangeCallback) {
      try {
        statusChangeCallback(currentStatus);
      } catch (err) {
        console.error('Inkwell: Error in permission status callback:', err);
      }
    }
  }

  return currentStatus;
}

/**
 * Starts continuous background polling for macOS permissions.
 * Uses only read-only status checks (no auto-prompts) every pollIntervalMs (default 2000ms).
 */
export function startPermissionWatcher(
  onStatusChange?: (status: PermissionStatus) => void,
  pollIntervalMs = 2000
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
