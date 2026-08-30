import { describe, it, expect, vi, beforeEach } from 'vitest';

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

describe('Permission Check & Capture Guard (Non-persistent)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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

  it('stops capture cleanly when check reveals permission revoked', async () => {
    const { systemPreferences } = await import('electron');
    const { uIOhook } = await import('uiohook-napi');
    vi.mocked(systemPreferences.isTrustedAccessibilityClient).mockReturnValue(true);

    const { startCapture, stopCapture, isCaptureRunning } = await import('../src/main/capture/keyHook');
    startCapture();
    expect(isCaptureRunning()).toBe(true);

    // Simulate user revoking permission and on-demand check stopping capture
    vi.mocked(systemPreferences.isTrustedAccessibilityClient).mockReturnValue(false);
    stopCapture();

    expect(isCaptureRunning()).toBe(false);
    expect(uIOhook.stop).toHaveBeenCalled();
  });
});
