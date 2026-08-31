import { ipcMain, clipboard, BrowserWindow } from 'electron';
import {
  isCaptureRunning,
  startCapture,
  stopCapture,
} from '../capture/keyHook';
import {
  checkAccessibilityStatus,
  checkInputMonitoringStatus,
  requestAccessibilityAccess,
  requestInputMonitoringAccess,
  openAccessibilitySettings,
  openInputMonitoringSettings,
  PermissionStatus,
} from '../capture/permissions';
import { checkAndSyncPermissionState } from '../capture/permissionWatcher';
import { getFrontmostAppInfo, getOrResolveAppIcon } from '../capture/activeApp';
import { loadAllHistory, clearHistory, deleteSessionEntry } from '../db/repository';
import { getConfig, saveConfig, CogdexSyncConfig } from '../config/store';
import { doSync } from '../sync/cogdexSync';
import { updateTrayMenu } from '../tray/trayManager';

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('inkwell:getCaptureStatus', () => {
    return isCaptureRunning();
  });

  ipcMain.handle('inkwell:getActiveApp', () => {
    return getFrontmostAppInfo();
  });

  ipcMain.handle('inkwell:getAppIcon', async (_event, appName: string) => {
    return getOrResolveAppIcon(appName);
  });

  ipcMain.handle('inkwell:toggleCapture', (_event, start: boolean) => {
    if (start) {
      const acc = checkAccessibilityStatus();
      const inp = checkInputMonitoringStatus();
      if (acc === 'authorized' && inp === 'authorized') {
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

  ipcMain.handle('inkwell:checkPermissions', (): PermissionStatus => {
    const status = checkAndSyncPermissionState();
    updateTrayMenu(getMainWindow());
    return status;
  });

  ipcMain.handle('inkwell:requestAccessibility', () => {
    requestAccessibilityAccess();
  });

  ipcMain.handle('inkwell:requestInputMonitoring', () => {
    requestInputMonitoringAccess();
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

  ipcMain.handle(
    'inkwell:deleteSession',
    (_event, session: { startIso?: string; endIso?: string; app?: string; start?: any }) => {
      const startIso =
        session.startIso ||
        (session.start instanceof Date ? session.start.toISOString() : String(session.start || ''));
      const endIso = session.endIso || startIso;
      deleteSessionEntry(startIso, endIso, session.app);
    }
  );

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
