import { base, defineConfig, react } from '@heejun/eslint-config'
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
    // 벤더링된 단일 파일 위젯(SurveyDesk FeedbackWidget) — npm publish 막힌 동안 형제 앱에
    // 그대로 복붙해 쓰는 사본이라 react-compiler/react-hooks/jsx-a11y strict 규칙을
    // 설계상 통과 못 한다. 소스는 외부 패키지가 원본이므로 여기서 린트 대상에서 제외한다.
    // (DeskCloud 연동은 @heejun/deskcloud SDK 기반 네이티브 컴포넌트로 전환되어 린트 대상에 포함된다.)
    '**/components/feedback/**',
  ]),

  // 공유 베이스(TS + import 위생 + prettier 충돌 비활성). 프레임워크 비의존이라
  // Fastify 코어/서비스와 admin-frontend TSX 를 동일 규칙으로 린트한다.
  base({ files: ['**/*.{ts,tsx}'] }),

  // admin-frontend 는 실제 React 19 앱이므로 공유 react() 규칙(react-hooks +
  // react-refresh + jsx-a11y + react-compiler)을 src 에 적용한다.
  ...react({ files: ['apps/admin-frontend/src/**/*.{ts,tsx}'] }),

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

  // admin-frontend — react-hooks v7 컴파일러 진단 중 set-state-in-effect 만 비활성화.
  // 이 앱은 그동안 React 린트가 없었고, 해당 진단은 fetch-on-mount(`void load()`),
  // useCountUp RAF 보간, 커맨드팔레트 open/filtered 동기화 같은 의도적·정상 패턴에
  // 12건 일괄로 떠 위험한 리팩터를 강제한다. exhaustive-deps / rules-of-hooks(실버그)는
  // 그대로 켜 둔다. webtoon/remote-devtools/termsdesk 와 동일한 처리.
  {
    files: ['apps/admin-frontend/src/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
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
