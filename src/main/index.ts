import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { loadConfig } from './config/store';
import { getDatabase } from './db/connection';
import { checkAccessibilityPermission } from './capture/permissions';
import { startCapture, stopCapture } from './capture/keyHook';
import { registerIpcHandlers } from './ipc/registerHandlers';
import { setupTray } from './tray/trayManager';

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
  const preloadPath = path.join(appRoot, 'dist-electron/preload/index.js');
  const htmlPath = path.join(appRoot, 'dist/index.html');

  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 760,
    minHeight: 520,
    title: 'Inkwell',
    backgroundColor: '#1b1b1f',
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
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

  // 4. Check macOS Input Monitoring / Accessibility permissions
  const hasPerm = checkAccessibilityPermission(true);
  if (!hasPerm) {
    console.warn(
      'Inkwell: Accessibility / Input Monitoring permission not granted. Global key capture may not receive events.'
    );
  }

  // 5. Start global key listener
  startCapture();

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
  stopCapture();
});

app.on('window-all-closed', () => {
  // On macOS, keep running in background tray unless explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
