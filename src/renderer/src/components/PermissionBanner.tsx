import React from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { AuthStatus } from '../types';

interface PermissionBannerProps {
  accessibility: AuthStatus;
  inputMonitoring: AuthStatus;
  onRequestAccessibility: () => void;
  onRequestInputMonitoring: () => void;
  onOpenAccessibilitySettings: () => void;
  onOpenInputMonitoringSettings: () => void;
}

export const PermissionBanner: React.FC<PermissionBannerProps> = ({
  accessibility,
  inputMonitoring,
  onRequestAccessibility,
  onRequestInputMonitoring,
  onOpenAccessibilitySettings,
  onOpenInputMonitoringSettings,
}) => {
  const isAccAuthorized = accessibility === 'authorized';
  const isInputAuthorized = inputMonitoring === 'authorized';

  // If both permissions are authorized, no banner needed
  if (isAccAuthorized && isInputAuthorized) return null;

  // Case 1: Accessibility is missing / denied
  if (!isAccAuthorized) {
    const isDenied = accessibility === 'denied' || accessibility === 'restricted';
    return (
      <div className="bg-amber-950/40 border-b border-amber-800/40 px-4 py-2 flex items-center justify-between text-xs text-amber-200 select-none">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="leading-tight">
            <strong className="font-semibold text-amber-100">Accessibility Required:</strong> Inkwell cannot detect active applications until granted in System Settings.
          </span>
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          {!isDenied && (
            <button
              onClick={onRequestAccessibility}
              className="px-2.5 py-1 rounded bg-amber-900/40 hover:bg-amber-800/50 border border-amber-700/50 text-amber-200 font-medium transition-colors text-xs"
              title="Prompt macOS permission request"
            >
              <span>Prompt</span>
            </button>
          )}
          <button
            onClick={onOpenAccessibilitySettings}
            className="px-2.5 py-1 rounded bg-amber-900/60 hover:bg-amber-800/70 border border-amber-600/50 text-amber-100 font-medium transition-colors text-xs"
            title="Open macOS Privacy & Security -> Accessibility"
          >
            <span>Open Settings</span>
          </button>
        </div>
      </div>
    );
  }

  // Case 2: Input Monitoring is missing / denied
  const isInputDenied = inputMonitoring === 'denied' || inputMonitoring === 'restricted';
  return (
    <div className="bg-amber-950/40 border-b border-amber-800/40 px-4 py-2 flex items-center justify-between text-xs text-amber-200 select-none">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="leading-tight">
          <strong className="font-semibold text-amber-100">Input Monitoring Required:</strong> Accessibility is active, but Input Monitoring must be authorized to record strokes.
        </span>
      </div>
      <div className="flex items-center gap-2 ml-4 shrink-0">
        {!isInputDenied && (
          <button
            onClick={onRequestInputMonitoring}
            className="px-2.5 py-1 rounded bg-amber-900/40 hover:bg-amber-800/50 border border-amber-700/50 text-amber-200 font-medium transition-colors text-xs"
            title="Prompt macOS permission request"
          >
            <span>Prompt</span>
          </button>
        )}
        <button
          onClick={onOpenInputMonitoringSettings}
          className="px-2.5 py-1 rounded bg-amber-900/60 hover:bg-amber-800/70 border border-amber-600/50 text-amber-100 font-medium transition-colors text-xs"
          title="Open macOS Privacy & Security -> Input Monitoring"
        >
          <span>Open Settings</span>
        </button>
      </div>
    </div>
  );
};


