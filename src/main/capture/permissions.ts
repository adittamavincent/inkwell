import { systemPreferences, shell } from 'electron';

export function checkAccessibilityPermission(prompt = false): boolean {
  if (process.platform !== 'darwin') return true;
  try {
    return systemPreferences.isTrustedAccessibilityClient(prompt);
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
