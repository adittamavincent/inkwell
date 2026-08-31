import React, { useState } from 'react';
import { SessionPreview } from '../types';
import { Copy } from 'lucide-react';

interface SessionHistoryProps {
  sessions: SessionPreview[];
  appIcons?: Record<string, string | null>;
  onCopyText: (text: string) => void;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({
  sessions,
  appIcons,
  onCopyText,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (text: string, idx: number) => {
    onCopyText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const formatTime = (timeVal: string | Date) => {
    try {
      const d = typeof timeVal === 'string' ? new Date(timeVal) : timeVal;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return String(timeVal);
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-ink-muted select-none">
        <h3 className="font-serif text-sm font-medium text-ink-text mb-1">
          Manuscript Archive Empty
        </h3>
        <p className="text-xs max-w-xs text-ink-muted leading-relaxed">
          Completed sessions from across your system will be cataloged and indexed here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto divide-y divide-ink-border-subtle/80 select-text">
      {sessions.map((session, index) => {
        const icon = (appIcons && session.app && appIcons[session.app]) || null;

        return (
          <div
            key={index}
            className="group flex items-start justify-between gap-3 px-3.5 py-2 hover:bg-ink-panel/40 transition-colors"
          >
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {/* Metadata gutter: Timestamp + Real App badge */}
              <div className="shrink-0 flex items-center gap-2 pt-0.5 select-none">
                <span className="font-mono text-[11px] text-ink-faint tabular-nums">
                  {formatTime(session.start)}
                </span>
                <span className="font-mono text-[11px] text-ink-muted bg-ink-panel px-1.5 py-0.5 rounded border border-ink-border/60 flex items-center gap-1.5">
                  {icon && (
                    <img
                      src={icon}
                      alt=""
                      className="w-3 h-3 rounded-xs shrink-0 object-contain"
                    />
                  )}
                  <span className="truncate max-w-[120px]">{session.app || 'Unknown'}</span>
                </span>
              </div>

              {/* Raw Keystroke text: Compact flow without card border */}
              <div className="font-mono text-xs text-ink-text leading-relaxed whitespace-pre-wrap break-words flex-1 pt-0.5">
                {session.text}
              </div>
            </div>

            {/* Hover Action: Compact Icon Button */}
            <button
              onClick={() => handleCopy(session.text, index)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-ink-card border border-transparent hover:border-ink-border text-ink-muted hover:text-ink-text transition-all shrink-0 select-none"
              title="Copy session text"
            >
              {copiedIndex === index ? (
                <span className="text-[10px] font-mono text-emerald-400 font-medium px-1">
                  Copied
                </span>
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
};


