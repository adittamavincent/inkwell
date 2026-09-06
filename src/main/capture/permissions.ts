import { createRequire } from 'node:module';
import { shell, systemPreferences } from 'electron';
import { logger } from '../logger';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let macPermissions: any = null;
let nativeModuleLoadAttempted = false;

function getMacPermissions(): any {
  if (macPermissions) return macPermissions;
  if (process.platform === 'darwin' && !nativeModuleLoadAttempted) {
    nativeModuleLoadAttempted = true;
    try {
      macPermissions = require('node-mac-permissions');
    } catch (err) {
      logger.error('permissions', 'Failed to load node-mac-permissions native module', err);
      macPermissions = null;
    }
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
  const perms = getMacPermissions();
  if (!perms) return process.platform === 'darwin' ? 'denied' : 'authorized';
  if (typeof perms.getAuthStatus === 'function') {
    return perms.getAuthStatus('accessibility');
  }
  // systemPreferences.isTrustedAccessibilityClient(false) guarantees no OS dialog popup
  if (systemPreferences && typeof systemPreferences.isTrustedAccessibilityClient === 'function') {
    return systemPreferences.isTrustedAccessibilityClient(false) ? 'authorized' : 'denied';
  }
  return 'denied';
}

export function checkInputMonitoringStatus(): AuthStatus {
  const perms = getMacPermissions();
  if (!perms) return process.platform === 'darwin' ? 'denied' : 'authorized';
  if (typeof perms.getAuthStatus === 'function') {
    return perms.getAuthStatus('input-monitoring');
  }
  return 'denied';
}

export function requestAccessibilityAccess(): void {
  if (process.platform !== 'darwin') return;
  if (systemPreferences && typeof systemPreferences.isTrustedAccessibilityClient === 'function') {
    // Calling with true triggers the standard macOS prompt dialog once
    const isTrusted = systemPreferences.isTrustedAccessibilityClient(true);
    if (!isTrusted) {
      openAccessibilitySettings();
    }
  } else {
    openAccessibilitySettings();
  }
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
