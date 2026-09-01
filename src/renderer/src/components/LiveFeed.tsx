import React, { useRef, useEffect } from 'react';
import { RichContentText } from './RichContentText';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (scrollRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [text]);

  if (!text && !count) {
    return (
      <div className="px-4 py-2 bg-ink-sidebar/60 border-b border-ink-border flex items-center justify-between text-xs text-ink-muted select-none">
        <span>Awaiting keystrokes · Type in any application to begin</span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-ink-panel/70 border-b border-ink-border select-none max-h-[50vh] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-2 shrink-0">
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

      <div ref={scrollRef} className="font-mono text-xs leading-relaxed bg-ink-bg p-2.5 rounded-md border border-ink-border text-ink-text whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-h-[48px] shadow-inner select-text overflow-y-auto flex-1">
        {text ? (
          <>
            <RichContentText text={text} />
            <span
              className="inline-block w-[1.5px] h-[13px] bg-ink-accent-light align-middle ml-0.5 animate-cursor-blink pointer-events-none rounded-full shadow-[0_0_4px_rgba(94,203,215,0.6)]"
              aria-hidden="true"
            />
          </>
        ) : (
          <span className="text-ink-faint font-sans text-xs flex items-center gap-1">
            <span>Inking in progress...</span>
            <span
              className="inline-block w-[1.5px] h-[12px] bg-ink-accent/60 align-middle ml-0.5 animate-cursor-blink pointer-events-none rounded-full"
              aria-hidden="true"
            />
          </span>
        )}
      </div>
    </div>
  );
};
