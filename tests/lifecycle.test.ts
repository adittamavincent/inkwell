import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getIsQuitting, setIsQuitting, requestQuit, _resetLifecycleForTesting } from '../src/main/lifecycle';

const { mockApp, mockMenuBuildFromTemplate, mockTrayInstance } = vi.hoisted(() => {
  return {
    mockApp: {
      quit: vi.fn(),
      getAppPath: vi.fn(() => '/mock/app/path'),
      dock: {
        show: vi.fn(),
        hide: vi.fn(),
        setIcon: vi.fn(),
      },
    },
    mockMenuBuildFromTemplate: vi.fn(),
    mockTrayInstance: {
      setToolTip: vi.fn(),
      setContextMenu: vi.fn(),
      on: vi.fn(),
    },
  };
});

vi.mock('electron', () => ({
  app: mockApp,
  Menu: {
    buildFromTemplate: (template: any) => {
      mockMenuBuildFromTemplate(template);
      return template;
    },
    setApplicationMenu: vi.fn(),
  },
  nativeImage: {
    createFromBuffer: vi.fn(() => ({
      setTemplateImage: vi.fn(),
    })),
    createFromPath: vi.fn(() => ({
      setTemplateImage: vi.fn(),
    })),
  },
  Tray: vi.fn().mockImplementation(() => mockTrayInstance),
  BrowserWindow: vi.fn(),
}));

vi.mock('../src/main/capture/keyHook', () => ({
  isCaptureRunning: vi.fn(() => true),
  startCapture: vi.fn(),
  stopCapture: vi.fn(),
}));

describe('Lifecycle & Menu-Bar Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetLifecycleForTesting();
  });

  it('requestQuit() sets isQuitting to true and triggers app.quit()', () => {
    expect(getIsQuitting()).toBe(false);
    requestQuit();
    expect(getIsQuitting()).toBe(true);
    expect(mockApp.quit).toHaveBeenCalledTimes(1);
  });

  it('mainWindow close event calls preventDefault() and hides window/dock on macOS when isQuitting is false', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    try {
      const mockWindow = {
        hide: vi.fn(),
        show: vi.fn(),
        isVisible: vi.fn(() => true),
        isDestroyed: vi.fn(() => false),
      };

      const event = {
        preventDefault: vi.fn(),
      };

      const hideWindow = () => {
        if (mockWindow && !mockWindow.isDestroyed() && mockWindow.isVisible()) {
          mockWindow.hide();
        }
        if (process.platform === 'darwin' && mockApp.dock) {
          mockApp.dock.hide();
        }
      };

      const handleClose = (e: any) => {
        if (!getIsQuitting() && process.platform === 'darwin') {
          e.preventDefault();
          hideWindow();
        }
      };

      // 1. Close when NOT quitting
      setIsQuitting(false);
      handleClose(event);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(mockWindow.hide).toHaveBeenCalledTimes(1);
      expect(mockApp.dock.hide).toHaveBeenCalledTimes(1);

      // 2. Close when isQuitting IS true
      vi.clearAllMocks();
      setIsQuitting(true);
      handleClose(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(mockWindow.hide).not.toHaveBeenCalled();
      expect(mockApp.dock.hide).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('before-quit event prevents quit and hides GUI on Cmd+Q when isQuitting is false on macOS', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    try {
      const mockStopWatcher = vi.fn();
      const mockStopTracker = vi.fn();
      const mockStopCapture = vi.fn();
      const mockWindow = {
        hide: vi.fn(),
        isVisible: vi.fn(() => true),
        isDestroyed: vi.fn(() => false),
      };

      const hideWindow = () => {
        if (mockWindow && !mockWindow.isDestroyed() && mockWindow.isVisible()) {
          mockWindow.hide();
        }
        if (process.platform === 'darwin' && mockApp.dock) {
          mockApp.dock.hide();
        }
      };

      const handleBeforeQuit = (event: any) => {
        if (!getIsQuitting() && process.platform === 'darwin') {
          event.preventDefault();
          hideWindow();
          return;
        }
        setIsQuitting(true);
        mockStopWatcher();
        mockStopTracker();
        mockStopCapture();
      };

      // Simulating Cmd+Q (before-quit fired, isQuitting is false)
      const event = { preventDefault: vi.fn() };
      setIsQuitting(false);
      handleBeforeQuit(event);

      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(mockWindow.hide).toHaveBeenCalledTimes(1);
      expect(mockApp.dock.hide).toHaveBeenCalledTimes(1);
      expect(mockStopCapture).not.toHaveBeenCalled();

      // Simulating Quit from Tray Menu (requestQuit was called, isQuitting is true)
      vi.clearAllMocks();
      setIsQuitting(true);
      const quitEvent = { preventDefault: vi.fn() };
      handleBeforeQuit(quitEvent);

      expect(quitEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockStopWatcher).toHaveBeenCalledTimes(1);
      expect(mockStopTracker).toHaveBeenCalledTimes(1);
      expect(mockStopCapture).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('Tray "Quit Inkwell" menu item invokes requestQuit()', async () => {
    const { setupTray } = await import('../src/main/tray/trayManager');
    const mockWindow = {
      isMinimized: vi.fn(() => false),
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
      isVisible: vi.fn(() => false),
      hide: vi.fn(),
    } as any;

    // Initialize tray
    setupTray(mockWindow);

    expect(mockMenuBuildFromTemplate).toHaveBeenCalled();
    const template = mockMenuBuildFromTemplate.mock.calls[0][0];
    const quitItem = template.find((item: any) => item.label === 'Quit Inkwell');

    expect(quitItem).toBeDefined();
    expect(getIsQuitting()).toBe(false);
    expect(mockApp.quit).not.toHaveBeenCalled();

    // Click the quit item
    quitItem.click();

    expect(getIsQuitting()).toBe(true);
    expect(mockApp.quit).toHaveBeenCalledTimes(1);
  });
});

