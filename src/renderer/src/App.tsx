import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { LiveFeed } from './components/LiveFeed';
import { SessionHistory } from './components/SessionHistory';
import { SettingsDrawer } from './components/SettingsDrawer';
import { PermissionBanner } from './components/PermissionBanner';
import { CogdexSyncConfig, SessionPreview, KeystrokePayload, SyncResponse } from './types';
import { reconstructText } from '../../shared/reconstructor';

const DEFAULT_CONFIG: CogdexSyncConfig = {
  enabled: false,
  vaultPath: '',
  dailyFolderRoot: 'Daily',
  dayPattern: '%Y-%m-%d',
  keylogSuffix: ' - keylog',
  idleTimeoutSecs: 60,
  excludedApps: [
    '1password',
    'bitwarden',
    'keeper',
    'lastpass',
    'dashlane',
    'icloud keychain',
    'keypassxc',
    'macpass',
    'inkwell',
  ],
};

export const App: React.FC = () => {
  const [isRunning, setIsRunning] = useState(true);
  const [hasPermission, setHasPermission] = useState(true);
  const [config, setConfig] = useState<CogdexSyncConfig>(DEFAULT_CONFIG);
  const [history, setHistory] = useState<SessionPreview[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // In-progress live typing session
  const [liveTokens, setLiveTokens] = useState<string[]>([]);
  const [liveApp, setLiveApp] = useState<string>('');
  const [liveStart, setLiveStart] = useState<string | null>(null);
  const [liveText, setLiveText] = useState<string>('');
  const lastKeyTimeRef = useRef<number>(Date.now());

  // References to keep event handlers fresh
  const configRef = useRef(config);
  configRef.current = config;
  const liveTokensRef = useRef(liveTokens);
  liveTokensRef.current = liveTokens;
  const liveAppRef = useRef(liveApp);
  liveAppRef.current = liveApp;
  const liveStartRef = useRef(liveStart);
  liveStartRef.current = liveStart;

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
      setLiveTokens([]);
      setLiveText('');
      setLiveStart(null);
      setLiveApp('');
    }
  }, []);

  // Initial Data Fetching
  useEffect(() => {
    if (!window.inkwellApi) return;

    window.inkwellApi.getCaptureStatus().then(setIsRunning);
    window.inkwellApi.checkPermissions(false).then(setHasPermission);
    window.inkwellApi.getConfig().then(setConfig);
    window.inkwellApi.getHistory().then(setHistory);

    // Keystroke Stream Listener
    const unsubscribe = window.inkwellApi.onKeystroke((payload: KeystrokePayload) => {
      const now = Date.now();
      const idleLimitMs = (configRef.current.idleTimeoutSecs || 60) * 1000;
      const appChanged = liveAppRef.current && liveAppRef.current !== payload.appName;
      const timedOut = now - lastKeyTimeRef.current > idleLimitMs;

      if (appChanged || timedOut) {
        flushLiveSession();
        // Start fresh live session
        const nextTokens = [payload.keyChar];
        setLiveTokens(nextTokens);
        setLiveApp(payload.appName);
        setLiveStart(payload.timestamp);
        setLiveText(reconstructText(nextTokens));
      } else {
        // Append to existing live session
        const nextTokens = [...liveTokensRef.current, payload.keyChar];
        setLiveTokens(nextTokens);
        if (!liveAppRef.current) setLiveApp(payload.appName);
        if (!liveStartRef.current) setLiveStart(payload.timestamp);
        setLiveText(reconstructText(nextTokens));
      }

      lastKeyTimeRef.current = now;
    });

    return () => {
      unsubscribe();
    };
  }, [flushLiveSession]);

  const handleToggleCapture = async () => {
    if (!window.inkwellApi) return;
    const nextStatus = !isRunning;
    const result = await window.inkwellApi.toggleCapture(nextStatus);
    setIsRunning(result);
  };

  const handleClearHistory = async () => {
    if (!window.inkwellApi) return;
    await window.inkwellApi.clearHistory();
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
    return window.inkwellApi.forceSync();
  };

  const handleRequestPermission = async () => {
    if (!window.inkwellApi) return;
    const granted = await window.inkwellApi.checkPermissions(true);
    setHasPermission(granted);
  };

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

      <PermissionBanner
        hasPermission={hasPermission}
        onRequestPermission={handleRequestPermission}
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
