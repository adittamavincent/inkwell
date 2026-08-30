import { checkAccessibilityPermission } from './permissions';

let activeInterval: NodeJS.Timeout | null = null;

/**
 * Polls macOS accessibility permission status from the Node main process.
 * Runs independently of renderer window focus and Chromium background throttling.
 * Stops automatically as soon as permission is granted.
 */
export function startPermissionWatcher(
  onGranted: () => void,
  pollIntervalMs = 1200
): () => void {
  stopPermissionWatcher();

  // If already granted, trigger immediately
  if (checkAccessibilityPermission(false)) {
    onGranted();
    return () => {};
  }

  activeInterval = setInterval(() => {
    if (checkAccessibilityPermission(false)) {
      stopPermissionWatcher();
      onGranted();
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
