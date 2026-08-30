import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  shell: {
    openExternal: vi.fn(),
  },
}));

// Mock node-mac-permissions
vi.mock('node-mac-permissions', () => ({
  getAuthStatus: vi.fn(),
  askForAccessibilityAccess: vi.fn(),
  askForInputMonitoringAccess: vi.fn(),
}));

describe('Permission Check & Capture Guard (node-mac-permissions)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    const { stopPermissionWatcher } = await import('../src/main/capture/permissionWatcher');
    stopPermissionWatcher();
  });

  it('does not start uIOhook if accessibility is not authorized', async () => {
    const { getAuthStatus } = await import('node-mac-permissions');
    vi.mocked(getAuthStatus).mockImplementation((type: string) => {
      if (type === 'accessibility') return 'denied';
      if (type === 'input-monitoring') return 'authorized';
      return 'not determined';
    });

    const mockHook = { start: vi.fn(), stop: vi.fn(), on: vi.fn(), removeAllListeners: vi.fn() };
    const { _setHookForTesting, startCapture, isCaptureRunning } = await import(
      '../src/main/capture/keyHook'
    );
    _setHookForTesting(mockHook);

    const started = startCapture();

    expect(started).toBe(false);
    expect(isCaptureRunning()).toBe(false);
    expect(mockHook.start).not.toHaveBeenCalled();
  });

  it('does not start uIOhook if input-monitoring is not authorized', async () => {
    const { getAuthStatus } = await import('node-mac-permissions');
    vi.mocked(getAuthStatus).mockImplementation((type: string) => {
      if (type === 'accessibility') return 'authorized';
      if (type === 'input-monitoring') return 'denied';
      return 'not determined';
    });

    const mockHook = { start: vi.fn(), stop: vi.fn(), on: vi.fn(), removeAllListeners: vi.fn() };
    const { _setHookForTesting, startCapture, isCaptureRunning } = await import(
      '../src/main/capture/keyHook'
    );
    _setHookForTesting(mockHook);

    const started = startCapture();

    expect(started).toBe(false);
    expect(isCaptureRunning()).toBe(false);
    expect(mockHook.start).not.toHaveBeenCalled();
  });

  it('starts uIOhook if both accessibility and input-monitoring are authorized', async () => {
    const { getAuthStatus } = await import('node-mac-permissions');
    vi.mocked(getAuthStatus).mockReturnValue('authorized');

    const mockHook = { start: vi.fn(), stop: vi.fn(), on: vi.fn(), removeAllListeners: vi.fn() };
    const { _setHookForTesting, startCapture, isCaptureRunning } = await import(
      '../src/main/capture/keyHook'
    );
    _setHookForTesting(mockHook);

    const started = startCapture();

    expect(started).toBe(true);
    expect(isCaptureRunning()).toBe(true);
    expect(mockHook.start).toHaveBeenCalled();
  });

  it('stops capture cleanly when permission is revoked during checkAndSyncPermissionState', async () => {
    const { getAuthStatus } = await import('node-mac-permissions');
    vi.mocked(getAuthStatus).mockReturnValue('authorized');

    const mockHook = { start: vi.fn(), stop: vi.fn(), on: vi.fn(), removeAllListeners: vi.fn() };
    const { _setHookForTesting, isCaptureRunning } = await import(
      '../src/main/capture/keyHook'
    );
    const { checkAndSyncPermissionState } = await import(
      '../src/main/capture/permissionWatcher'
    );
    _setHookForTesting(mockHook);

    // Initial state: authorized -> capture starts
    const status1 = checkAndSyncPermissionState();
    expect(status1).toEqual({ accessibility: 'authorized', inputMonitoring: 'authorized' });
    expect(isCaptureRunning()).toBe(true);

    // Revoke accessibility
    vi.mocked(getAuthStatus).mockImplementation((type: string) => {
      if (type === 'accessibility') return 'denied';
      return 'authorized';
    });

    const status2 = checkAndSyncPermissionState();
    expect(status2).toEqual({ accessibility: 'denied', inputMonitoring: 'authorized' });
    expect(isCaptureRunning()).toBe(false);
    expect(mockHook.stop).toHaveBeenCalled();
  });

  it('polls on interval and fires callback when status changes', async () => {
    vi.useFakeTimers();
    const { getAuthStatus } = await import('node-mac-permissions');
    vi.mocked(getAuthStatus).mockReturnValue('not determined');

    const mockHook = { start: vi.fn(), stop: vi.fn(), on: vi.fn(), removeAllListeners: vi.fn() };
    const { _setHookForTesting } = await import('../src/main/capture/keyHook');
    const { startPermissionWatcher } = await import('../src/main/capture/permissionWatcher');
    _setHookForTesting(mockHook);

    const callback = vi.fn();
    startPermissionWatcher(callback, 500);

    // Change status
    vi.mocked(getAuthStatus).mockReturnValue('authorized');

    vi.advanceTimersByTime(500);

    expect(callback).toHaveBeenCalledWith({
      accessibility: 'authorized',
      inputMonitoring: 'authorized',
    });

    vi.useRealTimers();
  });
});
