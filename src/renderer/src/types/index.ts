export type AuthStatus = 'authorized' | 'denied' | 'not determined' | 'restricted';

export interface PermissionStatus {
  accessibility: AuthStatus;
  inputMonitoring: AuthStatus;
}

export interface CogdexSyncConfig {
  enabled: boolean;
  vaultPath: string;
  dailyFolderRoot: string;
  dayPattern: string;
  keylogSuffix: string;
  idleTimeoutSecs: number;
  appSwitchGraceSecs: number;
  excludedApps: string[];
}

export interface SessionPreview {
  start: string | Date;
  app: string;
  text: string;
}

export interface KeystrokePayload {
  timestamp: string;
  appName: string;
  keyChar: string;
}

export interface SyncResponse {
  success: boolean;
  message: string;
}
