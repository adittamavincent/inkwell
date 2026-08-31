import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.setName('Inkwell');
import { loadConfig } from './config/store';
import { getDatabase } from './db/connection';
import { startPermissionWatcher, stopPermissionWatcher } from './capture/permissionWatcher';
import { stopCapture } from './capture/keyHook';
import { stopActiveAppTracker } from './capture/activeApp';
import { registerIpcHandlers } from './ipc/registerHandlers';
import { setupTray, updateTrayMenu } from './tray/trayManager';

let mainWindow: BrowserWindow | null = null;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow(): void {
  const appRoot = app.getAppPath();
  const preloadCandidates = [
    path.join(appRoot, 'dist-electron/preload/index.cjs'),
    path.join(appRoot, '../preload/index.cjs'),
    path.join(__dirname, '../preload/index.cjs'),
    path.join(appRoot, 'dist-electron/preload/index.js'),
  ];
  const preloadPath = preloadCandidates.find((p) => fs.existsSync(p)) || preloadCandidates[0];

  const htmlCandidates = [
    path.join(appRoot, 'dist/index.html'),
    path.join(appRoot, '../dist/index.html'),
    path.join(appRoot, '../../dist/index.html'),
    path.join(__dirname, '../../dist/index.html'),
  ];
  const htmlPath = htmlCandidates.find((p) => fs.existsSync(p)) || htmlCandidates[0];

  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 760,
    minHeight: 520,
    title: 'Inkwell',
    backgroundColor: '#0d1317',
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(htmlPath);
  }
}

app.whenReady().then(() => {
  // 1. Initialize config & DB
  loadConfig();
  getDatabase();

  // 2. Register IPC bridge
  registerIpcHandlers(() => mainWindow);

  // 3. Create window & Tray
  createWindow();
  setupTray(mainWindow);

  // 4. Start continuous background permission watcher (initial sync + polling)
  startPermissionWatcher((_status) => {
    updateTrayMenu(mainWindow);
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
});

app.on('before-quit', () => {
  stopPermissionWatcher();
  stopActiveAppTracker();
  stopCapture();
});

app.on('window-all-closed', () => {
  // On macOS, keep running in background tray unless explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
