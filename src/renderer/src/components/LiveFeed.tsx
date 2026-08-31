import React from 'react';

interface LiveFeedProps {
  app: string;
  appIcon?: string | null;
  text: string;
  keystrokeCount?: number;
  tokenCount?: number;
}

export const LiveFeed: React.FC<LiveFeedProps> = ({
  app,
  appIcon,
  text,
  keystrokeCount,
  tokenCount,
}) => {
  const count = keystrokeCount ?? tokenCount ?? 0;

  if (!text && !count) {
    return (
      <div className="px-4 py-2 bg-ink-sidebar/60 border-b border-ink-border flex items-center justify-between text-xs text-ink-muted select-none">
        <span>Awaiting keystrokes · Type in any application to begin</span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-ink-panel/70 border-b border-ink-border select-none">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink-muted">Active buffer</span>
          <span className="px-2 py-0.5 rounded bg-ink-card text-ink-text text-xs font-medium flex items-center gap-1.5">
            {appIcon && (
              <img
                src={appIcon}
                alt=""
                className="w-3.5 h-3.5 rounded-xs shrink-0 object-contain"
              />
            )}
            <span>{app || 'Active App'}</span>
          </span>
        </div>
        <div className="text-xs text-ink-muted">
          <span>
            {count} {count === 1 ? 'keystroke' : 'keystrokes'}
          </span>
        </div>
      </div>

      <div className="font-mono text-xs leading-relaxed bg-ink-bg p-2.5 rounded-md border border-ink-border text-ink-text whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-h-[48px] shadow-inner select-text">
        {text || <span className="text-ink-faint font-sans text-xs">Inking in progress...</span>}
      </div>
    </div>
  );
};
