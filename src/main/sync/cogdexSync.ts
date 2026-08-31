import fs from 'node:fs';
import path from 'node:path';
import { CogdexSyncConfig } from '../config/store';
import { querySessionsSince } from '../db/repository';
import { groupSessions, SessionPreview } from './sessionGrouper';
import { getLastSync, writeLastSync } from './watermark';

function formatStrftime(pattern: string, date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const Y = date.getFullYear().toString();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const H = pad(date.getHours());
  const M = pad(date.getMinutes());
  const S = pad(date.getSeconds());

  return pattern
    .replace(/%Y/g, Y)
    .replace(/%m/g, m)
    .replace(/%d/g, d)
    .replace(/%H/g, H)
    .replace(/%M/g, M)
    .replace(/%S/g, S);
}

function stripLeadingSlash(s: string): string {
  return s.replace(/^\/+/, '');
}

function buildSessionBlocks(sessions: SessionPreview[]): string[] {
  return sessions.map((s) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const startDate = s.start instanceof Date ? s.start : new Date(s.start);
    const headerTime = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`;
    const header = s.app ? `## ${headerTime} — ${s.app}` : `## ${headerTime}`;
    return `${header}\n\n${s.text}\n`;
  });
}

function appendToNote(filePath: string, blocks: string[]): void {
  const parent = path.dirname(filePath);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }

  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const appended = blocks.join('\n');

  let newContent: string;
  if (existing.trim().length > 0) {
    const sep = existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
    newContent = `${existing}${sep}${appended}`;
  } else {
    newContent = `${appended}\n`;
  }

  fs.writeFileSync(filePath, newContent, 'utf8');
}

export function doSync(config: CogdexSyncConfig): { success: boolean; message: string } {
  if (!config.enabled) {
    return {
      success: true,
      message: 'Cogdex sync is disabled (opt-in). Nothing to do.',
    };
  }

  const vaultPath = (config.vaultPath || '').trim();
  if (!vaultPath) {
    return {
      success: false,
      message: 'Cogdex vault path is not configured.',
    };
  }

  const lastSync = getLastSync();
  const sinceDate = lastSync || new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = querySessionsSince(sinceDate.toISOString());

  if (rows.length === 0) {
    return {
      success: true,
      message: 'No new keystrokes to sync.',
    };
  }

  const sessions = groupSessions(rows, config.idleTimeoutSecs, config.appSwitchGraceSecs);
  if (sessions.length === 0) {
    return {
      success: true,
      message: 'Captured sessions were too short to sync.',
    };
  }

  const now = new Date();
  const dayPattern = config.dayPattern || '%Y-%m-%d';
  const dayName = formatStrftime(dayPattern, now);
  const cleanVault = vaultPath.replace(/\/+$/, '');
  const dailyRoot = stripLeadingSlash(config.dailyFolderRoot || 'Daily');
  const suffix = config.keylogSuffix ?? ' - keylog';

  const notePath = path.join(
    cleanVault,
    dailyRoot,
    dayName,
    `${dayName}${suffix}.md`
  );

  const blocks = buildSessionBlocks(sessions);

  try {
    appendToNote(notePath, blocks);
    writeLastSync(now);
    return {
      success: true,
      message: `Synced ${sessions.length} session(s) to ${notePath}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Sync failed: ${err?.message || String(err)}`,
    };
  }
}
