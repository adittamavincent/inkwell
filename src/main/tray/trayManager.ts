import { app, Menu, nativeImage, Tray, BrowserWindow } from 'electron';
import { isCaptureRunning, startCapture, stopCapture } from '../capture/keyHook';

let tray: Tray | null = null;

function createTrayIcon(): Electron.NativeImage {
  // Create a clean 16x16 monochrome template icon for macOS menu bar
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>`;
  const img = nativeImage.createFromBuffer(Buffer.from(svg));
  img.setTemplateImage(true);
  return img;
}

export function updateTrayMenu(mainWindow: BrowserWindow | null): void {
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
        updateTrayMenu(mainWindow);
      },
    },
    {
      label: 'Open Inkwell Window',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Inkwell',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip(running ? 'Inkwell — Capturing' : 'Inkwell — Paused');
  tray.setContextMenu(contextMenu);
}

export function setupTray(mainWindow: BrowserWindow | null): Tray {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  updateTrayMenu(mainWindow);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  return tray;
}
