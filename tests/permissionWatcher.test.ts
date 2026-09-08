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
    const mockMacPerms = {
      getAuthStatus: vi.fn((type: string) => {
        if (type === 'accessibility') return 'denied';
        if (type === 'input-monitoring') return 'authorized';
        return 'not determined';
      }),
      askForAccessibilityAccess: vi.fn(),
      askForInputMonitoringAccess: vi.fn(),
    };

    const { _setMacPermissionsForTesting } = await import('../src/main/capture/permissions');
    _setMacPermissionsForTesting(mockMacPerms);

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
    const mockMacPerms = {
      getAuthStatus: vi.fn((type: string) => {
        if (type === 'accessibility') return 'authorized';
        if (type === 'input-monitoring') return 'denied';
        return 'not determined';
      }),
      askForAccessibilityAccess: vi.fn(),
      askForInputMonitoringAccess: vi.fn(),
    };

    const { _setMacPermissionsForTesting } = await import('../src/main/capture/permissions');
    _setMacPermissionsForTesting(mockMacPerms);

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
    const mockMacPerms = {
      getAuthStatus: vi.fn().mockReturnValue('authorized'),
      askForAccessibilityAccess: vi.fn(),
      askForInputMonitoringAccess: vi.fn(),
    };

    const { _setMacPermissionsForTesting } = await import('../src/main/capture/permissions');
    _setMacPermissionsForTesting(mockMacPerms);

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
    let accStatus = 'authorized';
    const mockMacPerms = {
      getAuthStatus: vi.fn((type: string) => {
        if (type === 'accessibility') return accStatus;
        return 'authorized';
      }),
      askForAccessibilityAccess: vi.fn(),
      askForInputMonitoringAccess: vi.fn(),
    };

    const { _setMacPermissionsForTesting } = await import('../src/main/capture/permissions');
    _setMacPermissionsForTesting(mockMacPerms);

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

    // Revoke accessibility — first poll is pending (debounce)
    accStatus = 'denied';
    const status2 = checkAndSyncPermissionState();
    expect(status2).toEqual({ accessibility: 'denied', inputMonitoring: 'authorized' });
    // Not yet stopped — waiting for second confirming poll
    expect(isCaptureRunning()).toBe(true);

    // Second poll confirms the revocation -> capture stops
    const status3 = checkAndSyncPermissionState();
    expect(status3).toEqual({ accessibility: 'denied', inputMonitoring: 'authorized' });
    expect(isCaptureRunning()).toBe(false);
    expect(mockHook.stop).toHaveBeenCalled();
  });

  it('polls on interval and fires callback when status changes', async () => {
    vi.useFakeTimers();
    let currentStatus = 'not determined';

    const mockMacPerms = {
      getAuthStatus: vi.fn(() => currentStatus),
      askForAccessibilityAccess: vi.fn(),
      askForInputMonitoringAccess: vi.fn(),
    };

    const { _setMacPermissionsForTesting } = await import('../src/main/capture/permissions');
    _setMacPermissionsForTesting(mockMacPerms);

    const mockHook = { start: vi.fn(), stop: vi.fn(), on: vi.fn(), removeAllListeners: vi.fn() };
    const { _setHookForTesting } = await import('../src/main/capture/keyHook');
    const { startPermissionWatcher } = await import('../src/main/capture/permissionWatcher');
    _setHookForTesting(mockHook);

    const callback = vi.fn();
    startPermissionWatcher(callback, 500);

    // Change status
    currentStatus = 'authorized';

    // First poll detects change (pending), second poll confirms it (debounce)
    vi.advanceTimersByTime(1000);

    expect(callback).toHaveBeenCalledWith({
      accessibility: 'authorized',
      inputMonitoring: 'authorized',
    });

    vi.useRealTimers();
  });
});
