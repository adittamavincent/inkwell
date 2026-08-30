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
  keylogSuffix: ' - keylog',
  idleTimeoutSecs: 60,
  appSwitchGraceSecs: 10,
  excludedApps: DEFAULT_EXCLUDED_APPS,
};
