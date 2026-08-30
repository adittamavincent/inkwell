import { contextBridge, ipcRenderer } from 'electron';
import type { CogdexSyncConfig } from '../main/config/store';
import type { SessionPreview } from '../main/sync/sessionGrouper';

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

  // Capture Controls
  getCaptureStatus: (): Promise<boolean> => {
    return ipcRenderer.invoke('inkwell:getCaptureStatus');
  },
  toggleCapture: (start: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('inkwell:toggleCapture', start);
  },

  // Permissions
  checkPermissions: (prompt = false): Promise<boolean> => {
    return ipcRenderer.invoke('inkwell:checkPermissions', prompt);
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
