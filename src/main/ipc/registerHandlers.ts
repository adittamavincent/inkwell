import { ipcMain, clipboard, BrowserWindow } from 'electron';
import {
  isCaptureRunning,
  startCapture,
  stopCapture,
  restartCapture,
  getCaptureHealth,
} from '../capture/keyHook';
import {
  checkAccessibilityPermission,
  openAccessibilitySettings,
  openInputMonitoringSettings,
} from '../capture/permissions';
import { getFrontmostAppName } from '../capture/activeApp';
import { loadAllHistory, clearHistory } from '../db/repository';
import { getConfig, saveConfig, CogdexSyncConfig } from '../config/store';
import { doSync } from '../sync/cogdexSync';
import { updateTrayMenu } from '../tray/trayManager';

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('inkwell:getCaptureStatus', () => {
    return isCaptureRunning();
  });

  ipcMain.handle('inkwell:getCaptureHealth', () => {
    return getCaptureHealth();
  });

  ipcMain.handle('inkwell:getActiveApp', () => {
    return getFrontmostAppName();
  });

  ipcMain.handle('inkwell:toggleCapture', (_event, start: boolean) => {
    if (start) {
      const hasPerm = checkAccessibilityPermission(false);
      if (hasPerm) {
        startCapture();
      } else {
        stopCapture();
      }
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
    } else {
      if (isCaptureRunning()) {
        stopCapture();
      }
    }
    updateTrayMenu(getMainWindow());
    return hasPerm;
  });

  ipcMain.handle('inkwell:openAccessibilitySettings', () => {
    openAccessibilitySettings();
  });

  ipcMain.handle('inkwell:openInputMonitoringSettings', () => {
    openInputMonitoringSettings();
  });

  ipcMain.handle('inkwell:openSystemSettings', () => {
    openAccessibilitySettings();
  });

  ipcMain.handle('inkwell:getHistory', () => {
    const config = getConfig();
    return loadAllHistory(config.idleTimeoutSecs, config.appSwitchGraceSecs);
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
