import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  systemPreferences: {
    isTrustedAccessibilityClient: vi.fn(),
  },
  shell: {
    openExternal: vi.fn(),
  },
}));

// Mock uiohook-napi
vi.mock('uiohook-napi', () => ({
  uIOhook: {
    start: vi.fn(),
    stop: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  },
  UiohookKey: {},
}));

describe('Permission Watcher & Capture Guard', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    const { stopPermissionWatcher } = await import('../src/main/capture/permissionWatcher');
    stopPermissionWatcher();
  });

  it('does not start uIOhook if accessibility is false', async () => {
    const { systemPreferences } = await import('electron');
    const { uIOhook } = await import('uiohook-napi');
    vi.mocked(systemPreferences.isTrustedAccessibilityClient).mockReturnValue(false);

    const { startCapture, isCaptureRunning } = await import('../src/main/capture/keyHook');
    const started = startCapture();

    expect(started).toBe(false);
    expect(isCaptureRunning()).toBe(false);
    expect(uIOhook.start).not.toHaveBeenCalled();
  });

  it('starts uIOhook if accessibility is true', async () => {
    const { systemPreferences } = await import('electron');
    const { uIOhook } = await import('uiohook-napi');
    vi.mocked(systemPreferences.isTrustedAccessibilityClient).mockReturnValue(true);

    const { startCapture, isCaptureRunning } = await import('../src/main/capture/keyHook');
    const started = startCapture();

    expect(started).toBe(true);
    expect(isCaptureRunning()).toBe(true);
    expect(uIOhook.start).toHaveBeenCalled();
  });

  it('stops capture immediately when permission transition is revoked', async () => {
    const { systemPreferences } = await import('electron');
    const { uIOhook } = await import('uiohook-napi');
    vi.mocked(systemPreferences.isTrustedAccessibilityClient).mockReturnValue(true);

    const { startCapture, isCaptureRunning } = await import('../src/main/capture/keyHook');
    startCapture();
    expect(isCaptureRunning()).toBe(true);

    const { startPermissionWatcher, checkAndSyncPermissionState } = await import(
      '../src/main/capture/permissionWatcher'
    );

    const callback = vi.fn();
    startPermissionWatcher(callback, 100);

    // Now simulate user disabling accessibility in macOS System Settings
    vi.mocked(systemPreferences.isTrustedAccessibilityClient).mockReturnValue(false);
    checkAndSyncPermissionState();

    expect(isCaptureRunning()).toBe(false);
    expect(uIOhook.stop).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(false);
  });
});
