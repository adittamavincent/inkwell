export interface CogdexSyncConfig {
  enabled: boolean;
  vaultPath: string;
  dailyFolderRoot: string;
  dayPattern: string;
  /** Auto-sync to keylog after idle timeout (seconds). 0 = disabled. */
  autoSyncIdleSecs: number;
  idleTimeoutSecs: number;
  appSwitchGraceSecs: number;
  excludedApps: string[];
}

export const DEFAULT_EXCLUDED_APPS: string[] = [
  '1password',
  'bitwarden',
  'keeper',
  'lastpass',
  'dashlane',
  'icloud keychain',
  'keypassxc',
  'macpass',
];

export const DEFAULT_CONFIG: CogdexSyncConfig = {
  enabled: false,
  vaultPath: '',
  dailyFolderRoot: 'Daily',
  dayPattern: '%Y-%m-%d',
  autoSyncIdleSecs: 30,
  idleTimeoutSecs: 60,
  appSwitchGraceSecs: 10,
  excludedApps: DEFAULT_EXCLUDED_APPS,
};
