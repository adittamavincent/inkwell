import React, { useState, useRef } from 'react';
import { Copy, Check, Code2 } from 'lucide-react';

interface RichContentTextProps {
  text: string;
  className?: string;
  onCopyText?: (text: string) => void;
}

interface CodeSegment {
  type: 'code';
  fence: string;
  language: string;
  code: string;
  raw: string;
}

interface TextSegment {
  type: 'text';
  content: string;
}

type Segment = CodeSegment | TextSegment;

/**
 * Tokenize code string into syntax-highlighted React elements.
 */
function renderSyntaxHighlighted(code: string): React.ReactNode {
  // Regex pattern for tokenizing common programming languages
  const tokenRegex =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|--[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:const|let|var|function|return|if|else|for|while|import|from|export|default|class|extends|new|async|await|try|catch|throw|finally|typeof|instanceof|def|elif|lambda|yield|SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|CREATE|TABLE|interface|type|enum|public|private|protected)\b)|(\b(?:true|false|null|undefined|None|True|False|nil)\b)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())|([{}()[\],;.:=+\-*/%&|^!<>?~@#])/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(code)) !== null) {
    const matchIndex = match.index;

    // Plain text preceding match
    if (matchIndex > lastIndex) {
      elements.push(
        <span key={`plain-${lastIndex}`} className="text-ink-text">
          {code.slice(lastIndex, matchIndex)}
        </span>
      );
    }

    const [fullMatch, comment, str, keyword, booleanNull, num, fnName, punct] = match;

    if (comment) {
      elements.push(
        <span key={`comment-${matchIndex}`} className="text-ink-muted/80 italic">
          {comment}
        </span>
      );
    } else if (str) {
      elements.push(
        <span key={`str-${matchIndex}`} className="text-emerald-300">
          {str}
        </span>
      );
    } else if (keyword) {
      elements.push(
        <span key={`kw-${matchIndex}`} className="text-purple-300 font-semibold">
          {keyword}
        </span>
      );
    } else if (booleanNull) {
      elements.push(
        <span key={`bool-${matchIndex}`} className="text-amber-300 font-medium">
          {booleanNull}
        </span>
      );
    } else if (num) {
      elements.push(
        <span key={`num-${matchIndex}`} className="text-orange-300">
          {num}
        </span>
      );
    } else if (fnName) {
      elements.push(
        <span key={`fn-${matchIndex}`} className="text-cyan-300">
          {fnName}
        </span>
      );
    } else if (punct) {
      elements.push(
        <span key={`punct-${matchIndex}`} className="text-ink-faint">
          {punct}
        </span>
      );
    } else {
      elements.push(
        <span key={`other-${matchIndex}`} className="text-ink-text">
          {fullMatch}
        </span>
      );
    }

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < code.length) {
    elements.push(
      <span key={`tail-${lastIndex}`} className="text-ink-text">
        {code.slice(lastIndex)}
      </span>
    );
  }

  return elements;
}

/**
 * Parses a string into text and code/pasted blocks (```, ````, ~~~, ~~~~).
 * Strictly bounds code snippets so text typed after closing fences is never swallowed.
 */
function parseSegments(rawText: string): Segment[] {
  if (!rawText) return [];

  const segments: Segment[] = [];
  let currentIndex = 0;

  // Regex to find start of code fence at start of string or beginning of a line
  const openFenceRegex = /(?:^|\n)(`{3,4}|~{3,4})([a-zA-Z0-9_-]*)(?:\n|$)/g;

  while (currentIndex < rawText.length) {
    openFenceRegex.lastIndex = currentIndex;
    const match = openFenceRegex.exec(rawText);

    if (!match) {
      // No more code fences, remainder is plain text
      segments.push({
        type: 'text',
        content: rawText.slice(currentIndex),
      });
      break;
    }

    const matchStart = match.index + (match[0].startsWith('\n') ? 1 : 0);
    const fence = match[1];
    const lang = match[2] || '';
    const contentStart = match.index + match[0].length;

    // Push any text preceding the opening fence
    if (matchStart > currentIndex) {
      segments.push({
        type: 'text',
        content: rawText.slice(currentIndex, matchStart),
      });
    }

    // Look for matching closing fence at beginning of line
    const closeFencePattern = new RegExp(`(?:^|\\n)${fence}(?=\\n|$)`, 'g');
    closeFencePattern.lastIndex = contentStart;
    const closeMatch = closeFencePattern.exec(rawText);

    if (closeMatch) {
      const codeEnd = closeMatch.index;
      const closingFenceEnd = closeMatch.index + closeMatch[0].length;
      const codeContent = rawText.slice(contentStart, codeEnd);

      segments.push({
        type: 'code',
        fence,
        language: lang,
        code: codeContent,
        raw: rawText.slice(matchStart, closingFenceEnd),
      });

      // Move currentIndex to after the closing fence
      currentIndex = closingFenceEnd;
    } else {
      // Unclosed code block — treat remainder as code
      const codeContent = rawText.slice(contentStart);
      segments.push({
        type: 'code',
        fence,
        language: lang,
        code: codeContent,
        raw: rawText.slice(matchStart),
      });
      break;
    }
  }

  return segments;
}

interface CodeChipProps {
  segment: CodeSegment;
  onCopyText?: (text: string) => void;
}

const CodeChip: React.FC<CodeChipProps> = ({ segment, onCopyText }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanCode = segment.code;
  // Trim preview to maximum 20 characters
  const trimmedCode = cleanCode.length > 20 ? cleanCode.slice(0, 20) + '…' : cleanCode;
  const isTrimmed = cleanCode.length > 20 || cleanCode.includes('\n');

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCopyText) {
      onCopyText(cleanCode);
    } else if (window.inkwellApi?.copyToClipboard) {
      window.inkwellApi.copyToClipboard(cleanCode);
    } else if (navigator?.clipboard) {
      navigator.clipboard.writeText(cleanCode);
    }

    setIsCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsCopied(false), 1500);
  };

  return (
    <span
      className="relative inline-flex items-center align-middle my-0.5 mx-1 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Syntax Highlighted Clickable Chip (Trimmed Max 20 Chars) */}
      <button
        type="button"
        onClick={handleCopy}
        title="Click to copy full pasted snippet"
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[11px] bg-ink-card/95 hover:bg-ink-hover border border-ink-accent/40 hover:border-ink-accent text-ink-text transition-all shadow-xs cursor-pointer select-none max-w-full"
      >
        <span className="text-ink-accent-light font-bold flex items-center gap-1 shrink-0">
          <Code2 className="w-3.5 h-3.5 text-ink-accent-light" />
          <span>{segment.fence}</span>
        </span>

        {/* Trimmed syntax-highlighted preview */}
        {cleanCode.trim() ? (
          <span className="font-mono text-[11px] truncate text-ink-text max-w-[240px] inline-block">
            {renderSyntaxHighlighted(trimmedCode)}
          </span>
        ) : (
          <span className="text-ink-faint italic font-sans text-[10px]">empty snippet</span>
        )}

        {/* Copy / Copied Indicator */}
        <span className="shrink-0 ml-1 flex items-center">
          {isCopied ? (
            <span className="inline-flex items-center gap-0.5 text-emerald-400 text-[10px] font-sans font-medium">
              <Check className="w-3 h-3" />
              <span>Copied</span>
            </span>
          ) : (
            <Copy className="w-3 h-3 text-ink-muted group-hover:text-ink-accent-light transition-colors" />
          )}
        </span>
      </button>

      {/* Hover Popover showing FULL Syntax-Highlighted Snippet */}
      {isHovered && cleanCode.trim().length > 0 && isTrimmed && (
        <div className="absolute left-0 bottom-full mb-2 z-50 min-w-[260px] max-w-[440px] bg-ink-sidebar/95 backdrop-blur-md rounded-lg border border-ink-border shadow-2xl p-2.5 text-left pointer-events-auto">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-ink-border text-[10px] text-ink-muted select-none">
            <span className="font-medium text-ink-accent-light flex items-center gap-1">
              <Code2 className="w-3 h-3" />
              <span>{segment.fence} Snippet ({cleanCode.length} chars)</span>
            </span>
            <span className="text-ink-faint">Click chip to copy</span>
          </div>

          <pre className="font-mono text-[11px] leading-relaxed text-ink-text whitespace-pre-wrap break-words max-h-56 overflow-y-auto select-text p-2 bg-ink-bg/90 rounded border border-ink-border-subtle">
            {renderSyntaxHighlighted(cleanCode)}
          </pre>
        </div>
      )}
    </span>
  );
};

export const RichContentText: React.FC<RichContentTextProps> = ({
  text,
  className = '',
  onCopyText,
}) => {
  if (!text) return null;

  const segments = parseSegments(text);

  return (
    <span className={`inline leading-relaxed ${className}`}>
      {segments.map((seg, idx) => {
        if (seg.type === 'code') {
          return <CodeChip key={idx} segment={seg} onCopyText={onCopyText} />;
        }
        return (
          <span key={idx} className="whitespace-pre-wrap">
            {seg.content}
          </span>
        );
      })}
    </span>
  );
};
