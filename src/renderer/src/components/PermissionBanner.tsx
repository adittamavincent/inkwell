import React from 'react';
import { ShieldAlert, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
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
      <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-amber-300">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Accessibility Permission Required:</strong> Inkwell cannot capture keystrokes globally until granted in macOS System Settings.
          </span>
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          {!isDenied && (
            <button
              onClick={onRequestAccessibility}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-medium transition-colors"
              title="Prompt macOS permission request"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Request Prompt</span>
            </button>
          )}
          <button
            onClick={onOpenAccessibilitySettings}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/30 hover:bg-amber-500/40 border border-amber-500/50 text-amber-100 font-medium transition-colors"
            title="Open macOS Privacy & Security -> Accessibility"
          >
            <span>Open Settings</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  // Case 2: Input Monitoring is missing / denied
  const isInputDenied = inputMonitoring === 'denied' || inputMonitoring === 'restricted';
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-amber-300">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          <strong>Input Monitoring Permission Required:</strong> Accessibility granted, but Input Monitoring is not authorized in macOS System Settings.
        </span>
      </div>
      <div className="flex items-center gap-2 ml-4 shrink-0">
        {!isInputDenied && (
          <button
            onClick={onRequestInputMonitoring}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-medium transition-colors"
            title="Prompt macOS permission request"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Request Prompt</span>
          </button>
        )}
        <button
          onClick={onOpenInputMonitoringSettings}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/30 hover:bg-amber-500/40 border border-amber-500/50 text-amber-100 font-medium transition-colors"
          title="Open macOS Privacy & Security -> Input Monitoring"
        >
          <span>Open Settings</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
