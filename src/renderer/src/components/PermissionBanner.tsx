import React from 'react';
import { ShieldAlert, ExternalLink, RefreshCw } from 'lucide-react';

interface PermissionBannerProps {
  hasPermission: boolean;
  onRequestPermission: () => void;
  onOpenSettings: () => void;
}

export const PermissionBanner: React.FC<PermissionBannerProps> = ({
  hasPermission,
  onRequestPermission,
  onOpenSettings,
}) => {
  if (hasPermission) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-amber-300">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          <strong>Input Monitoring / Accessibility Permission Required:</strong> Inkwell cannot
          capture keystrokes globally until granted in macOS System Settings.
        </span>
      </div>
      <div className="flex items-center gap-2 ml-4 shrink-0">
        <button
          onClick={onRequestPermission}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-medium transition-colors"
          title="Prompt macOS permission request"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Request Prompt</span>
        </button>
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/30 hover:bg-amber-500/40 border border-amber-500/50 text-amber-100 font-medium transition-colors"
          title="Open macOS Privacy & Security Settings"
        >
          <span>Open Settings</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
