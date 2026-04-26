import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@spa-seo-gateway/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@spa-seo-gateway/admin-ui': resolve(__dirname, 'packages/admin-ui/src/index.ts'),
      '@spa-seo-gateway/multi-tenant': resolve(__dirname, 'packages/multi-tenant/src/index.ts'),
      '@spa-seo-gateway/cms': resolve(__dirname, 'packages/cms/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'packages/*/tests/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
    },
  },
});
