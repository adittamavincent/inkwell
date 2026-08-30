import type { api } from './index';

declare global {
  interface Window {
    inkwellApi: typeof api;
  }
}
