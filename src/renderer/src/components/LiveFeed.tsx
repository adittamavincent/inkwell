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
        <span className="font-mono text-[11px] text-ink-muted">
          Awaiting keystrokes · Type in any application to begin
        </span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-ink-panel/70 border-b border-ink-border select-none">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-ink-accent-light shrink-0" />
          <span className="font-mono text-[10px] font-semibold text-ink-accent-light tracking-wider uppercase">
            Active Buffer
          </span>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-ink-card border border-ink-border text-ink-text font-medium flex items-center gap-1.5">
            {appIcon && (
              <img
                src={appIcon}
                alt=""
                className="w-4 h-4 rounded-sm shrink-0 object-contain"
              />
            )}
            <span>{app || 'Active App'}</span>
          </span>
        </div>
        <div className="text-[11px] font-mono text-ink-muted">
          <span>
            {count} {count === 1 ? 'keystroke' : 'keystrokes'}
          </span>
        </div>
      </div>

      <div className="font-mono text-[13px] leading-relaxed bg-ink-bg p-2.5 rounded-md border border-ink-border text-ink-text whitespace-pre-wrap break-words min-h-[48px] shadow-inner select-text">
        {text || (
          <span className="text-ink-faint font-sans text-xs">
            Inking in progress...
          </span>
        )}
        <span className="inline-block w-1.5 h-4 bg-ink-accent-light ml-0.5 -mb-0.5 animate-cursor-blink" />
      </div>
    </div>
  );
};


