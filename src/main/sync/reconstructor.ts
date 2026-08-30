/**
 * Pure text reconstruction logic for Inkwell.
 * Ports the token stream into readable text buffer with cursor and selection tracking.
 */

function isAlphanumeric(ch: string): boolean {
  return /^[a-zA-Z0-9]$/.test(ch);
}

function deleteSelection(buffer: string[], selection: [number, number]): number {
  const start = Math.min(selection[0], selection[1]);
  const end = Math.max(selection[0], selection[1]);
  if (start >= end || end > buffer.length) {
    return Math.min(selection[0], buffer.length);
  }
  buffer.splice(start, end - start);
  return start;
}

export function reconstructText(tokens: string[]): string {
  const buffer: string[] = [];
  let cursor = 0;
  let selection: [number, number] | null = null;

  for (const rawToken of tokens) {
    if (!rawToken) continue;

    // Single character (not a control token)
    const isSingleChar = rawToken.length === 1 && !rawToken.startsWith('[');

    if (isSingleChar) {
      if (selection) {
        cursor = deleteSelection(buffer, selection);
        selection = null;
      }
      buffer.splice(cursor, 0, rawToken);
      cursor += 1;
    } else if (rawToken === '[⌫]') {
      // Backspace
      if (selection) {
        cursor = deleteSelection(buffer, selection);
        selection = null;
      } else if (cursor > 0) {
        buffer.splice(cursor - 1, 1);
        cursor -= 1;
      }
    } else if (rawToken === '[⌦]') {
      // Forward delete
      if (selection) {
        cursor = deleteSelection(buffer, selection);
        selection = null;
      } else if (cursor < buffer.length) {
        buffer.splice(cursor, 1);
      }
    } else if (rawToken === '[↵]') {
      // Newline
      if (selection) {
        cursor = deleteSelection(buffer, selection);
        selection = null;
      }
      buffer.splice(cursor, 0, '\n');
      cursor += 1;
    } else if (rawToken === '[←]') {
      // Arrow left
      cursor = Math.max(0, cursor - 1);
      selection = null;
    } else if (rawToken === '[→]') {
      // Arrow right
      cursor = Math.min(buffer.length, cursor + 1);
      selection = null;
    } else if (rawToken === '[↑]' || rawToken === '[↓]') {
      // Arrow up / down: clear selection
      selection = null;
    } else if (rawToken === '[⇥]') {
      // Tab
      if (selection) {
        cursor = deleteSelection(buffer, selection);
        selection = null;
      }
      buffer.splice(cursor, 0, '\t');
      cursor += 1;
    } else if (rawToken === '[⌘A]') {
      // Select all
      selection = [0, buffer.length];
    } else if (rawToken === '[⇧←]') {
      // Shift + Left: extend or shrink selection backwards
      const anchor: number = selection ? selection[0] : cursor;
      const newCursor = Math.max(0, cursor - 1);
      selection = anchor !== newCursor ? [anchor, newCursor] : null;
      cursor = newCursor;
    } else if (rawToken === '[⇧→]') {
      // Shift + Right: extend or shrink selection forwards
      const anchor: number = selection ? selection[0] : cursor;
      const newCursor = Math.min(buffer.length, cursor + 1);
      selection = anchor !== newCursor ? [anchor, newCursor] : null;
      cursor = newCursor;
    } else if (rawToken === '[⌘⌫]') {
      // Command + Backspace: delete to start of line
      if (selection) {
        cursor = deleteSelection(buffer, selection);
        selection = null;
      } else {
        let start = cursor;
        while (start > 0 && buffer[start - 1] !== '\n') {
          start -= 1;
        }
        if (start < cursor) {
          buffer.splice(start, cursor - start);
          cursor = start;
        }
      }
    } else if (rawToken === '[⌥⌫]') {
      // Option + Backspace: delete previous word
      if (selection) {
        cursor = deleteSelection(buffer, selection);
        selection = null;
      } else {
        let start = cursor;
        // 1. Skip trailing spaces
        while (start > 0 && buffer[start - 1] === ' ') {
          start -= 1;
        }
        // 2. Delete word chunk (alphanumeric or punctuation group)
        if (start > 0) {
          const isAlpha = isAlphanumeric(buffer[start - 1]);
          while (
            start > 0 &&
            buffer[start - 1] !== ' ' &&
            buffer[start - 1] !== '\n' &&
            isAlphanumeric(buffer[start - 1]) === isAlpha
          ) {
            start -= 1;
          }
        }
        if (start < cursor) {
          buffer.splice(start, cursor - start);
          cursor = start;
        }
      }
    } else if (rawToken === '[⌘Z]') {
      // Undo token: safe no-op
    }
    // Any other unknown bracketed tokens are safely ignored
  }

  return buffer.join('');
}
