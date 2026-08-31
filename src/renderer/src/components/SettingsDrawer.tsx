import React, { useState, useEffect } from 'react';
import { CogdexSyncConfig, SyncResponse } from '../types';
import { X, RefreshCw } from 'lucide-react';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  config: CogdexSyncConfig;
  onSaveConfig: (newConfig: Partial<CogdexSyncConfig>) => Promise<void>;
  onForceSync: () => Promise<SyncResponse>;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onForceSync,
}) => {
  const [form, setForm] = useState<CogdexSyncConfig>({ ...config });
  const [excludedAppsText, setExcludedAppsText] = useState(
    config.excludedApps.join(', ')
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncResponse | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setForm({ ...config });
    setExcludedAppsText(config.excludedApps.join(', '));
  }, [config]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    const apps = excludedAppsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    await onSaveConfig({
      ...form,
      excludedApps: apps,
      idleTimeoutSecs: Number(form.idleTimeoutSecs) || 60,
      appSwitchGraceSecs: Number(form.appSwitchGraceSecs) || 10,
    });

    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await onForceSync();
      setSyncStatus(res);
    } catch (err: any) {
      setSyncStatus({
        success: false,
        message: err?.message || 'Sync request failed',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <aside
      className={`fixed top-0 right-0 bottom-0 w-96 bg-ink-sidebar border-l border-ink-border shadow-2xl flex flex-col z-30 transform transition-transform duration-250 ease-out select-none ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="h-13 px-4 border-b border-ink-border flex items-center justify-between bg-ink-sidebar/95">
        <span className="font-serif text-sm font-semibold tracking-tight text-ink-text">
          Vault Sync & Engine
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-ink-panel text-ink-muted hover:text-ink-text transition-colors"
          title="Close Settings"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Dev Mode TCC Identity Notice */}
        {import.meta.env.DEV && (
          <div className="p-3 rounded-md bg-ink-accent-muted/30 border border-ink-accent/30 text-ink-accent-light space-y-1">
            <div className="font-mono text-[11px] font-semibold text-ink-accent-light">
              Dev Mode Permission Identity
            </div>
            <p className="text-[11px] font-sans leading-relaxed text-ink-muted">
              In dev mode, macOS assigns permissions to the <strong className="text-ink-text font-semibold">'Electron'</strong> bundle rather than Inkwell.
            </p>
          </div>
        )}

        {/* Master Switch */}
        <div className="p-3 bg-ink-panel rounded-md border border-ink-border flex items-center justify-between">
          <div className="pr-3">
            <div className="font-medium text-ink-text text-xs">Enable Vault Sync</div>
            <div className="text-ink-muted text-[11px] leading-tight mt-0.5">
              Append completed keylog sessions to your Obsidian daily note
            </div>
          </div>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="w-4 h-4 rounded border-ink-border bg-ink-bg text-ink-accent focus:ring-0 cursor-pointer accent-ink-accent"
          />
        </div>

        {/* Vault Path */}
        <div>
          <label className="block font-medium text-ink-text mb-1">
            Obsidian Vault Path (Absolute)
          </label>
          <input
            type="text"
            placeholder="/Users/username/Documents/ObsidianVault"
            value={form.vaultPath}
            onChange={(e) => setForm({ ...form, vaultPath: e.target.value })}
            className="w-full bg-ink-bg border border-ink-border rounded px-2.5 py-1.5 text-ink-text font-mono text-xs focus:border-ink-accent transition-colors"
          />
        </div>

        {/* Daily Folder Root */}
        <div>
          <label className="block font-medium text-ink-text mb-1 flex items-center justify-between">
            <span>Daily Folder Root</span>
            <span className="text-ink-muted font-mono text-[10px]">(default: Daily)</span>
          </label>
          <input
            type="text"
            placeholder="Daily"
            value={form.dailyFolderRoot}
            onChange={(e) => setForm({ ...form, dailyFolderRoot: e.target.value })}
            className="w-full bg-ink-bg border border-ink-border rounded px-2.5 py-1.5 text-ink-text font-mono text-xs focus:border-ink-accent transition-colors"
          />
        </div>

        {/* Day Pattern & Suffix */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block font-medium text-ink-text mb-1">Day Pattern</label>
            <input
              type="text"
              placeholder="%Y-%m-%d"
              value={form.dayPattern}
              onChange={(e) => setForm({ ...form, dayPattern: e.target.value })}
              className="w-full bg-ink-bg border border-ink-border rounded px-2.5 py-1.5 text-ink-text font-mono text-xs focus:border-ink-accent transition-colors"
            />
          </div>
          <div>
            <label className="block font-medium text-ink-text mb-1">Keylog Suffix</label>
            <input
              type="text"
              placeholder=" - keylog"
              value={form.keylogSuffix}
              onChange={(e) => setForm({ ...form, keylogSuffix: e.target.value })}
              className="w-full bg-ink-bg border border-ink-border rounded px-2.5 py-1.5 text-ink-text font-mono text-xs focus:border-ink-accent transition-colors"
            />
          </div>
        </div>

        {/* Idle Timeout & App Switch Grace Period */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block font-medium text-ink-text mb-1">
              Idle Gap (s)
            </label>
            <input
              type="number"
              min="5"
              max="3600"
              value={form.idleTimeoutSecs}
              onChange={(e) =>
                setForm({ ...form, idleTimeoutSecs: parseInt(e.target.value, 10) || 60 })
              }
              className="w-full bg-ink-bg border border-ink-border rounded px-2.5 py-1.5 text-ink-text font-mono text-xs focus:border-ink-accent transition-colors"
            />
          </div>
          <div>
            <label className="block font-medium text-ink-text mb-1">
              App Grace (s)
            </label>
            <input
              type="number"
              min="1"
              max="300"
              value={form.appSwitchGraceSecs}
              onChange={(e) =>
                setForm({ ...form, appSwitchGraceSecs: parseInt(e.target.value, 10) || 10 })
              }
              className="w-full bg-ink-bg border border-ink-border rounded px-2.5 py-1.5 text-ink-text font-mono text-xs focus:border-ink-accent transition-colors"
            />
          </div>
        </div>

        {/* Excluded Apps */}
        <div>
          <label className="block font-medium text-ink-text mb-1">
            Excluded Applications
          </label>
          <textarea
            rows={3}
            value={excludedAppsText}
            onChange={(e) => setExcludedAppsText(e.target.value)}
            placeholder="1password, bitwarden, inkwell, ..."
            className="w-full bg-ink-bg border border-ink-border rounded px-2.5 py-1.5 text-ink-text font-mono text-xs focus:border-ink-accent transition-colors resize-none"
          />
          <span className="text-[10px] text-ink-muted block mt-1">
            Keystrokes occurring within these apps will not be logged.
          </span>
        </div>

        {/* Sync Status Banner */}
        {syncStatus && (
          <div
            className={`p-2.5 rounded-md border text-[11px] font-mono leading-relaxed break-words ${
              syncStatus.success
                ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
                : 'bg-rose-950/30 border-rose-800/40 text-rose-300'
            }`}
          >
            {syncStatus.message}
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-3.5 border-t border-ink-border bg-ink-sidebar">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center justify-center py-2 px-3 rounded bg-ink-panel hover:bg-ink-hover border border-ink-border text-ink-text font-medium transition-colors text-xs"
          >
            <span>{saveSuccess ? 'Saved' : 'Save Config'}</span>
          </button>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-ink-accent hover:bg-ink-accent-hover text-white font-medium transition-colors text-xs shadow-sm"
          >
            {isSyncing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{isSyncing ? 'Syncing...' : 'Force Sync'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};


