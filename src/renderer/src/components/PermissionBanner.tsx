import React from 'react';
import { ShieldAlert, AlertTriangle, ExternalLink, KeyRound } from 'lucide-react';
import { AuthStatus } from '../types';
import { IconButton } from './IconButton';

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
        <div className="flex items-center gap-1.5 ml-4 shrink-0">
          {!isDenied && (
            <IconButton
              icon={KeyRound}
              title="Prompt macOS permission request"
              variant="warning"
              size="sm"
              onClick={onRequestAccessibility}
            />
          )}
          <IconButton
            icon={ExternalLink}
            title="Open macOS Privacy & Security -> Accessibility"
            variant="warning"
            size="sm"
            onClick={onOpenAccessibilitySettings}
          />
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
      <div className="flex items-center gap-1.5 ml-4 shrink-0">
        {!isInputDenied && (
          <IconButton
            icon={KeyRound}
            title="Prompt macOS permission request"
            variant="warning"
            size="sm"
            onClick={onRequestInputMonitoring}
          />
        )}
        <IconButton
          icon={ExternalLink}
          title="Open macOS Privacy & Security -> Input Monitoring"
          variant="warning"
          size="sm"
          onClick={onOpenInputMonitoringSettings}
        />
      </div>
    </div>
  );
};
