/**
 * Pure text reconstruction logic for Inkwell.
 * Shared between main process (sync) and renderer (live feed).
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

function decodeBase64Safe(b64: string): string {
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(b64, 'base64').toString('utf8');
    }
    if (typeof atob !== 'undefined') {
      const binaryString = atob(b64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }
  } catch (e) {
    console.error('Inkwell: Base64 decode error:', e);
  }
  return '';
}

export function reconstructText(tokens: string[]): string {
  const buffer: string[] = [];
  let cursor = 0;
  let selection: [number, number] | null = null;
  let lastPastedContent = '';

  for (const rawToken of tokens) {
    if (!rawToken) continue;

    // 1. Paste Token: [PASTE:b64:<data>] or [PASTE:<data>]
    if (rawToken.startsWith('[PASTE:')) {
      if (selection) {
        cursor = deleteSelection(buffer, selection);
        selection = null;
      }
      let content = '';
      if (rawToken.startsWith('[PASTE:b64:')) {
        const b64 = rawToken.slice(11, -1);
        content = decodeBase64Safe(b64);
      } else {
        content = rawToken.slice(7, -1);
      }
      lastPastedContent = content;
      const prefix = cursor > 0 && buffer[cursor - 1] !== '\n' ? '\n' : '';
      const snippet = `${prefix}\`\`\`\n${content}\n\`\`\`\n`;
      const chars = snippet.split('');
      buffer.splice(cursor, 0, ...chars);
      cursor += chars.length;
      continue;
    }

    // 2. Explicit Q3Q / Q4Q Snippet Tokens: [Q3Q:b64:...] or [Q4Q:b64:...]
    if (rawToken.startsWith('[Q3Q:') || rawToken.startsWith('[Q4Q:')) {
      if (selection) {
        cursor = deleteSelection(buffer, selection);
        selection = null;
      }
      const isQ3 = rawToken.startsWith('[Q3Q:');
      const fenceCount = isQ3 ? 3 : 4;
      const fence = '`'.repeat(fenceCount);
      let content = lastPastedContent;

      if (rawToken.startsWith('[Q3Q:b64:') || rawToken.startsWith('[Q4Q:b64:')) {
        const b64 = rawToken.slice(9, -1);
        const decoded = decodeBase64Safe(b64);
        if (decoded) {
          content = decoded;
          lastPastedContent = decoded;
        }
      }

      // Remove the preceding 'q' and '3' or '4' that were entered into buffer before this token
      if (
        cursor >= 2 &&
        (buffer[cursor - 2] === 'q' || buffer[cursor - 2] === 'Q') &&
        (buffer[cursor - 1] === '3' || buffer[cursor - 1] === '4')
      ) {
        buffer.splice(cursor - 2, 2);
        cursor -= 2;
      }

      const prefix = cursor > 0 && buffer[cursor - 1] !== '\n' ? '\n' : '';
      const snippet = `${prefix}${fence}\n${content}\n${fence}\n`;
      const chars = snippet.split('');
      buffer.splice(cursor, 0, ...chars);
      cursor += chars.length;
      continue;
    }

    // Single character (not a control token)
    const isSingleChar = rawToken.length === 1 && !rawToken.startsWith('[');

    if (isSingleChar) {
      if (selection) {
        cursor = deleteSelection(buffer, selection);
        selection = null;
      }

      // Universal q3q / q4q snippet detection:
      // When typing 'q' or 'Q', check if preceding buffer characters are 'q3' / 'q4'
      const lowerChar = rawToken.toLowerCase();
      if (
        lowerChar === 'q' &&
        cursor >= 2 &&
        (buffer[cursor - 2] === 'q' || buffer[cursor - 2] === 'Q') &&
        (buffer[cursor - 1] === '3' || buffer[cursor - 1] === '4')
      ) {
        const fenceCount = buffer[cursor - 1] === '3' ? 3 : 4;
        const fence = '`'.repeat(fenceCount);
        // Remove 'q' and '3'/'4' before cursor
        buffer.splice(cursor - 2, 2);
        cursor -= 2;

        const prefix = cursor > 0 && buffer[cursor - 1] !== '\n' ? '\n' : '';
        const snippet = `${prefix}${fence}\n${lastPastedContent}\n${fence}\n`;
        const chars = snippet.split('');
        buffer.splice(cursor, 0, ...chars);
        cursor += chars.length;
        continue;
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
