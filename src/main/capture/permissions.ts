import { systemPreferences } from 'electron';

export function checkAccessibilityPermission(prompt = false): boolean {
  if (process.platform !== 'darwin') return true;
  try {
    return systemPreferences.isTrustedAccessibilityClient(prompt);
  } catch (err) {
    console.warn('Inkwell: Failed to query accessibility permissions:', err);
    return false;
  }
}
