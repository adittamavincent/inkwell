import React, { useState } from 'react';
import {
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Lock,
  Check,
  AlertCircle,
  Terminal,
  Feather,
} from 'lucide-react';
import { AuthStatus } from '../types';

interface PermissionGateProps {
  onGranted?: () => void;
  accessibility: AuthStatus;
  inputMonitoring: AuthStatus;
  onRequestAccessibility: () => Promise<void>;
  onRequestInputMonitoring: () => Promise<void>;
  onOpenAccessibilitySettings: () => Promise<void>;
  onOpenInputMonitoringSettings: () => Promise<void>;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  accessibility,
  inputMonitoring,
  onRequestAccessibility,
  onRequestInputMonitoring,
  onOpenAccessibilitySettings,
  onOpenInputMonitoringSettings,
}) => {
  const [isRequestingAcc, setIsRequestingAcc] = useState(false);
  const [isRequestingInp, setIsRequestingInp] = useState(false);

  const isAccAuthorized = accessibility === 'authorized';
  const isInputAuthorized = inputMonitoring === 'authorized';
  const allSet = isAccAuthorized && isInputAuthorized;

  const handleAccessibility = async () => {
    setIsRequestingAcc(true);
    try {
      if (accessibility === 'denied' || accessibility === 'restricted') {
        await onOpenAccessibilitySettings();
      } else {
        await onRequestAccessibility();
      }
    } catch (err) {
      console.error('Failed to handle accessibility action:', err);
    } finally {
      setIsRequestingAcc(false);
    }
  };

  const handleInputMonitoring = async () => {
    setIsRequestingInp(true);
    try {
      if (inputMonitoring === 'denied' || inputMonitoring === 'restricted') {
        await onOpenInputMonitoringSettings();
      } else {
        await onRequestInputMonitoring();
      }
    } catch (err) {
      console.error('Failed to handle input monitoring action:', err);
    } finally {
      setIsRequestingInp(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink-bg text-ink-text flex flex-col items-center justify-center p-6 select-none overflow-y-auto">
      {/* Background ink ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#163b54]/25 via-ink-bg to-ink-sidebar pointer-events-none" />

      <div className="relative max-w-lg w-full flex flex-col items-stretch space-y-6">
        {/* Editorial Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-[#163b54] to-[#1f6f78] border border-ink-accent/40 text-ink-accent-light shadow-lg shadow-black/40 mb-1">
            {allSet ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-300" />
            ) : (
              <Feather className="w-6 h-6 text-ink-accent-light" />
            )}
          </div>

          <div className="space-y-1">
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink-text">
              {allSet ? 'Inkwell Initialized' : 'Authorize Keystroke Stream'}
            </h1>
            <p className="text-xs text-ink-muted leading-relaxed max-w-sm mx-auto">
              {allSet
                ? 'System authorization granted. Launching the live manuscript desk...'
                : 'Inkwell requires macOS system permissions to passively record keystrokes and correlate them with active windows.'}
            </p>
          </div>
        </div>

        {/* Dev Mode Callout */}
        {import.meta.env.DEV && (
          <div className="bg-ink-panel border border-ink-accent/30 rounded-lg p-3 text-left text-xs flex items-start gap-3 shadow-sm">
            <Terminal className="w-4 h-4 text-ink-accent-light shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-mono text-[11px] font-semibold text-ink-accent-light block">
                Development Build Active
              </span>
              <p className="text-[11px] text-ink-muted leading-relaxed">
                macOS attributes permissions to the <strong className="text-ink-text font-semibold">'Electron'</strong> app binary in System Settings during local development.
              </p>
            </div>
          </div>
        )}

        {/* Dual Permission Ledger */}
        {!allSet && (
          <div className="bg-ink-panel/90 border border-ink-border rounded-xl p-4 text-left space-y-3 divide-y divide-ink-border-subtle shadow-md">
            <div className="flex items-center justify-between pb-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted font-semibold flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-ink-accent" />
                Required macOS Clearances
              </span>
              <span className="text-[11px] font-mono text-ink-faint">
                {[isAccAuthorized, isInputAuthorized].filter(Boolean).length}/2 Granted
              </span>
            </div>

            {/* 1. Accessibility */}
            <div className="pt-3 flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  {isAccAuthorized ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : accessibility === 'denied' || accessibility === 'restricted' ? (
                    <AlertCircle className="w-4 h-4 text-ink-danger shrink-0" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-ink-text font-sans">
                    1. Accessibility
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted leading-normal pl-6">
                  {isAccAuthorized
                    ? 'Authorized · System event tap active'
                    : accessibility === 'denied' || accessibility === 'restricted'
                    ? 'Denied · Enable in Privacy & Security settings'
                    : 'Needed to detect active window titles and global events'}
                </p>
              </div>

              <div className="shrink-0">
                {isAccAuthorized ? (
                  <span className="px-2 py-0.5 font-mono text-[10px] font-medium rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
                    Active
                  </span>
                ) : (
                  <button
                    onClick={handleAccessibility}
                    disabled={isRequestingAcc}
                    className="px-3 py-1.5 text-xs font-medium rounded bg-ink-accent hover:bg-ink-accent-hover text-white flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    {isRequestingAcc ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <span>
                        {accessibility === 'denied' || accessibility === 'restricted'
                          ? 'Open Settings'
                          : 'Authorize'}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* 2. Input Monitoring */}
            <div className="pt-3 flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  {isInputAuthorized ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : inputMonitoring === 'denied' || inputMonitoring === 'restricted' ? (
                    <AlertCircle className="w-4 h-4 text-ink-danger shrink-0" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-ink-text font-sans">
                    2. Input Monitoring
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted leading-normal pl-6">
                  {isInputAuthorized
                    ? 'Authorized · Global keystroke tap connected'
                    : inputMonitoring === 'denied' || inputMonitoring === 'restricted'
                    ? 'Denied · Enable in Privacy & Security settings'
                    : 'Needed to stream keystrokes across external applications'}
                </p>
              </div>

              <div className="shrink-0">
                {isInputAuthorized ? (
                  <span className="px-2 py-0.5 font-mono text-[10px] font-medium rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
                    Active
                  </span>
                ) : (
                  <button
                    onClick={handleInputMonitoring}
                    disabled={isRequestingInp}
                    className="px-3 py-1.5 text-xs font-medium rounded bg-ink-card hover:bg-ink-hover border border-ink-border text-ink-text flex items-center gap-1.5 transition-colors"
                  >
                    {isRequestingInp ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <span>
                        {inputMonitoring === 'denied' || inputMonitoring === 'restricted'
                          ? 'Open Settings'
                          : 'Authorize'}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom State Bar */}
        <div className="space-y-3">
          {allSet ? (
            <div className="py-2.5 px-4 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 flex items-center justify-center gap-2 text-xs font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Permissions verified · Starting engine</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-ink-panel/60 border border-ink-border-subtle text-xs font-mono text-ink-muted">
              <span className="w-2 h-2 rounded-full bg-ink-accent animate-pulse shrink-0" />
              <span>Awaiting System Settings update...</span>
            </div>
          )}

          {/* Privacy Guarantee Seal */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-ink-faint pt-2 border-t border-ink-border-subtle">
            <Lock className="w-3 h-3 text-ink-muted/80" />
            <span className="font-mono text-[10px]">
              Local-first · AES-256 encrypted · Zero external telemetry
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

