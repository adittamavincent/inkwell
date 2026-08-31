import React from 'react';
import { Feather, Play, Pause, Copy, Check, Trash2, SlidersHorizontal } from 'lucide-react';
import { IconButton } from './IconButton';

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
    <header className="titlebar-drag-region h-12 bg-ink-sidebar/95 border-b border-ink-border flex items-center justify-between px-4 pl-20 select-none backdrop-blur-md">
      {/* Left: Branding & Informational Status */}
      <div className="flex items-center gap-3 titlebar-no-drag">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-[#163b54] to-[#1f6f78] flex items-center justify-center text-ink-text shadow-sm shadow-black/40">
            <Feather className="w-3 h-3 text-ink-accent-light" />
          </div>
          <span className="font-serif text-sm font-semibold text-ink-text">
            Inkwell
          </span>
          {import.meta.env.DEV && (
            <span
              className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded bg-ink-accent-muted/40 text-ink-accent-light"
              title="Running in dev mode — permissions assigned to 'Electron' in macOS settings."
            >
              DEV
            </span>
          )}
        </div>

        <div className="h-3.5 w-px bg-ink-border/80 mx-0.5" />

        {/* Informational App Tag */}
        {detectedApp && (
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-ink-panel/60 text-xs text-ink-muted"
            title={`Active frontmost app: ${detectedApp}`}
          >
            {detectedAppIcon && (
              <img
                src={detectedAppIcon}
                alt=""
                className="w-3.5 h-3.5 rounded-xs shrink-0 object-contain"
              />
            )}
            <span className="text-ink-text text-xs truncate max-w-[130px] sm:max-w-[170px]">
              {detectedApp}
            </span>
          </div>
        )}

        <span className="text-xs text-ink-faint hidden lg:inline">
          {sessionCount} {sessionCount === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* Right: Actions (Icon-only, borderless buttons) */}
      <div className="flex items-center gap-1 titlebar-no-drag">
        <IconButton
          icon={isRunning ? Pause : Play}
          title={isRunning ? 'Pause capture' : 'Resume capture'}
          variant={isRunning ? 'default' : 'warning'}
          onClick={onToggleCapture}
        />

        <IconButton
          icon={isCopied ? Check : Copy}
          title={isCopied ? 'Copied buffer to clipboard' : 'Copy buffer'}
          variant={isCopied ? 'success' : 'default'}
          onClick={onCopyAll}
        />

        <IconButton
          icon={Trash2}
          title="Clear all stored keystrokes"
          variant="danger"
          onClick={onClear}
        />

        <IconButton
          icon={SlidersHorizontal}
          title="Vault Sync Settings"
          active={isSettingsOpen}
          onClick={onToggleSettings}
        />
      </div>
    </header>
  );
};
