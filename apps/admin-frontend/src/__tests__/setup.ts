import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

// happy-dom v20.x does not expose localStorage on Node 26; polyfill it so
// tests that read/write storage work regardless of the runtime version.
if (typeof window !== 'undefined' && !window.localStorage) {
  let store: Record<string, string> = {};
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        store = {};
      },
    },
  });
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  document.documentElement.classList.remove('dark');
  window.localStorage?.clear();
});
