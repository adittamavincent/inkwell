import React from 'react';
import { Feather } from 'lucide-react';

interface HeaderProps {
  isRunning: boolean;
  detectedApp?: string;
  detectedAppIcon?: string | null;
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
  detectedAppIcon,
  onToggleCapture,
  onClear,
  onCopyAll,
  isCopied,
  isSettingsOpen,
  onToggleSettings,
  sessionCount,
}) => {
  return (
    <header className="titlebar-drag-region h-13 bg-ink-sidebar/95 border-b border-ink-border flex items-center justify-between px-4 pl-20 select-none backdrop-blur-md">
      {/* Left: Branding & Capture State */}
      <div className="flex items-center gap-3.5 titlebar-no-drag">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#163b54] to-[#1f6f78] border border-ink-accent/40 flex items-center justify-center text-ink-text shadow-sm shadow-black/40">
            <Feather className="w-3 h-3 text-ink-accent-light" />
          </div>
          <span className="font-serif text-[15px] font-semibold tracking-tight text-ink-text">
            Inkwell
          </span>
          {import.meta.env.DEV && (
            <span
              className="text-[9px] font-mono font-medium tracking-wider px-1.5 py-0.5 rounded bg-ink-accent-muted/40 text-ink-accent-light border border-ink-accent/30"
              title="Running in dev mode — permissions assigned to 'Electron' in macOS settings."
            >
              DEV
            </span>
          )}
        </div>

        <div className="h-3.5 w-px bg-ink-border/80 mx-0.5" />

        {/* Capture State Trigger */}
        <button
          onClick={onToggleCapture}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
            isRunning
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40 hover:bg-emerald-900/40 hover:border-emerald-700/50'
              : 'bg-amber-950/40 text-amber-300 border-amber-800/40 hover:bg-amber-900/40 hover:border-amber-700/50'
          }`}
          title={isRunning ? 'Pause global keystroke capture' : 'Resume keystroke capture'}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isRunning ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <span className="text-[11px] tracking-wide uppercase font-mono">
            {isRunning ? 'Logging' : 'Paused'}
          </span>
        </button>

        {/* Active Application Tag */}
        {detectedApp && (
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-ink-panel border border-ink-border text-xs text-ink-muted"
            title={`Active frontmost app: ${detectedApp}`}
          >
            {detectedAppIcon && (
              <img
                src={detectedAppIcon}
                alt=""
                className="w-4 h-4 rounded-sm shrink-0 object-contain"
              />
            )}
            <span className="text-ink-text font-mono text-[11px] truncate max-w-[130px] sm:max-w-[170px]">
              {detectedApp}
            </span>
          </div>
        )}

        <span className="text-xs font-mono text-ink-faint hidden lg:inline">
          {sessionCount} {sessionCount === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 titlebar-no-drag">
        <button
          onClick={onCopyAll}
          className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-ink-panel hover:bg-ink-hover border border-ink-border text-ink-text transition-colors"
          title="Copy formatted preview to clipboard"
        >
          {isCopied ? (
            <span className="text-emerald-400 font-mono text-[11px]">Copied</span>
          ) : (
            <span>Copy Buffer</span>
          )}
        </button>

        <button
          onClick={onClear}
          className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-ink-panel hover:bg-ink-danger-muted border border-ink-border hover:border-ink-danger/50 text-ink-muted hover:text-ink-danger transition-colors"
          title="Clear all stored keystrokes"
        >
          <span>Clear</span>
        </button>

        <button
          onClick={onToggleSettings}
          className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            isSettingsOpen
              ? 'bg-ink-accent text-white border-ink-accent shadow-sm'
              : 'bg-ink-panel hover:bg-ink-hover border border-ink-border text-ink-text'
          }`}
          title="Toggle Vault Sync Settings"
        >
          <span>Vault Sync</span>
        </button>
      </div>
    </header>
  );
};

