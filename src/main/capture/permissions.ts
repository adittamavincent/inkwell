import { createRequire } from 'node:module';
import { shell } from 'electron';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let macPermissions: any = null;

function getMacPermissions(): any {
  if (!macPermissions && process.platform === 'darwin') {
    macPermissions = require('node-mac-permissions');
  }
  return macPermissions;
}

/** Test-only: inject mock permissions object */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function _setMacPermissionsForTesting(mockPerms: any): void {
  macPermissions = mockPerms;
}

export type AuthStatus = 'authorized' | 'denied' | 'not determined' | 'restricted';

export interface PermissionStatus {
  accessibility: AuthStatus;
  inputMonitoring: AuthStatus;
}

export function checkAccessibilityStatus(): AuthStatus {
  if (process.platform !== 'darwin') return 'authorized';
  const perms = getMacPermissions();
  return perms ? perms.getAuthStatus('accessibility') : 'authorized';
}

export function checkInputMonitoringStatus(): AuthStatus {
  if (process.platform !== 'darwin') return 'authorized';
  const perms = getMacPermissions();
  return perms ? perms.getAuthStatus('input-monitoring') : 'authorized';
}

export function requestAccessibilityAccess(): void {
  if (process.platform !== 'darwin') return;
  // Never trigger OS modal prompt — navigate directly to System Settings
  openAccessibilitySettings();
}

export function requestInputMonitoringAccess(): void {
  if (process.platform !== 'darwin') return;
  const status = checkInputMonitoringStatus();
  const perms = getMacPermissions();
  if (status === 'not determined') {
    perms?.askForInputMonitoringAccess();
  } else {
    openInputMonitoringSettings();
  }
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
