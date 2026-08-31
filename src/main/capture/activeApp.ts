import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import activeWin from 'active-win';
import { BrowserWindow, app } from 'electron';

export interface ActiveAppInfo {
  name: string;
  icon: string | null;
}

let cachedAppName = 'Unknown';
let cachedAppIcon: string | null = null;
let lastQueryTime = 0;
const CACHE_TTL_MS = 250;
let isQuerying = false;
let pollingInterval: NodeJS.Timeout | null = null;

/**
 * Confirmed real icons are stored here.
 * Null means no icon could be resolved for this app/path.
 */
const iconCache = new Map<string, string | null>();

// ─────────────────────────────────────────────────────────────────────────────
// Bundle resolution
// ─────────────────────────────────────────────────────────────────────────────

function getIcnsPathFromBundle(bundlePath: string): string | null {
  if (!fs.existsSync(bundlePath)) return null;
  const resDir = path.join(bundlePath, 'Contents/Resources');
  if (!fs.existsSync(resDir)) return null;
  const plistPath = path.join(bundlePath, 'Contents/Info.plist');

  // 1. CFBundleIconFile from Info.plist (most accurate)
  if (fs.existsSync(plistPath)) {
    try {
      const plist = fs.readFileSync(plistPath, 'utf8');
      const match = plist.match(/<key>CFBundleIconFile<\/key>\s*<string>([^<]+)<\/string>/);
      if (match && match[1]) {
        let name = match[1].trim();
        if (!name.endsWith('.icns')) name += '.icns';
        const full = path.join(resDir, name);
        if (fs.existsSync(full)) return full;
      }
    } catch {
      // Ignore
    }
  }

  // 2. First .icns found in Resources
  try {
    const files = fs.readdirSync(resDir);
    const icns = files.find((f) => f.endsWith('.icns'));
    if (icns) return path.join(resDir, icns);
  } catch {
    // Ignore
  }

  return null;
}

function findAppBundlePath(appName: string, ownerPath?: string): string | null {
  // Priority 1: ownerPath from active-win (always the most accurate signal)
  if (ownerPath) {
    const idx = ownerPath.indexOf('.app');
    if (idx !== -1) {
      const bundle = ownerPath.substring(0, idx + 4);
      if (fs.existsSync(bundle)) return bundle;
    }
    // Edge case: ownerPath itself is a .app
    if (ownerPath.endsWith('.app') && fs.existsSync(ownerPath)) return ownerPath;
  }

  if (!appName || appName === 'Unknown') return null;
  const clean = appName.trim();

  const searchDirs = [
    '/Applications',
    '/System/Applications',
    '/System/Applications/Utilities',
    '/Applications/Utilities',
    '/System/Library/CoreServices',
    path.join(os.homedir(), 'Applications'),
  ];

  // Priority 2: Exact name match
  for (const dir of searchDirs) {
    const c = path.join(dir, `${clean}.app`);
    if (fs.existsSync(c)) return c;
  }

  // Priority 3: Fuzzy — only when name is long enough to avoid collisions
  if (clean.length >= 4) {
    const lower = clean.toLowerCase();
    for (const dir of searchDirs) {
      try {
        if (!fs.existsSync(dir)) continue;
        for (const entry of fs.readdirSync(dir)) {
          if (!entry.endsWith('.app')) continue;
          const base = entry.replace(/\.app$/, '').toLowerCase();
          // Only allow substring-containment matches, not startsWith which is too loose
          if (base === lower || base.includes(lower) || lower.includes(base)) {
            return path.join(dir, entry);
          }
        }
      } catch {
        // Ignore unreadable dirs
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Icon extraction
// ─────────────────────────────────────────────────────────────────────────────

function icnsToDataUrl(icnsPath: string): string | null {
  try {
    const tmpPath = path.join(os.tmpdir(), `inkwell_icon_${Date.now()}.png`);
    execFileSync('/usr/bin/sips', [
      '-s', 'format', 'png',
      '-z', '32', '32',
      icnsPath,
      '--out', tmpPath,
    ], { timeout: 2000 });

    if (fs.existsSync(tmpPath)) {
      const buf = fs.readFileSync(tmpPath);
      try { fs.unlinkSync(tmpPath); } catch {}
      if (buf.length > 100) {
        // Sanity check: PNG magic header must be present
        if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
          return `data:image/png;base64,${buf.toString('base64')}`;
        }
      }
    }
  } catch {
    // sips unavailable or timed out
  }
  return null;
}

export async function fetchAppIcon(ownerPath?: string, appName?: string): Promise<string | null> {
  // ownerPath takes priority as cache key when available (most precise)
  const cacheKey = (appName || ownerPath || '').trim();
  if (cacheKey && iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey) ?? null;
  }

  const bundlePath = findAppBundlePath(appName || '', ownerPath);
  if (!bundlePath) {
    if (cacheKey) iconCache.set(cacheKey, null);
    return null;
  }

  // Step 1: sips-based .icns extraction — always exact, native high-res OS icon
  const icnsPath = getIcnsPathFromBundle(bundlePath);
  if (icnsPath) {
    const dataUrl = icnsToDataUrl(icnsPath);
    if (dataUrl) {
      if (cacheKey) iconCache.set(cacheKey, dataUrl);
      return dataUrl;
    }
  }

  // Step 2: Fallback for non-.icns bundles or command-line binaries that exist on disk
  if (fs.existsSync(bundlePath)) {
    try {
      const icon = await app.getFileIcon(bundlePath, { size: 'large' });
      if (icon && !icon.isEmpty()) {
        const dataUrl = icon.toDataURL();
        if (cacheKey) iconCache.set(cacheKey, dataUrl);
        return dataUrl;
      }
    } catch {
      // Ignore
    }
  }

  if (cacheKey) iconCache.set(cacheKey, null);
  return null;
}

export async function getOrResolveAppIcon(appName: string): Promise<string | null> {
  if (!appName || appName === 'Unknown') return null;
  if (iconCache.has(appName)) {
    return iconCache.get(appName) ?? null;
  }
  return fetchAppIcon(undefined, appName);
}

export function getCachedAppIcon(appName: string): string | null {
  return iconCache.get(appName) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Active app tracker
// ─────────────────────────────────────────────────────────────────────────────

function broadcastActiveApp(appInfo: ActiveAppInfo): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('inkwell:activeAppChanged', appInfo);
    }
  }
}

async function refreshActiveApp(): Promise<void> {
  if (isQuerying) return;
  isQuerying = true;
  try {
    const result = await activeWin({
      accessibilityPermission: false,
      screenRecordingPermission: false,
    });
    if (result && result.owner && result.owner.name) {
      const newName = result.owner.name.trim() || 'Unknown';
      const ownerPath = result.owner.path;
      const icon = await fetchAppIcon(ownerPath, newName);

      if (newName !== cachedAppName || icon !== cachedAppIcon) {
        cachedAppName = newName;
        cachedAppIcon = icon;
        broadcastActiveApp({ name: cachedAppName, icon: cachedAppIcon });
      }
    }
  } catch {
    // Retain cached state on transient errors
  } finally {
    lastQueryTime = Date.now();
    isQuerying = false;
  }
}

/**
 * Starts continuous background tracking of frontmost application.
 */
export function startActiveAppTracker(intervalMs = 250): void {
  if (pollingInterval) return;
  refreshActiveApp();
  pollingInterval = setInterval(() => {
    refreshActiveApp();
  }, intervalMs);
}

export function stopActiveAppTracker(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

export function getFrontmostAppName(): string {
  const now = Date.now();
  if (now - lastQueryTime > CACHE_TTL_MS) refreshActiveApp();
  return cachedAppName;
}

export function getFrontmostAppInfo(): ActiveAppInfo {
  const now = Date.now();
  if (now - lastQueryTime > CACHE_TTL_MS) refreshActiveApp();
  return { name: cachedAppName, icon: cachedAppIcon };
}

export async function forceUpdateActiveApp(): Promise<ActiveAppInfo> {
  await refreshActiveApp();
  return { name: cachedAppName, icon: cachedAppIcon };
}
