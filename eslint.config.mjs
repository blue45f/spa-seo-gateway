import { base, defineConfig } from '@heejun/eslint-config'
import { globalIgnores } from 'eslint/config'
import globals from 'globals'

export default defineConfig(
  globalIgnores([
    '**/dist/**',
    '**/build/**',
    '**/node_modules/**',
    '**/coverage/**',
    '**/storybook-static/**',
    '**/.vercel/**',
    '**/.venv/**',
    '**/*.d.ts',
    '**/*.config.*',
  ]),

  // 공유 베이스(TS + import 위생 + prettier 충돌 비활성). 프레임워크 비의존이라
  // Fastify 코어/서비스와 admin-frontend TSX 를 동일 규칙으로 린트한다.
  base({ files: ['**/*.{ts,tsx}'] }),

  // 서버/코어/스크립트 — Node 런타임 전역.
  {
    files: ['**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // admin-frontend — 브라우저 전역(DOM/window 등).
  {
    files: ['apps/admin-frontend/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },

  // 테스트 — Vitest globals; 목/픽스처에서 any 허용.
  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
)
