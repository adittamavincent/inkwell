import React from 'react';
import { ShieldAlert, ExternalLink } from 'lucide-react';

interface PermissionBannerProps {
  hasPermission: boolean;
  onRequestPermission: () => void;
}

export const PermissionBanner: React.FC<PermissionBannerProps> = ({
  hasPermission,
  onRequestPermission,
}) => {
  if (hasPermission) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-amber-300">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          <strong>Input Monitoring / Accessibility Permission Required:</strong> Inkwell cannot
          capture keystrokes globally until permission is granted in macOS System Settings.
        </span>
      </div>
      <button
        onClick={onRequestPermission}
        className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-medium transition-colors ml-4 shrink-0"
      >
        <span>Grant Permission</span>
        <ExternalLink className="w-3 h-3" />
      </button>
    </div>
  );
};
