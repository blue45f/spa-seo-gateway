import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  // Reset DOM and storage state between tests
  document.documentElement.classList.remove('dark');
  if (typeof localStorage !== 'undefined') localStorage.clear();
});
