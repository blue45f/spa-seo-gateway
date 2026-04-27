import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Fastify 가 /admin/ui 아래에서 서빙 — 자산도 같은 prefix 로 절대경로 발급.
  base: '/admin/ui/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@heejun/spa-seo-gateway-core': resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
  build: {
    // packages/admin-ui 가 npm 으로 publish 될 때 public/ 안에 들어가도록 outDir 고정.
    outDir: resolve(__dirname, '../../packages/admin-ui/public'),
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react/') || id.includes('react-router')) {
              return 'react-vendor';
            }
            if (id.includes('zustand')) return 'state';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/admin/api': 'http://localhost:3000',
      '/metrics': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: true,
  },
});
