import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { LiveFeed } from './components/LiveFeed';
import { SessionHistory } from './components/SessionHistory';
import { SettingsDrawer } from './components/SettingsDrawer';
import { PermissionBanner } from './components/PermissionBanner';
import { PermissionGate } from './components/PermissionGate';
import {
  SessionPreview,
  KeystrokePayload,
  SyncResponse,
  PermissionStatus,
} from './types';
import { reconstructText } from '../../shared/reconstructor';
import { DEFAULT_CONFIG, CogdexSyncConfig } from '../../shared/constants';

interface SuspendedSession {
  tokens: string[];
  app: string;
  start: string;
  suspendedAt: number;
}

export const App: React.FC = () => {
  const [isRunning, setIsRunning] = useState(true);
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null);
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  const [detectedApp, setDetectedApp] = useState<string>('');
  const [config, setConfig] = useState<CogdexSyncConfig>(DEFAULT_CONFIG);
  const [history, setHistory] = useState<SessionPreview[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // In-progress live typing session (React state for UI render)
  const [liveTokens, setLiveTokens] = useState<string[]>([]);
  const [liveApp, setLiveApp] = useState<string>('');
  const [liveStart, setLiveStart] = useState<string | null>(null);
  const [liveText, setLiveText] = useState<string>('');

  // Mutable live state refs to prevent any React async race conditions & dropped tokens
  const configRef = useRef(config);
  configRef.current = config;
  const liveTokensRef = useRef<string[]>([]);
  const liveAppRef = useRef<string>('');
  const liveStartRef = useRef<string | null>(null);
  const suspendedSessionRef = useRef<SuspendedSession | null>(null);
  const lastKeyTimeRef = useRef<number>(0);

  const flushLiveSession = useCallback(() => {
    // Flush any suspended session first
    if (suspendedSessionRef.current) {
      const reconstructed = reconstructText(suspendedSessionRef.current.tokens);
      if (reconstructed.trim()) {
        const newSession: SessionPreview = {
          start: suspendedSessionRef.current.start,
          app: suspendedSessionRef.current.app,
          text: reconstructed,
        };
        setHistory((prev) => [newSession, ...prev]);
      }
      suspendedSessionRef.current = null;
    }

    if (liveTokensRef.current.length > 0) {
      const reconstructed = reconstructText(liveTokensRef.current);
      if (reconstructed.trim()) {
        const newSession: SessionPreview = {
          start: liveStartRef.current || new Date().toISOString(),
          app: liveAppRef.current || 'Unknown',
          text: reconstructed,
        };
        setHistory((prev) => [newSession, ...prev]);
      }
      liveTokensRef.current = [];
      liveAppRef.current = '';
      liveStartRef.current = null;
      setLiveTokens([]);
      setLiveText('');
      setLiveStart(null);
      setLiveApp('');
    }
  }, []);

  const handlePermissionUpdate = useCallback((status: PermissionStatus) => {
    setPermissions(status);
    const fullyAuthorized =
      status.accessibility === 'authorized' && status.inputMonitoring === 'authorized';

    if (fullyAuthorized) {
      setIsOnboarded(true);
      window.inkwellApi?.getCaptureStatus().then(setIsRunning);
    } else {
      setIsRunning(false);
      // If we haven't onboarded yet, keep onboarding gate active
      setIsOnboarded((prev) => (prev === null ? false : prev));
    }
  }, []);

  // Initial Data Fetching & Realtime Keystroke Listener
  useEffect(() => {
    if (!window.inkwellApi) return;

    window.inkwellApi.getConfig().then(setConfig);
    window.inkwellApi.getHistory().then(setHistory);

    // Initial frontmost app
    window.inkwellApi.getActiveApp?.().then(setDetectedApp);

    // Initial non-prompting permission status check
    window.inkwellApi.checkPermissions().then((status) => {
      handlePermissionUpdate(status);
      const fullyAuthorized =
        status.accessibility === 'authorized' && status.inputMonitoring === 'authorized';
      setIsOnboarded(fullyAuthorized);
    });

    // Active App Changed Listener
    const unsubscribeActiveApp = window.inkwellApi.onActiveAppChanged?.((appName: string) => {
      setDetectedApp(appName);
    });

    // Keystroke Stream Listener
    const unsubscribeKeystroke = window.inkwellApi.onKeystroke((payload: KeystrokePayload) => {
      const now = Date.now();
      const idleLimitMs = (configRef.current.idleTimeoutSecs || 60) * 1000;
      const graceLimitMs = (configRef.current.appSwitchGraceSecs || 10) * 1000;
      const timedOut =
        lastKeyTimeRef.current > 0 && now - lastKeyTimeRef.current > idleLimitMs;

      if (timedOut) {
        // Idle gap splits unconditionally
        if (suspendedSessionRef.current) {
          const reconstructed = reconstructText(suspendedSessionRef.current.tokens);
          if (reconstructed.trim()) {
            const finishedSuspended: SessionPreview = {
              start: suspendedSessionRef.current.start,
              app: suspendedSessionRef.current.app,
              text: reconstructed,
            };
            setHistory((prev) => [finishedSuspended, ...prev]);
          }
          suspendedSessionRef.current = null;
        }

        if (liveTokensRef.current.length > 0) {
          const reconstructed = reconstructText(liveTokensRef.current);
          if (reconstructed.trim()) {
            const finishedSession: SessionPreview = {
              start: liveStartRef.current || new Date().toISOString(),
              app: liveAppRef.current || 'Unknown',
              text: reconstructed,
            };
            setHistory((prev) => [finishedSession, ...prev]);
          }
        }

        liveTokensRef.current = [payload.keyChar];
        liveAppRef.current = payload.appName;
        liveStartRef.current = payload.timestamp;
      } else if (liveAppRef.current && liveAppRef.current === payload.appName) {
        // Continuation in same app
        liveTokensRef.current.push(payload.keyChar);
      } else if (
        suspendedSessionRef.current &&
        suspendedSessionRef.current.app === payload.appName &&
        now - suspendedSessionRef.current.suspendedAt <= graceLimitMs &&
        liveTokensRef.current.length <= 2
      ) {
        // Quick return to suspended app within grace window with <= 2 stray keys in other app.
        // Discard stray interstitial tokens and merge into original session!
        liveTokensRef.current = [...suspendedSessionRef.current.tokens, payload.keyChar];
        liveAppRef.current = suspendedSessionRef.current.app;
        liveStartRef.current = suspendedSessionRef.current.start;
        suspendedSessionRef.current = null;
      } else {
        // App changed or grace window exceeded or real typing in other app
        if (suspendedSessionRef.current) {
          const reconstructed = reconstructText(suspendedSessionRef.current.tokens);
          if (reconstructed.trim()) {
            const finishedSuspended: SessionPreview = {
              start: suspendedSessionRef.current.start,
              app: suspendedSessionRef.current.app,
              text: reconstructed,
            };
            setHistory((prev) => [finishedSuspended, ...prev]);
          }
          suspendedSessionRef.current = null;
        }

        if (liveTokensRef.current.length > 0) {
          // Suspend current session
          suspendedSessionRef.current = {
            tokens: [...liveTokensRef.current],
            app: liveAppRef.current,
            start: liveStartRef.current || new Date().toISOString(),
            suspendedAt: lastKeyTimeRef.current || now,
          };
        }

        // Start interstitial/new session
        liveTokensRef.current = [payload.keyChar];
        liveAppRef.current = payload.appName;
        liveStartRef.current = payload.timestamp;
      }

      lastKeyTimeRef.current = now;

      // Update React state for instant UI rendering
      const currentTokens = [...liveTokensRef.current];
      setLiveTokens(currentTokens);
      setLiveApp(liveAppRef.current);
      setLiveStart(liveStartRef.current);
      setLiveText(reconstructText(currentTokens));
    });

    // Main Process Permission Watcher Event Listeners
    const unsubscribeStatusChanged = window.inkwellApi.onPermissionStatusChanged?.(
      (status: PermissionStatus) => {
        handlePermissionUpdate(status);
      }
    );

    const unsubscribePermissionGranted = window.inkwellApi.onPermissionGranted?.(() => {
      window.inkwellApi?.checkPermissions().then(handlePermissionUpdate);
    });

    const unsubscribePermissionRevoked = window.inkwellApi.onPermissionRevoked?.(() => {
      setIsRunning(false);
      window.inkwellApi?.checkPermissions().then(handlePermissionUpdate);
    });

    return () => {
      unsubscribeActiveApp?.();
      unsubscribeKeystroke();
      unsubscribeStatusChanged?.();
      unsubscribePermissionGranted?.();
      unsubscribePermissionRevoked?.();
    };
  }, [handlePermissionUpdate]);

  // Re-check permission on window focus to immediately detect in-session revocation or grant
  useEffect(() => {
    const checkPerm = () => {
      const api = window.inkwellApi;
      if (api) {
        api.checkPermissions().then(handlePermissionUpdate);
      }
    };

    window.addEventListener('focus', checkPerm);
    return () => {
      window.removeEventListener('focus', checkPerm);
    };
  }, [handlePermissionUpdate]);

  const handleToggleCapture = async () => {
    if (!window.inkwellApi) return;
    const nextStatus = !isRunning;
    const result = await window.inkwellApi.toggleCapture(nextStatus);
    setIsRunning(result);
  };

  const handleClearHistory = async () => {
    if (!window.inkwellApi) return;
    await window.inkwellApi.clearHistory();
    liveTokensRef.current = [];
    liveAppRef.current = '';
    liveStartRef.current = null;
    suspendedSessionRef.current = null;
    lastKeyTimeRef.current = 0;
    setHistory([]);
    setLiveTokens([]);
    setLiveText('');
    setLiveStart(null);
    setLiveApp('');
  };

  const handleCopyText = async (text: string) => {
    if (!window.inkwellApi) return;
    await window.inkwellApi.copyToClipboard(text);
  };

  const handleCopyAll = async () => {
    if (!window.inkwellApi) return;
    let fullPreview = '';
    if (liveText.trim()) {
      const timeStr = liveStart ? new Date(liveStart).toLocaleTimeString() : '';
      fullPreview += `${timeStr} · ${liveApp || 'Live'}\n${liveText}\n\n`;
    }
    if (suspendedSessionRef.current) {
      const recon = reconstructText(suspendedSessionRef.current.tokens);
      if (recon.trim()) {
        const timeStr = new Date(suspendedSessionRef.current.start).toLocaleTimeString();
        fullPreview += `${timeStr} · ${suspendedSessionRef.current.app}\n${recon}\n\n`;
      }
    }
    for (const s of history) {
      const timeStr = new Date(s.start).toLocaleTimeString();
      fullPreview += `${timeStr} · ${s.app}\n${s.text}\n\n`;
    }

    await window.inkwellApi.copyToClipboard(fullPreview.trim());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  };

  const handleSaveConfig = async (newConfig: Partial<CogdexSyncConfig>) => {
    if (!window.inkwellApi) return;
    const updated = await window.inkwellApi.saveConfig(newConfig);
    setConfig(updated);
  };

  const handleForceSync = async (): Promise<SyncResponse> => {
    if (!window.inkwellApi) {
      return { success: false, message: 'Inkwell API not available' };
    }
    flushLiveSession();
    return window.inkwellApi.forceSync();
  };

  const handleRequestAccessibility = async (): Promise<void> => {
    if (!window.inkwellApi?.requestAccessibility) return;
    await window.inkwellApi.requestAccessibility();
  };

  const handleRequestInputMonitoring = async (): Promise<void> => {
    if (!window.inkwellApi?.requestInputMonitoring) return;
    await window.inkwellApi.requestInputMonitoring();
  };

  const handleOpenAccessibilitySettings = async () => {
    if (!window.inkwellApi?.openAccessibilitySettings) return;
    await window.inkwellApi.openAccessibilitySettings();
  };

  const handleOpenInputMonitoringSettings = async () => {
    if (!window.inkwellApi?.openInputMonitoringSettings) return;
    await window.inkwellApi.openInputMonitoringSettings();
  };

  // Loading state before initial check resolves (prevents flash of gate)
  if (isOnboarded === null || !permissions) {
    return <div className="h-screen w-screen bg-ink-bg" />;
  }

  // 1. First-Launch / Missing Permission Onboarding Gate
  if (!isOnboarded) {
    return (
      <PermissionGate
        onGranted={() => {
          setIsOnboarded(true);
          window.inkwellApi?.getCaptureStatus().then(setIsRunning);
        }}
        accessibility={permissions.accessibility}
        inputMonitoring={permissions.inputMonitoring}
        onRequestAccessibility={handleRequestAccessibility}
        onRequestInputMonitoring={handleRequestInputMonitoring}
        onOpenAccessibilitySettings={handleOpenAccessibilitySettings}
        onOpenInputMonitoringSettings={handleOpenInputMonitoringSettings}
      />
    );
  }

  const effectiveSessionCount =
    history.length +
    (liveText ? 1 : 0) +
    (suspendedSessionRef.current && reconstructText(suspendedSessionRef.current.tokens).trim() ? 1 : 0);

  // 2. Normal Main Application UI
  return (
    <div className="flex flex-col h-screen w-screen bg-ink-bg text-ink-text overflow-hidden">
      <Header
        isRunning={isRunning}
        detectedApp={detectedApp}
        onToggleCapture={handleToggleCapture}
        onClear={handleClearHistory}
        onCopyAll={handleCopyAll}
        isCopied={isCopied}
        isSettingsOpen={isSettingsOpen}
        onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
        sessionCount={effectiveSessionCount}
      />

      {/* Safety Net Banner for in-session permission revocation / missing permission */}
      <PermissionBanner
        accessibility={permissions.accessibility}
        inputMonitoring={permissions.inputMonitoring}
        onRequestAccessibility={handleRequestAccessibility}
        onRequestInputMonitoring={handleRequestInputMonitoring}
        onOpenAccessibilitySettings={handleOpenAccessibilitySettings}
        onOpenInputMonitoringSettings={handleOpenInputMonitoringSettings}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <LiveFeed
          app={liveApp}
          text={liveText}
          keystrokeCount={liveTokens.length}
        />

        <SessionHistory
          sessions={history}
          onCopyText={handleCopyText}
        />

        {/* Overlay backdrop when settings open on compact screens */}
        {isSettingsOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-20 md:hidden"
            onClick={() => setIsSettingsOpen(false)}
          />
        )}

        <SettingsDrawer
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          config={config}
          onSaveConfig={handleSaveConfig}
          onForceSync={handleForceSync}
        />
      </main>
    </div>
  );
};
