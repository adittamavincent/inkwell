import React, { useState, useEffect } from 'react';
import { CogdexSyncConfig, SyncResponse } from '../types';
import {
  X,
  Save,
  RefreshCw,
  FolderSync,
  ShieldAlert,
  Clock,
  FileCode,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

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
    <div
      className={`fixed top-0 right-0 bottom-0 w-96 bg-ink-sidebar border-l border-ink-border shadow-2xl flex flex-col z-30 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="h-14 px-4 border-b border-ink-border flex items-center justify-between">
        <div className="flex items-center gap-2 text-ink-text font-semibold text-sm">
          <FolderSync className="w-4 h-4 text-ink-accent" />
          <span>Cogdex Sync & Config</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-ink-panel text-ink-muted hover:text-ink-text transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Master Switch */}
        <div className="p-3 bg-ink-card rounded-lg border border-ink-border flex items-center justify-between">
          <div>
            <div className="font-medium text-ink-text">Enable Vault Sync</div>
            <div className="text-ink-muted text-[11px]">
              Append sessions to today's keylog note in your vault
            </div>
          </div>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="w-4 h-4 rounded border-ink-border text-ink-accent focus:ring-0 cursor-pointer accent-ink-accent"
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
            className="w-full bg-ink-bg border border-ink-border rounded-md px-2.5 py-1.5 text-ink-text font-mono text-xs focus:outline-none focus:border-ink-accent"
          />
        </div>

        {/* Daily Folder Root */}
        <div>
          <label className="block font-medium text-ink-text mb-1 flex items-center gap-1">
            <span>Daily Folder Root</span>
            <span className="text-ink-muted text-[10px]">(Cogdex default: Daily)</span>
          </label>
          <input
            type="text"
            placeholder="Daily"
            value={form.dailyFolderRoot}
            onChange={(e) => setForm({ ...form, dailyFolderRoot: e.target.value })}
            className="w-full bg-ink-bg border border-ink-border rounded-md px-2.5 py-1.5 text-ink-text font-mono text-xs focus:outline-none focus:border-ink-accent"
          />
        </div>

        {/* Day Pattern & Suffix */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block font-medium text-ink-text mb-1">Day Pattern</label>
            <input
              type="text"
              placeholder="%Y-%m-%d"
              value={form.dayPattern}
              onChange={(e) => setForm({ ...form, dayPattern: e.target.value })}
              className="w-full bg-ink-bg border border-ink-border rounded-md px-2.5 py-1.5 text-ink-text font-mono text-xs focus:outline-none focus:border-ink-accent"
            />
          </div>
          <div>
            <label className="block font-medium text-ink-text mb-1">Keylog Suffix</label>
            <input
              type="text"
              placeholder=" - keylog"
              value={form.keylogSuffix}
              onChange={(e) => setForm({ ...form, keylogSuffix: e.target.value })}
              className="w-full bg-ink-bg border border-ink-border rounded-md px-2.5 py-1.5 text-ink-text font-mono text-xs focus:outline-none focus:border-ink-accent"
            />
          </div>
        </div>

        {/* Idle Timeout */}
        <div>
          <label className="block font-medium text-ink-text mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-ink-muted" />
            <span>Idle Timeout (Seconds)</span>
          </label>
          <input
            type="number"
            min="5"
            max="3600"
            value={form.idleTimeoutSecs}
            onChange={(e) =>
              setForm({ ...form, idleTimeoutSecs: parseInt(e.target.value, 10) || 60 })
            }
            className="w-full bg-ink-bg border border-ink-border rounded-md px-2.5 py-1.5 text-ink-text font-mono text-xs focus:outline-none focus:border-ink-accent"
          />
        </div>

        {/* Excluded Apps */}
        <div>
          <label className="block font-medium text-ink-text mb-1 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-ink-muted" />
            <span>Excluded Applications (Comma-separated)</span>
          </label>
          <textarea
            rows={3}
            value={excludedAppsText}
            onChange={(e) => setExcludedAppsText(e.target.value)}
            placeholder="1password, bitwarden, inkwell, ..."
            className="w-full bg-ink-bg border border-ink-border rounded-md px-2.5 py-1.5 text-ink-text font-mono text-xs focus:outline-none focus:border-ink-accent resize-none"
          />
          <span className="text-[10px] text-ink-muted block mt-0.5">
            Keystrokes from these frontmost apps are never logged or stored.
          </span>
        </div>

        {/* Sync Status Banner */}
        {syncStatus && (
          <div
            className={`p-3 rounded-lg border flex items-start gap-2 ${
              syncStatus.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            {syncStatus.success ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <div className="text-[11px] leading-relaxed break-words">
              {syncStatus.message}
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-4 border-t border-ink-border bg-ink-sidebar space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-ink-panel hover:bg-ink-hover border border-ink-border text-ink-text font-medium transition-colors text-xs"
          >
            <Save className="w-3.5 h-3.5 text-ink-accent" />
            <span>{saveSuccess ? 'Saved!' : 'Apply Settings'}</span>
          </button>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-ink-accent hover:bg-ink-accent-hover text-white font-medium transition-colors text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Force Sync'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
