import { contextBridge, ipcRenderer } from 'electron';
import type { CogdexSyncConfig } from '../main/config/store';
import type { SessionPreview } from '../main/sync/sessionGrouper';
import type { CaptureHealth } from '../main/capture/keyHook';

export type { CaptureHealth };

export interface KeystrokePayload {
  timestamp: string;
  appName: string;
  keyChar: string;
}

export interface SyncResponse {
  success: boolean;
  message: string;
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
  onActiveAppChanged: (callback: (appName: string) => void) => {
    const handler = (_event: any, appName: string) => callback(appName);
    ipcRenderer.on('inkwell:activeAppChanged', handler);
    return () => {
      ipcRenderer.removeListener('inkwell:activeAppChanged', handler);
    };
  },
  getActiveApp: (): Promise<string> => {
    return ipcRenderer.invoke('inkwell:getActiveApp');
  },

  // Capture Controls & Health
  getCaptureStatus: (): Promise<boolean> => {
    return ipcRenderer.invoke('inkwell:getCaptureStatus');
  },
  getCaptureHealth: (): Promise<CaptureHealth> => {
    return ipcRenderer.invoke('inkwell:getCaptureHealth');
  },
  onCaptureHealthChanged: (callback: (health: CaptureHealth) => void) => {
    const handler = (_event: any, health: CaptureHealth) => callback(health);
    ipcRenderer.on('inkwell:captureHealthChanged', handler);
    return () => {
      ipcRenderer.removeListener('inkwell:captureHealthChanged', handler);
    };
  },
  toggleCapture: (start: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('inkwell:toggleCapture', start);
  },

  // Permissions
  checkPermissions: (prompt = false): Promise<boolean> => {
    return ipcRenderer.invoke('inkwell:checkPermissions', prompt);
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
  onPermissionStatusChanged: (callback: (granted: boolean) => void) => {
    const handler = (_event: any, granted: boolean) => callback(granted);
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
