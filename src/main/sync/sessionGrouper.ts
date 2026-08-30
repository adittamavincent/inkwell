import { reconstructText } from './reconstructor';

export interface KeystrokeRow {
  timestamp: string;
  appName: string;
  keyChar: string;
}

export interface SessionPreview {
  start: Date;
  app: string;
  text: string;
}

interface InternalSession {
  start: string;
  last: string;
  app: string;
  tokens: string[];
}

/**
 * Groups raw keystroke rows into typing sessions.
 * Shared by both the sync writer and live UI feed.
 *
 * Rules:
 * 1. A new session starts when the frontmost app changes.
 * 2. A new session starts when the gap since the PREVIOUS keystroke exceeds idleTimeoutSecs.
 * 3. Spaces (' ') are preserved verbatim; control tokens are trimmed.
 */
export function groupSessions(
  rows: Array<KeystrokeRow | [string, string, string]>,
  idleTimeoutSecs = 60
): SessionPreview[] {
  const idleMs = idleTimeoutSecs * 1000;
  const sessions: InternalSession[] = [];

  for (const item of rows) {
    let ts: string;
    let app: string;
    let key: string;

    if (Array.isArray(item)) {
      [ts, app, key] = item;
    } else {
      ts = item.timestamp;
      app = item.appName;
      key = item.keyChar;
    }

    const trimmedApp = (app || 'Unknown').trim();
    // A single character — notably a space (" ") — must be preserved verbatim.
    const cleanKey = key.length === 1 ? key : key.trim();
    if (!cleanKey) {
      continue;
    }

    const currentTs = new Date(ts).getTime();
    const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;

    let continued = false;
    if (lastSession && lastSession.app === trimmedApp) {
      const prevTs = new Date(lastSession.last).getTime();
      if (!isNaN(currentTs) && !isNaN(prevTs) && currentTs - prevTs <= idleMs) {
        lastSession.tokens.push(cleanKey);
        lastSession.last = ts;
        continued = true;
      }
    }

    if (!continued) {
      sessions.push({
        start: ts,
        last: ts,
        app: trimmedApp,
        tokens: [cleanKey],
      });
    }
  }

  const result: SessionPreview[] = [];
  for (const s of sessions) {
    const text = reconstructText(s.tokens);
    if (!text.trim()) {
      continue;
    }
    const startDate = new Date(s.start);
    result.push({
      start: isNaN(startDate.getTime()) ? new Date() : startDate,
      app: s.app,
      text,
    });
  }

  return result;
}
