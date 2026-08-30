import { systemPreferences, shell } from 'electron';

let hasPromptedAccessibility = false;

export function checkAccessibilityPermission(prompt = false): boolean {
  if (process.platform !== 'darwin') return true;
  try {
    // Check current trust first without prompting
    const currentTrust = systemPreferences.isTrustedAccessibilityClient(false);
    if (currentTrust) {
      return true;
    }

    // Only prompt the OS system dialog if requested, not already trusted, and not previously prompted
    const shouldPrompt = prompt && !hasPromptedAccessibility;
    if (shouldPrompt) {
      hasPromptedAccessibility = true;
      return systemPreferences.isTrustedAccessibilityClient(true);
    }

    return false;
  } catch (err) {
    console.warn('Inkwell: Failed to query accessibility permissions:', err);
    return false;
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
