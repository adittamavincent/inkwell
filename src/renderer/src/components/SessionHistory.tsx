import React, { useState } from 'react';
import { SessionPreview } from '../types';
import { Copy, Check, Clock, AppWindow, Inbox } from 'lucide-react';

interface SessionHistoryProps {
  sessions: SessionPreview[];
  onCopyText: (text: string) => void;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({
  sessions,
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-ink-muted">
        <div className="w-12 h-12 rounded-2xl bg-ink-card border border-ink-border flex items-center justify-center mb-3 text-ink-muted/80">
          <Inbox className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-medium text-ink-text mb-1">No keystroke history yet</h3>
        <p className="text-xs max-w-sm text-ink-muted">
          Keystrokes will be captured system-wide and automatically grouped into sessions here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {sessions.map((session, index) => (
        <div
          key={index}
          className="group bg-ink-card/60 hover:bg-ink-card border border-ink-border/80 hover:border-ink-border rounded-xl p-3.5 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-ink-muted">
                <Clock className="w-3 h-3 text-ink-accent" />
                <span>{formatTime(session.start)}</span>
              </span>
              <span className="text-ink-border">·</span>
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-ink-panel border border-ink-border text-ink-text font-medium">
                <AppWindow className="w-3 h-3 text-ink-muted" />
                <span>{session.app || 'Unknown'}</span>
              </span>
            </div>

            <button
              onClick={() => handleCopy(session.text, index)}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-ink-panel border border-transparent hover:border-ink-border text-ink-muted hover:text-ink-text transition-all"
              title="Copy session text"
            >
              {copiedIndex === index ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="font-mono text-xs leading-relaxed text-ink-text bg-ink-bg/60 p-2.5 rounded-lg border border-ink-border/40 whitespace-pre-wrap break-words">
            {session.text}
          </div>
        </div>
      ))}
    </div>
  );
};
