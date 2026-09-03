import { app, Menu, nativeImage, Tray, BrowserWindow } from 'electron';
import path from 'node:path';
import { isCaptureRunning, startCapture, stopCapture } from '../capture/keyHook';
import { requestQuit } from '../lifecycle';
import { logger } from '../logger';

let tray: Tray | null = null;

function createTrayIcon(): Electron.NativeImage {
  // Load a proper PNG template image for the macOS menu bar.
  // nativeImage.createFromBuffer does NOT support SVG — only PNG/JPEG/BMP.
  // macOS template images automatically adapt to light/dark mode.
  // Resolve relative to the app root so this works in both dev and packaged builds.
  const appRoot = app.getAppPath();
  const iconPath = path.join(appRoot, 'icons', 'trayTemplate.png');
  const img = nativeImage.createFromPath(iconPath);
  img.setTemplateImage(true);
  return img;
}

export type WindowTarget = BrowserWindow | null | (() => BrowserWindow | null);

function resolveWindow(target?: WindowTarget): BrowserWindow | null {
  if (typeof target === 'function') {
    return target();
  }
  return target || null;
}

export function updateTrayMenu(
  windowTarget?: WindowTarget,
  onOpenWindow?: () => void
): void {
  if (!tray) return;

  const running = isCaptureRunning();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: running ? '● Capturing Keystrokes' : '○ Capture Paused',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: running ? 'Pause Capture' : 'Resume Capture',
      click: () => {
        if (running) {
          stopCapture();
        } else {
          startCapture();
        }
        updateTrayMenu(windowTarget, onOpenWindow);
      },
    },
    {
      label: 'Open Inkwell Window',
      click: () => {
        if (onOpenWindow) {
          onOpenWindow();
        } else {
          const win = resolveWindow(windowTarget);
          if (win) {
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
          }
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Inkwell',
      click: () => {
        requestQuit();
      },
    },
  ]);

  tray.setToolTip(running ? 'Inkwell — Capturing' : 'Inkwell — Paused');
  tray.setContextMenu(contextMenu);
}

export function setupTray(
  windowTarget?: WindowTarget,
  onOpenWindow?: () => void,
  onHideWindow?: () => void
): Tray {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  updateTrayMenu(windowTarget, onOpenWindow);
  logger.info('tray', 'System tray initialized');

  tray.on('click', () => {
    const win = resolveWindow(windowTarget);
    if (win && win.isVisible()) {
      if (onHideWindow) {
        onHideWindow();
      } else {
        win.hide();
      }
    } else {
      if (onOpenWindow) {
        onOpenWindow();
      } else if (win) {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      }
    }
  });

  return tray;
}
