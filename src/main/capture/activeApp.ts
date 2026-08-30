import activeWin from 'active-win';

let cachedAppName = 'Unknown';
let lastQueryTime = 0;
const CACHE_TTL_MS = 250;
let isQuerying = false;

async function refreshActiveApp(): Promise<void> {
  if (isQuerying) return;
  isQuerying = true;
  try {
    const result = await activeWin();
    if (result && result.owner && result.owner.name) {
      cachedAppName = result.owner.name;
    }
  } catch {
    // If permission or query fails, retain cached or fallback
  } finally {
    lastQueryTime = Date.now();
    isQuerying = false;
  }
}

/**
 * Returns the currently frontmost application name.
 * Reads from a fast in-memory cache and refreshes every 250ms
 * so the keystroke capture loop is never blocked by OS window inspection.
 */
export function getFrontmostAppName(): string {
  const now = Date.now();
  if (now - lastQueryTime > CACHE_TTL_MS) {
    // Trigger async refresh without awaiting
    refreshActiveApp();
  }
  return cachedAppName;
}

export async function forceUpdateActiveApp(): Promise<string> {
  await refreshActiveApp();
  return cachedAppName;
}
