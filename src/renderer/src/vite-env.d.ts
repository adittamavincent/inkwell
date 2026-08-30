/// <reference types="vite/client" />
import type { api } from '../../preload/index';

declare global {
  interface Window {
    inkwellApi?: typeof api;
  }
}
