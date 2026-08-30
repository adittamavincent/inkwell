import { defineConfig } from 'vite';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig({
  root: path.join(__dirname, 'src/renderer'),
  publicDir: path.join(__dirname, 'src/renderer/public'),
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer/src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@preload': path.resolve(__dirname, 'src/preload'),
    },
  },
  plugins: [
    react(),
    electron([
      {
        entry: path.join(__dirname, 'src/main/index.ts'),
        onstart(options) {
          options.startup();
        },
        vite: {
          build: {
            outDir: path.join(__dirname, 'dist-electron/main'),
            rollupOptions: {
              external: [
                'electron',
                'better-sqlite3',
                'uiohook-napi',
                'active-win',
              ],
            },
          },
        },
      },
      {
        entry: path.join(__dirname, 'src/preload/index.ts'),
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: path.join(__dirname, 'dist-electron/preload'),
            lib: {
              entry: path.join(__dirname, 'src/preload/index.ts'),
              formats: ['cjs'],
              fileName: () => 'index.cjs',
            },
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: 'index.cjs',
                exports: 'named',
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  build: {
    outDir: path.join(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
