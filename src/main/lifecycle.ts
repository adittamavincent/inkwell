import { app } from 'electron';

let isQuitting = false;

export function getIsQuitting(): boolean {
  return isQuitting;
}

export function setIsQuitting(val: boolean): void {
  isQuitting = val;
}

export function requestQuit(): void {
  isQuitting = true;
  app.quit();
}

/**
 * Resets internal state for unit testing purposes.
 */
export function _resetLifecycleForTesting(): void {
  isQuitting = false;
}
