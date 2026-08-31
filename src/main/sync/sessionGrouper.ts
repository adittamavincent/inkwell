import { reconstructText } from './reconstructor';

export interface KeystrokeRow {
  timestamp: string;
  appName: string;
  keyChar: string;
}

export interface SessionPreview {
  start: Date | string;
  startIso?: string;
  endIso?: string;
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
 * 1. A new session starts when the frontmost app changes, unless returning to the suspended
 *    app within appSwitchGraceSecs with trivial interstitial keystrokes (<= 2 keys).
 * 2. A new session starts when the gap since the PREVIOUS keystroke exceeds idleTimeoutSecs.
 * 3. Spaces (' ') are preserved verbatim; control tokens are trimmed.
 */
export function groupSessions(
  rows: Array<KeystrokeRow | [string, string, string]>,
  idleTimeoutSecs = 60,
  appSwitchGraceSecs = 10
): SessionPreview[] {
  const idleMs = idleTimeoutSecs * 1000;
  const graceMs = appSwitchGraceSecs * 1000;
  const sessions: InternalSession[] = [];

  const state: {
    activeSession: InternalSession | null;
    suspendedSession: InternalSession | null;
    suspendedAt: number;
    lastKeystrokeTs: number;
  } = {
    activeSession: null,
    suspendedSession: null,
    suspendedAt: 0,
    lastKeystrokeTs: 0,
  };

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
    const isIdleTimeout =
      state.lastKeystrokeTs > 0 && !isNaN(currentTs) && currentTs - state.lastKeystrokeTs > idleMs;

    if (isIdleTimeout) {
      // Idle timeout forces a complete session break
      if (state.suspendedSession) {
        sessions.push(state.suspendedSession);
        state.suspendedSession = null;
      }
      if (state.activeSession) {
        sessions.push(state.activeSession);
        state.activeSession = null;
      }
      state.activeSession = {
        start: ts,
        last: ts,
        app: trimmedApp,
        tokens: [cleanKey],
      };
    } else if (state.activeSession && state.activeSession.app === trimmedApp) {
      // Continuation in same app
      state.activeSession.tokens.push(cleanKey);
      state.activeSession.last = ts;
    } else if (
      state.suspendedSession &&
      state.suspendedSession.app === trimmedApp &&
      currentTs - state.suspendedAt <= graceMs &&
      state.activeSession &&
      state.activeSession.tokens.length <= 2
    ) {
      // Quick round-trip back to suspended app within grace window with <= 2 stray keys in other app.
      // Resume the suspended session and discard the stray interstitial tokens.
      const resumedSession = state.suspendedSession;
      state.suspendedSession = null;
      resumedSession.tokens.push(cleanKey);
      resumedSession.last = ts;
      state.activeSession = resumedSession;
    } else {
      // Genuinely different app or grace period exceeded or real typing occurred in other app
      if (state.suspendedSession) {
        sessions.push(state.suspendedSession);
        state.suspendedSession = null;
      }
      if (state.activeSession) {
        state.suspendedSession = state.activeSession;
        state.suspendedAt = new Date(state.activeSession.last).getTime();
      }
      state.activeSession = {
        start: ts,
        last: ts,
        app: trimmedApp,
        tokens: [cleanKey],
      };
    }

    state.lastKeystrokeTs = currentTs;
  }

  if (state.suspendedSession) {
    sessions.push(state.suspendedSession);
  }
  if (state.activeSession && state.activeSession !== state.suspendedSession) {
    sessions.push(state.activeSession);
  }

  // Sort sessions chronologically by start time
  sessions.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const result: SessionPreview[] = [];
  for (const s of sessions) {
    const text = reconstructText(s.tokens);
    if (!text.trim()) {
      continue;
    }
    const startDate = new Date(s.start);
    result.push({
      start: isNaN(startDate.getTime()) ? new Date() : startDate,
      startIso: s.start,
      endIso: s.last,
      app: s.app,
      text,
    });
  }

  return result;
}
