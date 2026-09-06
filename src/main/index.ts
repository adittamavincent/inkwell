import { app, BrowserWindow, Menu, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.setName('Inkwell');

import { logger } from './logger';
import { loadConfig } from './config/store';
import { getDatabase } from './db/connection';
import { startPermissionWatcher, stopPermissionWatcher } from './capture/permissionWatcher';
import { stopCapture } from './capture/keyHook';
import { stopActiveAppTracker } from './capture/activeApp';
import { registerIpcHandlers } from './ipc/registerHandlers';
import { setupTray, updateTrayMenu } from './tray/trayManager';
import { getIsQuitting, setIsQuitting, requestQuit } from './lifecycle';

// ── Global error handlers ──────────────────────────────────────────────────────
// These catch crashes that would otherwise kill the app silently.
process.on('uncaughtException', (err) => {
  logger.error('main', 'UNCAUGHT EXCEPTION — terminating process', err);
  // Give the logger time to flush before exiting
  setTimeout(() => {
    logger.writeCleanShutdown();
    logger.close();
    process.exit(1);
  }, 200);
});

process.on('unhandledRejection', (reason) => {
  logger.error('main', 'UNHANDLED PROMISE REJECTION', reason);
});

process.on('warning', (warning) => {
  logger.warn('main', `Node process warning: ${warning.name}`, warning);
});

process.on('beforeExit', (code) => {
  logger.info('main', `Process beforeExit (code=${code})`);
});

process.on('exit', (code) => {
  // exit handlers must remain synchronous; logger writes synchronously when possible
  logger.info('main', `Process exit (code=${code})`);
});

process.on('SIGTERM', () => {
  logger.info('main', 'Received SIGTERM, quitting...');
  requestQuit();
});

process.on('SIGINT', () => {
  logger.info('main', 'Received SIGINT, quitting...');
  requestQuit();
});

export { requestQuit };

let mainWindow: BrowserWindow | null = null;

export function showWindow(): void {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.show();
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
}

export function hideWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    mainWindow.hide();
  }
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }
}

function setupApplicationMenu(): void {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Inkwell',
      submenu: [
        { role: 'about', label: 'About Inkwell' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: 'Hide Inkwell' },
        { role: 'hideOthers', label: 'Hide Others' },
        { role: 'unhide', label: 'Show All' },
        { type: 'separator' },
        {
          label: 'Close Window',
          accelerator: 'CommandOrControl+W',
          click: () => {
            hideWindow();
          },
        },
        {
          label: 'Close to Menu Bar',
          accelerator: 'CommandOrControl+Q',
          click: () => {
            hideWindow();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  setIsQuitting(true);
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow();
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
    show: false,
    skipTaskbar: true,
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

  // DO NOT call showWindow() from ready-to-show — this steals focus from the user's
  // current app on launch. The tray icon handles window visibility instead.
  mainWindow.on('ready-to-show', () => {
    logger.info('main', 'BrowserWindow ready-to-show (staying hidden for tray app)');
  });

  mainWindow.on('show', () => {
    if (process.platform === 'darwin' && app.dock) {
      app.dock.show();
    }
  });

  mainWindow.on('hide', () => {
    if (process.platform === 'darwin' && app.dock) {
      app.dock.hide();
    }
  });

  mainWindow.on('close', (event) => {
    if (!getIsQuitting() && process.platform === 'darwin') {
      event.preventDefault();
      hideWindow();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    logger.error('renderer', 'WebContents failed to load', {
      errorCode, errorDescription, validatedURL, isMainFrame,
    });
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger.error('renderer', 'Renderer process gone', details);
  });
  mainWindow.webContents.on('unresponsive', () => logger.warn('renderer', 'Renderer became unresponsive'));
  mainWindow.webContents.on('responsive', () => logger.info('renderer', 'Renderer became responsive'));
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      logger.error('renderer', 'Renderer console error', { level, message, line, sourceId });
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(htmlPath);
  }
}

app.whenReady().then(() => {
  logger.checkPreviousRun();
  logger.info('main', 'Build info', { appVersion: app.getVersion(), logFormatVersion: 2 });
  logger.info('main', `App ready — PID ${process.pid}, platform ${process.platform}`, {
    versions: process.versions,
    run: logger.getRunContext(),
    args: process.argv,
    cwd: process.cwd(),
  });

  // Set custom Dock icon in dev mode if available
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = path.join(app.getAppPath(), 'icons', 'icon.icns');
    if (fs.existsSync(iconPath)) {
      try {
        app.dock.setIcon(iconPath);
      } catch {
        // Ignore fallback
      }
    }
  }

  // 1. Initialize config & DB
  loadConfig();
  getDatabase();
  logger.info('main', 'Config and database initialized');

  // 2. Setup macOS Application Menu
  setupApplicationMenu();

  // 3. Register IPC bridge
  registerIpcHandlers(() => mainWindow);

  // 4. Create window & Tray
  createWindow();
  setupTray(() => mainWindow, showWindow, hideWindow);

  // 5. Start continuous background permission watcher (initial sync + polling)
  startPermissionWatcher((_status) => {
    updateTrayMenu(() => mainWindow, showWindow);
  }, 2000);

  logger.info('main', 'Initialization complete');
  logger.startHeartbeat();

  app.on('activate', () => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      showWindow();
    }
  });
});

app.on('before-quit', (event) => {
  // On macOS, prevent quitting unless requestQuit() was explicitly called (e.g. from Tray menu)
  if (!getIsQuitting() && process.platform === 'darwin') {
    logger.debug('main', 'before-quit intercepted — hiding window because quit was not requested');
    event.preventDefault();
    hideWindow();
    return;
  }

  logger.info('main', 'before-quit — cleaning up resources');
  setIsQuitting(true);
  stopPermissionWatcher();
  stopActiveAppTracker();
  stopCapture();
  logger.writeCleanShutdown();
  logger.close();
});

app.on('child-process-gone', (_event, details) => {
  logger.error('main', 'Electron child process gone', details);
});

app.on('window-all-closed', () => {
  // On macOS, keep running in background tray unless explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
