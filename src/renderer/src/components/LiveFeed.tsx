import React from 'react';
import { Activity, Sparkles } from 'lucide-react';

interface LiveFeedProps {
  app: string;
  text: string;
  tokenCount: number;
}

export const LiveFeed: React.FC<LiveFeedProps> = ({ app, text, tokenCount }) => {
  if (!text && !tokenCount) {
    return (
      <div className="p-4 bg-ink-sidebar/50 border-b border-ink-border flex items-center justify-between text-xs text-ink-muted">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-ink-accent animate-pulse" />
          <span>Waiting for global keystrokes... Type in any app.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-ink-panel/80 border-b border-ink-border transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ink-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-ink-accent"></span>
          </span>
          <span className="text-xs font-semibold text-ink-accent tracking-wide uppercase">
            Live Typing
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-ink-card border border-ink-border text-ink-text font-medium">
            {app || 'Active App'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Sparkles className="w-3.5 h-3.5 text-ink-accent" />
          <span>{tokenCount} tokens</span>
        </div>
      </div>

      <div className="font-mono text-sm bg-ink-bg p-3 rounded-lg border border-ink-border/80 text-ink-text whitespace-pre-wrap break-words min-h-[52px]">
        {text}
        <span className="inline-block w-2 h-4 bg-ink-accent ml-0.5 -mb-0.5 animate-cursor-blink" />
      </div>
    </div>
  );
};
