import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import activeWin from 'active-win';
import { BrowserWindow, app } from 'electron';
import { logger } from '../logger';

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
let lastSuppressedLogTime = 0;
const SUPPRESS_LOG_INTERVAL_MS = 5000;

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

function icnsToDataUrl(icnsPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const tmpPath = path.join(os.tmpdir(), `inkwell_icon_${Date.now()}.png`);
      execFile('/usr/bin/sips', [
        '-s', 'format', 'png',
        '-z', '32', '32',
        icnsPath,
        '--out', tmpPath,
      ], { timeout: 2000 }, (err) => {
        if (err) {
          resolve(null);
          return;
        }
        try {
          if (fs.existsSync(tmpPath)) {
            const buf = fs.readFileSync(tmpPath);
            try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
            if (buf.length > 100 &&
                buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
              resolve(`data:image/png;base64,${buf.toString('base64')}`);
              return;
            }
          }
        } catch { /* ignore */ }
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

function findInkwellIconPath(): string | null {
  try {
    const appRoot = app.getAppPath();
    const candidates = [
      path.join(appRoot, 'icons/icon.icns'),
      path.join(appRoot, '../icons/icon.icns'),
      path.join(appRoot, '../../icons/icon.icns'),
      path.join(process.cwd(), 'icons/icon.icns'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } catch {
    // Ignore
  }
  return null;
}

export async function fetchAppIcon(ownerPath?: string, appName?: string): Promise<string | null> {
  const cleanName = (appName || '').trim();
  const isInkwell =
    cleanName.toLowerCase() === 'inkwell' ||
    cleanName.toLowerCase() === 'electron' ||
    (ownerPath && (ownerPath.includes('Electron.app') || ownerPath.includes('Inkwell.app')));

  if (isInkwell) {
    if (iconCache.has('Inkwell')) {
      return iconCache.get('Inkwell') ?? null;
    }
    const inkwellIconPath = findInkwellIconPath();
    if (inkwellIconPath) {
      const dataUrl = await icnsToDataUrl(inkwellIconPath);
      if (dataUrl) {
        iconCache.set('Inkwell', dataUrl);
        iconCache.set('Electron', dataUrl);
        return dataUrl;
      }
    }
  }

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

  // Step 1: async sips-based .icns extraction — non-blocking, native high-res OS icon
  const icnsPath = getIcnsPathFromBundle(bundlePath);
  if (icnsPath) {
    const dataUrl = await icnsToDataUrl(icnsPath);
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
      let newName = result.owner.name.trim() || 'Unknown';
      const ownerPath = result.owner.path;

      const isCurrentApp =
        newName.toLowerCase() === 'electron' ||
        newName.toLowerCase() === 'inkwell' ||
        (result.owner as any).bundleId === 'com.github.Electron' ||
        (result.owner as any).bundleId === 'com.inkwell.app' ||
        result.owner.processId === process.pid ||
        (ownerPath && (ownerPath.includes('Electron.app') || ownerPath.includes('Inkwell.app')));

      if (isCurrentApp) {
        // Do NOT broadcast Inkwell as the active app — this causes ghost focus issues.
        // Keep the previous cached app name so other apps aren't interrupted.
        const now = Date.now();
        if (now - lastSuppressedLogTime > SUPPRESS_LOG_INTERVAL_MS) {
          logger.debug('activeApp', `activeWin returned Inkwell/Electron (pid=${result.owner.processId}), suppressing broadcast`);
          lastSuppressedLogTime = now;
        }
        return;
      }

      const icon = await fetchAppIcon(ownerPath, newName);

      if (newName !== cachedAppName || icon !== cachedAppIcon) {
        cachedAppName = newName;
        cachedAppIcon = icon;
        logger.debug('activeApp', `Active app changed to: ${newName}`);
        broadcastActiveApp({ name: cachedAppName, icon: cachedAppIcon });
      }
    }
  } catch (err) {
    logger.warn('activeApp', 'refreshActiveApp error (retaining cached state)', err);
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

/**
 * Returns the cached frontmost app name. Safe to call from any thread
 * (including uiohook's native event-tap thread) — never triggers native
 * calls (activeWin, sips, getFileIcon). The250ms polling tracker
 * (startActiveAppTracker) keeps the cache fresh.
 */
export function getFrontmostAppName(): string {
  return cachedAppName;
}

/**
 * Returns the cached frontmost app info. Safe to call from any thread.
 * Use forceUpdateActiveApp() when an immediate refresh is required.
 */
export function getFrontmostAppInfo(): ActiveAppInfo {
  return { name: cachedAppName, icon: cachedAppIcon };
}

export async function forceUpdateActiveApp(): Promise<ActiveAppInfo> {
  await refreshActiveApp();
  return { name: cachedAppName, icon: cachedAppIcon };
}
