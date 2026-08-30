import { ipcMain, clipboard, BrowserWindow } from 'electron';
import { isCaptureRunning, startCapture, stopCapture, restartCapture } from '../capture/keyHook';
import { checkAccessibilityPermission, openAccessibilitySettings } from '../capture/permissions';
import {
  startPermissionWatcher,
  isPermissionWatcherRunning,
} from '../capture/permissionWatcher';
import { loadAllHistory, clearHistory } from '../db/repository';
import { getConfig, saveConfig, CogdexSyncConfig } from '../config/store';
import { doSync } from '../sync/cogdexSync';
import { updateTrayMenu } from '../tray/trayManager';

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('inkwell:getCaptureStatus', () => {
    return isCaptureRunning();
  });

  ipcMain.handle('inkwell:toggleCapture', (_event, start: boolean) => {
    if (start) {
      startCapture();
    } else {
      stopCapture();
    }
    const running = isCaptureRunning();
    updateTrayMenu(getMainWindow());
    return running;
  });

  ipcMain.handle('inkwell:checkPermissions', (_event, prompt: boolean) => {
    const hasPerm = checkAccessibilityPermission(prompt);
    if (hasPerm) {
      if (!isCaptureRunning()) {
        startCapture();
      }
    } else if (!isPermissionWatcherRunning()) {
      startPermissionWatcher(() => {
        startCapture();
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('inkwell:permissionGranted');
        }
      });
    }
    return hasPerm;
  });

  ipcMain.handle('inkwell:openSystemSettings', () => {
    openAccessibilitySettings();
    if (!isPermissionWatcherRunning()) {
      startPermissionWatcher(() => {
        startCapture();
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('inkwell:permissionGranted');
        }
      });
    }
  });

  ipcMain.handle('inkwell:getHistory', () => {
    const config = getConfig();
    return loadAllHistory(config.idleTimeoutSecs);
  });

  ipcMain.handle('inkwell:clearHistory', () => {
    clearHistory();
  });

  ipcMain.handle('inkwell:copyToClipboard', (_event, text: string) => {
    clipboard.writeText(text);
  });

  ipcMain.handle('inkwell:getConfig', () => {
    return getConfig();
  });

  ipcMain.handle('inkwell:saveConfig', (_event, newConfig: Partial<CogdexSyncConfig>) => {
    return saveConfig(newConfig);
  });

  ipcMain.handle('inkwell:forceSync', () => {
    const config = getConfig();
    return doSync(config);
  });
}
