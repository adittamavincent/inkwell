import fs from 'node:fs';
import path from 'node:path';
import { getAppDataDir } from '../db/crypto';
import { logger } from '../logger';
import {
  CogdexSyncConfig,
  DEFAULT_CONFIG,
  DEFAULT_EXCLUDED_APPS,
} from '../../shared/constants';

export type { CogdexSyncConfig };
export { DEFAULT_CONFIG, DEFAULT_EXCLUDED_APPS };

const CONFIG_FILE = 'config.json';
let currentConfig: CogdexSyncConfig = { ...DEFAULT_CONFIG };

export function loadConfig(): CogdexSyncConfig {
  const configPath = path.join(getAppDataDir(), CONFIG_FILE);
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw);
      const rawExcluded = Array.isArray(parsed.excludedApps)
        ? parsed.excludedApps
        : DEFAULT_EXCLUDED_APPS;
      // Filter out 'inkwell' to prevent self-blocking
      const cleanExcluded = rawExcluded.filter(
        (a: string) => typeof a === 'string' && a.trim().toLowerCase() !== 'inkwell'
      );
      currentConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
        excludedApps: cleanExcluded,
      };
      return currentConfig;
    }
  } catch (err) {
    logger.warn('config', 'Could not read config file, using defaults', err);
  }
  currentConfig = { ...DEFAULT_CONFIG };
  return currentConfig;
}

export function saveConfig(newConfig: Partial<CogdexSyncConfig>): CogdexSyncConfig {
  currentConfig = {
    ...currentConfig,
    ...newConfig,
  };

  const configPath = path.join(getAppDataDir(), CONFIG_FILE);
  try {
    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf8');
  } catch (err) {
    console.warn('Inkwell: Could not persist config file.', err);
  }
  return currentConfig;
}

export function getConfig(): CogdexSyncConfig {
  return currentConfig;
}
