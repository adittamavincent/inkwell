import React from 'react';
import { ShieldAlert, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import { CaptureHealth } from '../types';

interface PermissionBannerProps {
  hasAccessibility: boolean;
  captureHealth: CaptureHealth;
  onRequestAccessibility: () => void;
  onOpenAccessibilitySettings: () => void;
  onOpenInputMonitoringSettings: () => void;
}

export const PermissionBanner: React.FC<PermissionBannerProps> = ({
  hasAccessibility,
  captureHealth,
  onRequestAccessibility,
  onOpenAccessibilitySettings,
  onOpenInputMonitoringSettings,
}) => {
  const isInputConfirmed = captureHealth === 'confirmed';

  // If accessibility is granted and input monitoring is confirmed, no banner needed
  if (hasAccessibility && isInputConfirmed) return null;

  // Case 1: Accessibility is missing
  if (!hasAccessibility) {
    return (
      <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-amber-300">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Accessibility Permission Required:</strong> Inkwell cannot capture keystrokes globally until granted in macOS System Settings.
          </span>
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <button
            onClick={onRequestAccessibility}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-medium transition-colors"
            title="Prompt macOS permission request"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Request Prompt</span>
          </button>
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

  // Case 2: Accessibility is granted, but Input Monitoring is stalled / unconfirmed
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-amber-300">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          <strong>Input Monitoring Verification Needed:</strong> Accessibility granted, but no keystrokes detected — check Input Monitoring in System Settings.
        </span>
      </div>
      <div className="flex items-center gap-2 ml-4 shrink-0">
        <button
          onClick={onOpenInputMonitoringSettings}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/30 hover:bg-amber-500/40 border border-amber-500/50 text-amber-100 font-medium transition-colors"
          title="Open macOS Privacy & Security -> Input Monitoring"
        >
          <span>Open Input Monitoring</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
