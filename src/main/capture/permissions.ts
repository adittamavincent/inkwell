import { getAuthStatus, askForAccessibilityAccess, askForInputMonitoringAccess } from 'node-mac-permissions';
import { shell } from 'electron';

export type AuthStatus = 'authorized' | 'denied' | 'not determined' | 'restricted';

export interface PermissionStatus {
  accessibility: AuthStatus;
  inputMonitoring: AuthStatus;
}

export function checkAccessibilityStatus(): AuthStatus {
  if (process.platform !== 'darwin') return 'authorized';
  return getAuthStatus('accessibility');
}

export function checkInputMonitoringStatus(): AuthStatus {
  if (process.platform !== 'darwin') return 'authorized';
  return getAuthStatus('input-monitoring');
}

export function requestAccessibilityAccess(): void {
  if (process.platform !== 'darwin') return;
  askForAccessibilityAccess();
}

export function requestInputMonitoringAccess(): void {
  if (process.platform !== 'darwin') return;
  askForInputMonitoringAccess();
}

export function openAccessibilitySettings(): void {
  if (process.platform !== 'darwin') return;
  // Open macOS Privacy & Security -> Accessibility
  shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
  );
}

export function openInputMonitoringSettings(): void {
  if (process.platform !== 'darwin') return;
  // Open macOS Privacy & Security -> Input Monitoring
  shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent'
  );
}
