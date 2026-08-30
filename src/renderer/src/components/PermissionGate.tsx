import React, { useState } from 'react';
import {
  ShieldAlert,
  ExternalLink,
  Loader2,
  CheckCircle2,
  KeyRound,
  Lock,
  Check,
  Radio,
} from 'lucide-react';
import { CaptureHealth } from '../types';

interface PermissionGateProps {
  onGranted: () => void;
  hasAccessibility: boolean;
  captureHealth: CaptureHealth;
  onRequestAccessibility: () => Promise<boolean>;
  onOpenAccessibilitySettings: () => Promise<void>;
  onOpenInputMonitoringSettings: () => Promise<void>;
  isGranted?: boolean;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  onGranted,
  hasAccessibility,
  captureHealth,
  onRequestAccessibility,
  onOpenAccessibilitySettings,
  onOpenInputMonitoringSettings,
  isGranted = false,
}) => {
  const [isOpeningAccessibility, setIsOpeningAccessibility] = useState(false);
  const [isOpeningInputMonitoring, setIsOpeningInputMonitoring] = useState(false);

  const isInputConfirmed = captureHealth === 'confirmed';
  const allSet = isGranted || (hasAccessibility && isInputConfirmed);

  const handleAccessibility = async () => {
    setIsOpeningAccessibility(true);
    try {
      await onRequestAccessibility();
      await onOpenAccessibilitySettings();
    } catch (err) {
      console.error('Failed to open accessibility settings:', err);
    } finally {
      setIsOpeningAccessibility(false);
    }
  };

  const handleInputMonitoring = async () => {
    setIsOpeningInputMonitoring(true);
    try {
      await onOpenInputMonitoringSettings();
    } catch (err) {
      console.error('Failed to open input monitoring settings:', err);
    } finally {
      setIsOpeningInputMonitoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink-bg text-ink-text flex flex-col items-center justify-center p-6 select-none overflow-y-auto">
      <div className="max-w-md w-full flex flex-col items-center text-center space-y-6">
        {/* Brand Icon Badge */}
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-ink-card border border-ink-border flex items-center justify-center shadow-xl shadow-ink-accent/5">
            {allSet ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-in zoom-in-50 duration-300" />
            ) : (
              <KeyRound className="w-8 h-8 text-ink-accent" />
            )}
          </div>
          {allSet && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
            </span>
          )}
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-ink-text">
            {allSet ? "You're All Set!" : 'Enable Keystroke Capture'}
          </h1>
          <p className="text-xs text-ink-muted leading-relaxed max-w-sm">
            {allSet
              ? 'Permissions verified! Launching Inkwell workspace...'
              : 'macOS requires two distinct permissions to detect active apps and capture keystrokes globally.'}
          </p>
        </div>

        {/* Permission Checklist */}
        {!allSet && (
          <div className="w-full bg-ink-card/60 border border-ink-border rounded-xl p-4 text-left space-y-3.5 shadow-sm">
            <div className="text-xs font-semibold text-ink-text flex items-center gap-1.5 mb-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Required macOS Permissions:</span>
            </div>

            {/* 1. Accessibility */}
            <div className="p-3 rounded-lg bg-ink-panel border border-ink-border flex items-center justify-between">
              <div className="space-y-0.5 pr-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-ink-text">
                  {hasAccessibility ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  )}
                  <span>1. Accessibility</span>
                </div>
                <p className="text-[11px] text-ink-muted leading-tight">
                  Required to register the global event tap
                </p>
              </div>

              {hasAccessibility ? (
                <span className="px-2 py-0.5 text-[11px] font-medium rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Granted
                </span>
              ) : (
                <button
                  onClick={handleAccessibility}
                  disabled={isOpeningAccessibility}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-ink-accent hover:bg-ink-accent-hover text-white flex items-center gap-1 shrink-0 transition-colors shadow-xs"
                >
                  <span>Grant</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 2. Input Monitoring */}
            <div className="p-3 rounded-lg bg-ink-panel border border-ink-border flex items-center justify-between">
              <div className="space-y-0.5 pr-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-ink-text">
                  {isInputConfirmed ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : captureHealth === 'stalled' ? (
                    <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                  ) : (
                    <Loader2 className="w-3 h-3 text-ink-accent animate-spin shrink-0" />
                  )}
                  <span>2. Input Monitoring</span>
                </div>
                <p className="text-[11px] text-ink-muted leading-tight">
                  {isInputConfirmed
                    ? 'Confirmed: Keystroke stream active'
                    : captureHealth === 'stalled'
                    ? 'No keystrokes detected — check Input Monitoring settings'
                    : 'Awaiting first keystroke confirmation... Type in any app'}
                </p>
              </div>

              {isInputConfirmed ? (
                <span className="px-2 py-0.5 text-[11px] font-medium rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Confirmed
                </span>
              ) : (
                <button
                  onClick={handleInputMonitoring}
                  disabled={isOpeningInputMonitoring}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-ink-card hover:bg-ink-hover border border-ink-border text-ink-text flex items-center gap-1 shrink-0 transition-colors"
                >
                  <span>Settings</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action Button & Status */}
        <div className="w-full space-y-3 pt-2">
          {allSet ? (
            <div className="py-3 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-center gap-2 text-xs font-medium animate-pulse">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Starting capture engine...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-ink-panel border border-ink-border text-xs text-ink-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-accent shrink-0" />
              <span>Waiting for permissions & keystrokes... updates live</span>
            </div>
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
