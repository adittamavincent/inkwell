import React, { useState } from 'react';
import {
  ShieldAlert,
  ExternalLink,
  Loader2,
  CheckCircle2,
  KeyRound,
  Lock,
  Sparkles,
} from 'lucide-react';

interface PermissionGateProps {
  onGranted: () => void;
  onRequestPermission: () => Promise<boolean>;
  onOpenSettings: () => Promise<void>;
  isGranted?: boolean;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  onGranted,
  onRequestPermission,
  onOpenSettings,
  isGranted = false,
}) => {
  const [isWaiting, setIsWaiting] = useState(false);
  const [hasPrompted, setHasPrompted] = useState(false);

  const handleAction = async () => {
    setIsWaiting(true);
    try {
      // 1. Trigger system prompt (if first time)
      await onRequestPermission();
      // 2. Open System Settings directly to Privacy & Security -> Accessibility
      await onOpenSettings();
      setHasPrompted(true);
    } catch (err) {
      console.error('Failed to request permission or open settings:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink-bg text-ink-text flex flex-col items-center justify-center p-6 select-none overflow-y-auto">
      <div className="max-w-md w-full flex flex-col items-center text-center space-y-6">
        {/* Brand Icon Badge */}
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-ink-card border border-ink-border flex items-center justify-center shadow-xl shadow-ink-accent/5">
            {isGranted ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-in zoom-in-50 duration-300" />
            ) : (
              <KeyRound className="w-8 h-8 text-ink-accent" />
            )}
          </div>
          {isGranted && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
            </span>
          )}
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-ink-text">
            {isGranted
              ? "You're All Set!"
              : 'Enable Keystroke Capture'}
          </h1>
          <p className="text-xs text-ink-muted leading-relaxed max-w-sm">
            {isGranted
              ? 'Permission detected! Launching Inkwell workspace...'
              : 'Inkwell captures keystrokes across your macOS apps and logs them into your daily notes. Global capture requires Accessibility permission in macOS.'}
          </p>
        </div>

        {/* Instructions Card */}
        {!isGranted && (
          <div className="w-full bg-ink-card/60 border border-ink-border rounded-xl p-4 text-left space-y-3 shadow-sm">
            <div className="text-xs font-semibold text-ink-text flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>How to enable:</span>
            </div>

            <ol className="text-xs text-ink-muted space-y-2 list-decimal list-inside leading-normal">
              <li>
                Click <strong className="text-ink-text">Grant Permission</strong> below to open macOS Settings.
              </li>
              <li>
                In <strong className="text-ink-text">Accessibility</strong>, toggle <strong className="text-ink-text">Inkwell</strong> to <strong className="text-emerald-400">ON</strong>.
              </li>
              <li>
                Return here — Inkwell detects the change and unlocks automatically.
              </li>
            </ol>
          </div>
        )}

        {/* Action Button & Status */}
        <div className="w-full space-y-3 pt-2">
          {isGranted ? (
            <div className="py-3 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-center gap-2 text-xs font-medium animate-pulse">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Starting capture engine...</span>
            </div>
          ) : isWaiting ? (
            <div className="space-y-3">
              <button
                onClick={handleAction}
                className="w-full py-3 px-4 rounded-xl bg-ink-accent/20 hover:bg-ink-accent/30 border border-ink-accent/40 text-ink-accent font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Re-open System Settings</span>
              </button>

              <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-ink-panel border border-ink-border text-xs text-ink-muted">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-accent shrink-0" />
                <span>Waiting for permission... updates automatically</span>
              </div>
            </div>
          ) : (
            <button
              onClick={handleAction}
              className="w-full py-3 px-4 rounded-xl bg-ink-accent hover:bg-ink-accent-hover text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-ink-accent/20 active:scale-[0.99]"
            >
              <span>Grant Permission in Settings</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Privacy Footer Guarantee */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-ink-muted/70 pt-4 border-t border-ink-border/50 w-full">
          <Lock className="w-3 h-3" />
          <span>Local-first & AES-256 encrypted. Data never leaves your Mac.</span>
        </div>
      </div>
    </div>
  );
};
