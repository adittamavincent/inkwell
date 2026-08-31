import React, { useState } from 'react';
import { SessionPreview } from '../types';
import { Copy, Check } from 'lucide-react';
import { IconButton } from './IconButton';

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
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-ink-muted select-none w-full">
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
    <div className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-ink-border-subtle/80 select-text w-full min-w-0">
      {sessions.map((session, index) => {
        const icon = (appIcons && session.app && appIcons[session.app]) || null;
        const isItemCopied = copiedIndex === index;

        return (
          <div
            key={index}
            className="group flex items-start justify-between gap-3 px-3.5 py-2.5 hover:bg-ink-panel/40 transition-colors w-full min-w-0"
          >
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {/* Metadata gutter: Timestamp and App vertically stacked */}
              <div className="shrink-0 flex flex-col items-start gap-1 select-none w-28 sm:w-32 pt-0.5">
                <span className="font-sans text-[11px] text-ink-faint tabular-nums leading-none">
                  {formatTime(session.start)}
                </span>
                <span className="font-sans text-xs text-ink-muted bg-ink-panel px-1.5 py-0.5 rounded inline-flex items-center gap-1.5 max-w-full">
                  {icon && (
                    <img
                      src={icon}
                      alt=""
                      className="w-3.5 h-3.5 rounded-xs shrink-0 object-contain"
                    />
                  )}
                  <span className="truncate">{session.app || 'Unknown'}</span>
                </span>
              </div>

              {/* Raw Keystroke text: min-w-0 and [overflow-wrap:anywhere] to ensure perfect flex shrinking without horizontal scroll */}
              <div className="font-mono text-xs text-ink-text leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] flex-1 min-w-0 pt-0.5">
                {session.text}
              </div>
            </div>

            {/* Hover Action: Borderless Icon Button */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 select-none">
              <IconButton
                icon={isItemCopied ? Check : Copy}
                title={isItemCopied ? 'Copied' : 'Copy session text'}
                variant={isItemCopied ? 'success' : 'ghost'}
                size="sm"
                onClick={() => handleCopy(session.text, index)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
