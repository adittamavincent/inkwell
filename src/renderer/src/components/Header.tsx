import React from 'react';
import {
  Play,
  Pause,
  Trash2,
  Copy,
  SlidersHorizontal,
  Feather,
  Check,
  AppWindow,
} from 'lucide-react';

interface HeaderProps {
  isRunning: boolean;
  detectedApp?: string;
  onToggleCapture: () => void;
  onClear: () => void;
  onCopyAll: () => void;
  isCopied: boolean;
  isSettingsOpen: boolean;
  onToggleSettings: () => void;
  sessionCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  isRunning,
  detectedApp,
  onToggleCapture,
  onClear,
  onCopyAll,
  isCopied,
  isSettingsOpen,
  onToggleSettings,
  sessionCount,
}) => {
  return (
    <header className="titlebar-drag-region h-14 bg-ink-sidebar border-b border-ink-border flex items-center justify-between px-4 pl-20 select-none">
      {/* Left: Branding & Capture Status Badge */}
      <div className="flex items-center gap-3 titlebar-no-drag">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-ink-accent/20 border border-ink-accent/40 flex items-center justify-center text-ink-accent">
            <Feather className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm tracking-wide text-ink-text">Inkwell</span>
          {import.meta.env.DEV && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30"
              title="Running in dev mode — permissions are separate from the packaged app (assigned to 'Electron' in macOS settings)."
            >
              DEV
            </span>
          )}
        </div>

        <div className="h-4 w-px bg-ink-border mx-1" />

        {/* Running Status Badge */}
        <button
          onClick={onToggleCapture}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            isRunning
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
          }`}
          title={isRunning ? 'Click to pause capture' : 'Click to resume capture'}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isRunning ? 'bg-emerald-400 animate-pulse-subtle' : 'bg-amber-400'
            }`}
          />
          <span>{isRunning ? 'Capturing' : 'Paused'}</span>
          {isRunning ? (
            <Pause className="w-3 h-3 ml-0.5 opacity-60" />
          ) : (
            <Play className="w-3 h-3 ml-0.5 opacity-60" />
          )}
        </button>

        {/* Persistent Frontmost App Indicator Badge */}
        {detectedApp && (
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-ink-card border border-ink-border text-xs text-ink-muted"
            title={`Current frontmost app: ${detectedApp}`}
          >
            <AppWindow className="w-3 h-3 text-ink-muted/80" />
            <span className="text-ink-text font-medium truncate max-w-[120px] sm:max-w-[160px]">
              {detectedApp}
            </span>
          </div>
        )}

        <span className="text-xs text-ink-muted hidden lg:inline">
          {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 titlebar-no-drag">
        <button
          onClick={onCopyAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-ink-panel hover:bg-ink-hover border border-ink-border text-ink-text transition-colors"
          title="Copy all preview text"
        >
          {isCopied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-ink-muted" />
              <span>Copy Preview</span>
            </>
          )}
        </button>

        <button
          onClick={onClear}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-ink-panel hover:bg-ink-danger/20 border border-ink-border hover:border-ink-danger/40 text-ink-muted hover:text-ink-danger transition-colors"
          title="Clear all stored keystrokes"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Clear</span>
        </button>

        <button
          onClick={onToggleSettings}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            isSettingsOpen
              ? 'bg-ink-accent text-white border-ink-accent'
              : 'bg-ink-panel hover:bg-ink-hover border border-ink-border text-ink-text'
          }`}
          title="Toggle Cogdex Sync Settings"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Sync Settings</span>
        </button>
      </div>
    </header>
  );
};
