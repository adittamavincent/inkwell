import { BrowserWindow } from 'electron';
import {
  checkAccessibilityStatus,
  checkInputMonitoringStatus,
  PermissionStatus,
} from './permissions';
import { startCapture, stopCapture, isCaptureRunning } from './keyHook';
import { startActiveAppTracker, stopActiveAppTracker } from './activeApp';
import { logger } from '../logger';

let activeInterval: NodeJS.Timeout | null = null;
let lastKnownStatus: PermissionStatus | null = null;
let statusChangeCallback: ((status: PermissionStatus) => void) | null = null;

// Debounce: require N consecutive identical polls before acting on a status change
// to avoid flapping when macOS briefly reports stale permission state.
let pendingStatus: PermissionStatus | null = null;
let pendingCount = 0;
const DEBOUNCE_CONFIRMATIONS = 2;

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
    // Debounce: require N consecutive identical polls before acting
    if (
      pendingStatus &&
      pendingStatus.accessibility === currentStatus.accessibility &&
      pendingStatus.inputMonitoring === currentStatus.inputMonitoring
    ) {
      pendingCount++;
    } else {
      pendingStatus = currentStatus;
      pendingCount = 1;
    }

    if (pendingCount < DEBOUNCE_CONFIRMATIONS) {
      return currentStatus;
    }

    // Confirmed — act on the change
    lastKnownStatus = currentStatus;
    pendingStatus = null;
    pendingCount = 0;

    if (isFullyAuthorized) {
      logger.info('permissionWatcher', 'Permissions fully authorized — starting capture & app tracker');
      startActiveAppTracker();
      startCapture();
    } else {
      logger.warn('permissionWatcher', `Permissions revoked (Accessibility: ${accessibility}, Input Monitoring: ${inputMonitoring}) — stopping capture & app tracker`);
      stopActiveAppTracker();
      stopCapture();
    }

    broadcastPermissionState(currentStatus);

    if (statusChangeCallback) {
      try {
        statusChangeCallback(currentStatus);
      } catch (err) {
        logger.error('permissionWatcher', 'Error in permission status callback', err);
      }
    }
  } else {
    // Status stable — clear any pending debounce
    pendingStatus = null;
    pendingCount = 0;
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
  try {
    checkAndSyncPermissionState();
  } catch (err) {
    logger.error('permissionWatcher', 'Error during initial permission check', err);
  }

  if (activeInterval) {
    return () => stopPermissionWatcher();
  }

  activeInterval = setInterval(() => {
    try {
      checkAndSyncPermissionState();
    } catch (err) {
      logger.error('permissionWatcher', 'Error during periodic permission check', err);
    }
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
