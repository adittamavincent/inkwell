import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { LiveFeed } from './components/LiveFeed';
import { SessionHistory } from './components/SessionHistory';
import { SettingsDrawer } from './components/SettingsDrawer';
import { PermissionBanner } from './components/PermissionBanner';
import { PermissionGate } from './components/PermissionGate';
import { SessionPreview, KeystrokePayload, SyncResponse } from './types';
import { reconstructText } from '../../shared/reconstructor';
import { DEFAULT_CONFIG, CogdexSyncConfig } from '../../shared/constants';

export const App: React.FC = () => {
  const [isRunning, setIsRunning] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  const [isSuccessGate, setIsSuccessGate] = useState(false);
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
  const lastKeyTimeRef = useRef<number>(0);

  const flushLiveSession = useCallback(() => {
    if (liveTokensRef.current.length > 0) {
      const reconstructed = reconstructText(liveTokensRef.current);
      if (reconstructed.trim()) {
        const newSession: SessionPreview = {
          start: liveStartRef.current || new Date().toISOString(),
          app: liveAppRef.current || 'Unknown',
          text: reconstructed,
        };
        setHistory((prev) => [...prev, newSession]);
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

  // Initial Data Fetching & Realtime Keystroke Listener
  useEffect(() => {
    if (!window.inkwellApi) return;

    window.inkwellApi.getConfig().then(setConfig);
    window.inkwellApi.getHistory().then(setHistory);

    // Initial non-prompting permission check
    window.inkwellApi.checkPermissions(false).then((granted) => {
      setHasPermission(granted);
      setIsOnboarded(granted);
      if (granted) {
        window.inkwellApi?.getCaptureStatus().then(setIsRunning);
      }
    });

    // Keystroke Stream Listener
    const unsubscribeKeystroke = window.inkwellApi.onKeystroke((payload: KeystrokePayload) => {
      const now = Date.now();
      const idleLimitMs = (configRef.current.idleTimeoutSecs || 60) * 1000;
      const appChanged =
        Boolean(liveAppRef.current) && liveAppRef.current !== payload.appName;
      const timedOut =
        lastKeyTimeRef.current > 0 && now - lastKeyTimeRef.current > idleLimitMs;

      if (appChanged || timedOut) {
        // 1. Flush previous live session into history
        if (liveTokensRef.current.length > 0) {
          const reconstructed = reconstructText(liveTokensRef.current);
          if (reconstructed.trim()) {
            const finishedSession: SessionPreview = {
              start: liveStartRef.current || new Date().toISOString(),
              app: liveAppRef.current || 'Unknown',
              text: reconstructed,
            };
            setHistory((prev) => [...prev, finishedSession]);
          }
        }
        // 2. Start fresh session synchronously in refs
        liveTokensRef.current = [payload.keyChar];
        liveAppRef.current = payload.appName;
        liveStartRef.current = payload.timestamp;
      } else {
        // Append to current session synchronously in refs
        liveTokensRef.current.push(payload.keyChar);
        if (!liveAppRef.current) liveAppRef.current = payload.appName;
        if (!liveStartRef.current) liveStartRef.current = payload.timestamp;
      }

      lastKeyTimeRef.current = now;

      // Update React state for instant UI rendering
      const currentTokens = [...liveTokensRef.current];
      setLiveTokens(currentTokens);
      setLiveApp(liveAppRef.current);
      setLiveStart(liveStartRef.current);
      setLiveText(reconstructText(currentTokens));
    });

    // Main Process Permission Watcher Event Listener
    const unsubscribePermission = window.inkwellApi.onPermissionGranted?.(() => {
      setIsSuccessGate(true);
      setTimeout(() => {
        setHasPermission(true);
        setIsOnboarded(true);
        setIsSuccessGate(false);
        window.inkwellApi?.getCaptureStatus().then(setIsRunning);
      }, 600);
    });

    return () => {
      unsubscribeKeystroke();
      unsubscribePermission?.();
    };
  }, []);

  // Re-check permission on window focus to detect in-session revocation or grant
  useEffect(() => {
    const checkPerm = () => {
      const api = window.inkwellApi;
      if (api) {
        api.checkPermissions(false).then((granted) => {
          setHasPermission(granted);
          if (granted) {
            api.getCaptureStatus().then(setIsRunning);
            if (isOnboarded === false) {
              setIsOnboarded(true);
            }
          }
        });
      }
    };

    window.addEventListener('focus', checkPerm);
    return () => {
      window.removeEventListener('focus', checkPerm);
    };
  }, [isOnboarded]);

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
    for (const s of history) {
      const timeStr = new Date(s.start).toLocaleTimeString();
      fullPreview += `${timeStr} · ${s.app}\n${s.text}\n\n`;
    }
    if (liveText.trim()) {
      const timeStr = liveStart ? new Date(liveStart).toLocaleTimeString() : '';
      fullPreview += `${timeStr} · ${liveApp || 'Live'}\n${liveText}\n\n`;
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

  const handleRequestPermission = async (): Promise<boolean> => {
    if (!window.inkwellApi) return false;
    const granted = await window.inkwellApi.checkPermissions(true);
    setHasPermission(granted);
    if (granted) {
      setIsOnboarded(true);
      window.inkwellApi.getCaptureStatus().then(setIsRunning);
    }
    return granted;
  };

  const handleOpenSettings = async () => {
    if (!window.inkwellApi?.openSystemSettings) return;
    await window.inkwellApi.openSystemSettings();
  };

  // Loading state before initial check resolves (prevents flash of gate)
  if (isOnboarded === null) {
    return <div className="h-screen w-screen bg-ink-bg" />;
  }

  // 1. First-Launch / Missing Permission Onboarding Gate
  if (!isOnboarded) {
    return (
      <PermissionGate
        onGranted={() => {
          setHasPermission(true);
          setIsOnboarded(true);
          window.inkwellApi?.getCaptureStatus().then(setIsRunning);
        }}
        onRequestPermission={handleRequestPermission}
        onOpenSettings={handleOpenSettings}
        isGranted={isSuccessGate}
      />
    );
  }

  // 2. Normal Main Application UI
  return (
    <div className="flex flex-col h-screen w-screen bg-ink-bg text-ink-text overflow-hidden">
      <Header
        isRunning={isRunning}
        onToggleCapture={handleToggleCapture}
        onClear={handleClearHistory}
        onCopyAll={handleCopyAll}
        isCopied={isCopied}
        isSettingsOpen={isSettingsOpen}
        onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
        sessionCount={history.length + (liveText ? 1 : 0)}
      />

      {/* Safety Net Banner for in-session permission revocation */}
      <PermissionBanner
        hasPermission={hasPermission ?? true}
        onRequestPermission={handleRequestPermission}
        onOpenSettings={handleOpenSettings}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <LiveFeed
          app={liveApp}
          text={liveText}
          tokenCount={liveTokens.length}
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
