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

describe('Permission Check & Capture Guard (Non-persistent)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('does not start uIOhook if accessibility is false', async () => {
    const { systemPreferences } = await import('electron');
    vi.mocked(systemPreferences.isTrustedAccessibilityClient).mockReturnValue(false);

    const mockHook = { start: vi.fn(), stop: vi.fn(), on: vi.fn(), removeAllListeners: vi.fn() };
    const { _setHookForTesting, startCapture, isCaptureRunning } = await import('../src/main/capture/keyHook');
    _setHookForTesting(mockHook);

    const started = startCapture();

    expect(started).toBe(false);
    expect(isCaptureRunning()).toBe(false);
    expect(mockHook.start).not.toHaveBeenCalled();
  });

  it('starts uIOhook if accessibility is true', async () => {
    const { systemPreferences } = await import('electron');
    vi.mocked(systemPreferences.isTrustedAccessibilityClient).mockReturnValue(true);

    const mockHook = { start: vi.fn(), stop: vi.fn(), on: vi.fn(), removeAllListeners: vi.fn() };
    const { _setHookForTesting, startCapture, isCaptureRunning } = await import('../src/main/capture/keyHook');
    _setHookForTesting(mockHook);

    const started = startCapture();

    expect(started).toBe(true);
    expect(isCaptureRunning()).toBe(true);
    expect(mockHook.start).toHaveBeenCalled();
  });

  it('stops capture cleanly when permission is revoked', async () => {
    const { systemPreferences } = await import('electron');
    vi.mocked(systemPreferences.isTrustedAccessibilityClient).mockReturnValue(true);

    const mockHook = { start: vi.fn(), stop: vi.fn(), on: vi.fn(), removeAllListeners: vi.fn() };
    const { _setHookForTesting, startCapture, stopCapture, isCaptureRunning } = await import('../src/main/capture/keyHook');
    _setHookForTesting(mockHook);

    startCapture();
    expect(isCaptureRunning()).toBe(true);

    // Simulate stopCapture being called after permission is revoked
    vi.mocked(systemPreferences.isTrustedAccessibilityClient).mockReturnValue(false);
    stopCapture();

    expect(isCaptureRunning()).toBe(false);
    expect(mockHook.stop).toHaveBeenCalled();
  });
});
