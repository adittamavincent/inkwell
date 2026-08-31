import { contextBridge, ipcRenderer } from 'electron';
import type { CogdexSyncConfig } from '../main/config/store';
import type { SessionPreview } from '../main/sync/sessionGrouper';
import type { AuthStatus, PermissionStatus } from '../main/capture/permissions';

export type { AuthStatus, PermissionStatus };

export interface KeystrokePayload {
  timestamp: string;
  appName: string;
  keyChar: string;
}

export interface SyncResponse {
  success: boolean;
  message: string;
}

export interface ActiveAppInfo {
  name: string;
  icon: string | null;
}

export const api = {
  // Keystroke Stream Listener
  onKeystroke: (callback: (payload: KeystrokePayload) => void) => {
    const handler = (_event: any, data: KeystrokePayload) => callback(data);
    ipcRenderer.on('inkwell:keystroke', handler);
    return () => {
      ipcRenderer.removeListener('inkwell:keystroke', handler);
    };
  },

  // Active App Listener & Getter
  onActiveAppChanged: (callback: (appInfo: ActiveAppInfo | string) => void) => {
    const handler = (_event: any, appInfo: ActiveAppInfo | string) => callback(appInfo);
    ipcRenderer.on('inkwell:activeAppChanged', handler);
    return () => {
      ipcRenderer.removeListener('inkwell:activeAppChanged', handler);
    };
  },
  getActiveApp: (): Promise<ActiveAppInfo | string> => {
    return ipcRenderer.invoke('inkwell:getActiveApp');
  },
  getAppIcon: (appName: string): Promise<string | null> => {
    return ipcRenderer.invoke('inkwell:getAppIcon', appName);
  },

  // Capture Controls
  getCaptureStatus: (): Promise<boolean> => {
    return ipcRenderer.invoke('inkwell:getCaptureStatus');
  },
  toggleCapture: (start: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('inkwell:toggleCapture', start);
  },

  // Permissions (3/4-State Native OS Model)
  checkPermissions: (): Promise<PermissionStatus> => {
    return ipcRenderer.invoke('inkwell:checkPermissions');
  },
  requestAccessibility: (): Promise<void> => {
    return ipcRenderer.invoke('inkwell:requestAccessibility');
  },
  requestInputMonitoring: (): Promise<void> => {
    return ipcRenderer.invoke('inkwell:requestInputMonitoring');
  },
  openAccessibilitySettings: (): Promise<void> => {
    return ipcRenderer.invoke('inkwell:openAccessibilitySettings');
  },
  openInputMonitoringSettings: (): Promise<void> => {
    return ipcRenderer.invoke('inkwell:openInputMonitoringSettings');
  },
  openSystemSettings: (): Promise<void> => {
    return ipcRenderer.invoke('inkwell:openSystemSettings');
  },
  onPermissionGranted: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('inkwell:permissionGranted', handler);
    return () => {
      ipcRenderer.removeListener('inkwell:permissionGranted', handler);
    };
  },
  onPermissionRevoked: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('inkwell:permissionRevoked', handler);
    return () => {
      ipcRenderer.removeListener('inkwell:permissionRevoked', handler);
    };
  },
  onPermissionStatusChanged: (callback: (status: PermissionStatus) => void) => {
    const handler = (_event: any, status: PermissionStatus) => callback(status);
    ipcRenderer.on('inkwell:permissionStatusChanged', handler);
    return () => {
      ipcRenderer.removeListener('inkwell:permissionStatusChanged', handler);
    };
  },

  // History Actions
  getHistory: (): Promise<SessionPreview[]> => {
    return ipcRenderer.invoke('inkwell:getHistory');
  },
  clearHistory: (): Promise<void> => {
    return ipcRenderer.invoke('inkwell:clearHistory');
  },
  copyToClipboard: (text: string): Promise<void> => {
    return ipcRenderer.invoke('inkwell:copyToClipboard', text);
  },

  // Config & Cogdex Sync
  getConfig: (): Promise<CogdexSyncConfig> => {
    return ipcRenderer.invoke('inkwell:getConfig');
  },
  saveConfig: (config: Partial<CogdexSyncConfig>): Promise<CogdexSyncConfig> => {
    return ipcRenderer.invoke('inkwell:saveConfig', config);
  },
  forceSync: (): Promise<SyncResponse> => {
    return ipcRenderer.invoke('inkwell:forceSync');
  },
};

contextBridge.exposeInMainWorld('inkwellApi', api);
