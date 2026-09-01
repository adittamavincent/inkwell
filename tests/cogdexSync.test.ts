import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { doSync } from '../src/main/sync/cogdexSync';
import * as repo from '../src/main/db/repository';

describe('Cogdex Obsidian Sync', () => {
  let tmpVault: string;

  beforeEach(() => {
    tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), 'inkwell-test-vault-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpVault, { recursive: true, force: true });
    } catch {
      // ignore
    }
    vi.restoreAllMocks();
  });

  it('cleanly appends new sessions to existing README.md without any boundary markers', () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const noteDir = path.join(tmpVault, 'Daily', dayStr);
    fs.mkdirSync(noteDir, { recursive: true });
    const notePath = path.join(noteDir, 'README.md');

    const existingContent = '## 09:00 — Terminal\n\ngit status\n';
    fs.writeFileSync(notePath, existingContent, 'utf8');

    vi.spyOn(repo, 'querySessionsSince').mockReturnValue([
      [now.toISOString(), 'Obsidian', 'n'],
      [now.toISOString(), 'Obsidian', 'e'],
      [now.toISOString(), 'Obsidian', 'w'],
    ]);

    const result = doSync({
      enabled: true,
      vaultPath: tmpVault,
      dailyFolderRoot: 'Daily',
      dayPattern: '%Y-%m-%d',
      autoSyncIdleSecs: 30,
      idleTimeoutSecs: 60,
      appSwitchGraceSecs: 10,
      excludedApps: [],
    });

    expect(result.success).toBe(true);

    const fileContent = fs.readFileSync(notePath, 'utf8');
    expect(fileContent).toContain('## 09:00 — Terminal');
    expect(fileContent).toContain('git status');
    expect(fileContent).toContain('Obsidian');
    expect(fileContent).toContain('new');
    expect(fileContent).not.toContain('LOG-BELOW');
  });

  it('creates parent folder and writes README.md if file does not exist yet', () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const notePath = path.join(tmpVault, 'Daily', dayStr, 'README.md');

    vi.spyOn(repo, 'querySessionsSince').mockReturnValue([
      [now.toISOString(), 'Code', 'h'],
      [now.toISOString(), 'Code', 'i'],
    ]);

    const result = doSync({
      enabled: true,
      vaultPath: tmpVault,
      dailyFolderRoot: 'Daily',
      dayPattern: '%Y-%m-%d',
      autoSyncIdleSecs: 30,
      idleTimeoutSecs: 60,
      appSwitchGraceSecs: 10,
      excludedApps: [],
    });

    expect(result.success).toBe(true);
    expect(fs.existsSync(notePath)).toBe(true);

    const content = fs.readFileSync(notePath, 'utf8');
    expect(content).not.toContain('LOG-BELOW');
    expect(content).toContain('## ');
    expect(content).toContain('Code');
    expect(content).toContain('hi');
  });
});
