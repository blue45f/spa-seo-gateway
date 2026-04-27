import type { Lang } from './types';

type Strings = Record<string, string>;

const ko: Strings = {
  // Nav
  'nav.welcome': '소개',
  'nav.welcome.sub': '게이트웨이 한눈에',
  'nav.dashboard': '대시보드',
  'nav.dashboard.sub': '현재 상태',
  'nav.routes': '라우트',
  'nav.routes.sub': 'URL 패턴 오버라이드',
  'nav.cache': '캐시',
  'nav.cache.sub': 'TTL/SWR + 무효화',
  'nav.warm': '워밍',
  'nav.warm.sub': 'Sitemap 사전 캐시',
  'nav.test': '렌더 테스트',
  'nav.test.sub': '단일 URL 즉시 렌더',
  'nav.metrics': '메트릭',
  'nav.metrics.sub': 'Prometheus 시각화',
  'nav.lighthouse': 'Lighthouse',
  'nav.lighthouse.sub': '페이지 점수 측정',
  'nav.visual': '시각 회귀',
  'nav.visual.sub': '스크린샷 diff',
  'nav.ai': 'AI Schema',
  'nav.ai.sub': 'JSON-LD 자동 추론',
  'nav.audit': '감사 로그',
  'nav.audit.sub': 'HMAC 체인 + 변조 검출',
  'nav.api': 'API',
  'nav.api.sub': '엔드포인트 레퍼런스',
  'nav.library': '라이브러리',
  'nav.library.sub': 'npm 패키지 사용',
  'nav.help': '도움말',
  'nav.help.sub': 'FAQ · 트러블슈팅',

  // Auth
  'auth.login': '로그인',
  'auth.logout': 'logout',
  'auth.token-placeholder': 'X-Admin-Token 입력',
  'auth.authenticated': '인증됨',
  'auth.unauthenticated': '미인증',
  'auth.required': '인증이 필요한 페이지입니다. 우측 상단 토큰 입력 후 로그인 하세요.',

  // Theme / lang
  'theme.dark': '다크 모드',
  'theme.light': '라이트 모드',

  // Common buttons
  'btn.save-memory': '저장 (메모리)',
  'btn.save-disk': '저장 + 디스크 영구화',
  'btn.add': '+ 추가',
  'btn.delete': '삭제',
  'btn.run': '실행',
  'btn.refresh': '새로고침',
  'btn.start': '시작',
  'btn.running': '실행 중...',
  'btn.invalidate': 'URL 무효화',
  'btn.clear-all': '전체 초기화',
  'btn.measure': 'Lighthouse 측정',
  'btn.cancel': '취소',
  'btn.close': '닫기',

  // Common labels
  mode: '모드',
  origin: 'Origin',
  uptime: 'Uptime',
  node: 'Node',
  url: 'URL',

  // Welcome
  'welcome.headline': 'SPA SEO Gateway',
  'welcome.intro':
    'React/Vue/Svelte 가 만드는 동적 콘텐츠를 봇 요청 시점에 헤드리스 Chromium 으로 실시간 렌더링 해, 봇에겐 완성된 HTML, 사람에겐 원본 SPA 를 전달하는 게이트웨이.',
  'welcome.cards.bot': '봇이 들어오면 그 자리에서 렌더',
  'welcome.cards.bot.body':
    'isbot 의 1,000+ 패턴으로 봇 자동 식별 → 그 시점에 Chromium 으로 SPA 를 실행해 데이터 fetch / state 적용 / DOM 완성. 최종 HTML 을 봇에게 응답.',
  'welcome.cards.cache': '캐시 + SWR',
  'welcome.cards.cache.body':
    'Memory LRU + Redis 2-tier · Brotli 압축 · 만료 직후엔 stale 즉시 응답 + 백그라운드 갱신.',
  'welcome.cards.shield': '방어선',
  'welcome.cards.shield.body':
    'SSRF DNS 검사, host별 circuit breaker, soft 404 자동 감지, 자동 브라우저 재시작, rate limit, 호스트 화이트리스트.',
  'welcome.quickstart': '빠른 시작',

  // Dashboard
  'dashboard.empty': '아직 인증되지 않았거나 데이터가 없습니다.',

  // Routes
  'routes.title': '라우트 오버라이드',
  'routes.intro': '드래그로 순서 변경, ⌘/Ctrl + S 로 저장. 위에서 아래로 첫 매칭이 승리.',
  'routes.filter.placeholder': '패턴/셀렉터 필터...',
  'routes.empty': '정의된 라우트가 없습니다. 우측 상단 [+ 추가] 버튼으로 시작.',
  'routes.col.pattern': '패턴 (regex)',
  'routes.col.ttl': 'TTL (ms)',
  'routes.col.waitUntil': 'waitUntil',
  'routes.col.waitSelector': 'waitSelector',
  'routes.col.waitMs': 'waitMs',
  'routes.col.ignore': 'ignore',

  // Cache
  'cache.title': '캐시 관리',
  'cache.invalidate.label': 'URL 한 개 무효화',
  'cache.clear.label': '전체 캐시 초기화',
  'cache.clear.confirm': '캐시 전체를 삭제할까요? 다음 요청부터는 cold render 로 시작됩니다.',
  'cache.cleared': '캐시 전체 삭제됨',

  // Warm
  'warm.title': '사전 워밍 (sitemap)',
  'warm.sitemap.label': 'Sitemap URL',
  'warm.max.label': '최대 URL 갯수',
  'warm.concurrency.label': '동시 처리량',
  'warm.run': '워밍 시작',

  // Render test
  'test.title': '단일 URL 렌더 테스트',
  'test.url.label': 'URL',
  'test.ua.label': 'User-Agent (선택, 기본 Googlebot)',
  'test.run': '렌더 실행',
  'test.preview': '본문 미리보기 (앞 4000자)',

  // Metrics
  'metrics.title': '실시간 메트릭',
  'metrics.autoRefresh': '5초 자동 갱신',
  'metrics.lastUpdated': '마지막 갱신',
  'metrics.empty': '메트릭이 비어 있습니다. 렌더 테스트 등으로 트래픽을 흘려 보내 주세요.',

  // Lighthouse
  'lighthouse.title': 'Lighthouse 점수',
  'lighthouse.url.label': '대상 URL',
  'lighthouse.run': '측정 실행',
  'lighthouse.cached': '(캐시된 결과)',
  'lighthouse.scores.performance': 'Performance',
  'lighthouse.scores.accessibility': 'Accessibility',
  'lighthouse.scores.seo': 'SEO',
  'lighthouse.scores.bestPractices': 'Best Practices',

  // Visual
  'visual.title': '시각 회귀 (Visual Regression)',
  'visual.desc':
    'URL 의 스크린샷을 캡처해 로컬 baseline 과 picture diff. 첫 실행은 baseline 으로 저장, 이후 실행부터 픽셀 단위 차이를 측정.',
  'visual.url': 'URL',
  'visual.mode': '모드',
  'visual.mode.auto': 'auto — 없으면 baseline 저장',
  'visual.mode.create': 'create — 새 baseline 강제 저장',
  'visual.mode.compare': 'compare — 비교만',
  'visual.threshold': 'threshold (0~1)',
  'visual.fullPage': '전체 페이지 캡처',
  'visual.run': '캡처 + 비교',
  'visual.running': '캡처 중...',
  'visual.diff': 'diff %',
  'visual.diffPx': 'diff pixels',
  'visual.size': '크기',
  'visual.duration': '소요',
  'visual.created': '✓ 새 baseline 저장됨',

  // AI
  'ai.title': 'AI 기반 schema.org JSON-LD 추론',
  'ai.desc':
    'URL 본문을 LLM 에 보내 Article/Product/FAQPage/HowTo 등 적합한 schema.org 마크업을 자동 추론. 시작 시 setAiSchemaAdapter() 로 어댑터를 주입하세요.',
  'ai.run': '추론 실행',
  'ai.running': '추론 중...',
  'ai.setup': '어댑터 빠른 설정',
  'ai.empty': '추론된 schema 가 없습니다. 본문이 짧거나 타입이 불명확할 수 있습니다.',

  // Audit
  'audit.title': '감사 로그 (HMAC chain)',
  'audit.desc':
    '모든 admin 액션은 SHA-256 hash chain + 옵션 HMAC 서명으로 기록됩니다. verifyAuditChain() 으로 변조 즉시 검출.',
  'audit.refresh': '새로고침',
  'audit.verify': '체인 검증',
  'audit.ok': '✓ 무결성 OK',
  'audit.broken': '✗ 변조 감지',
  'audit.empty': '기록된 감사 이벤트가 없습니다.',

  // API
  'api.title': 'API 엔드포인트 레퍼런스',

  // Library
  'library.title': '라이브러리로 사용',

  // Help
  'help.title': '도움말 — 자주 묻는 질문',

  // Tour
  'tour.skip': '건너뛰기',
  'tour.next': '다음 →',
  'tour.start': '시작하기',

  // Cmd palette
  'cmd.placeholder': '탭 검색... (⌘/Ctrl + K)',
  'cmd.empty': '일치하는 탭이 없습니다.',
};

const en: Strings = {
  // Nav
  'nav.welcome': 'Welcome',
  'nav.welcome.sub': 'Gateway overview',
  'nav.dashboard': 'Dashboard',
  'nav.dashboard.sub': 'Current state',
  'nav.routes': 'Routes',
  'nav.routes.sub': 'URL pattern overrides',
  'nav.cache': 'Cache',
  'nav.cache.sub': 'TTL/SWR + invalidation',
  'nav.warm': 'Warm',
  'nav.warm.sub': 'Sitemap pre-cache',
  'nav.test': 'Render Test',
  'nav.test.sub': 'Render a single URL',
  'nav.metrics': 'Metrics',
  'nav.metrics.sub': 'Prometheus viewer',
  'nav.lighthouse': 'Lighthouse',
  'nav.lighthouse.sub': 'Page scoring',
  'nav.visual': 'Visual Diff',
  'nav.visual.sub': 'Screenshot regression',
  'nav.ai': 'AI Schema',
  'nav.ai.sub': 'JSON-LD inference',
  'nav.audit': 'Audit Log',
  'nav.audit.sub': 'HMAC chain + tamper check',
  'nav.api': 'API',
  'nav.api.sub': 'Endpoint reference',
  'nav.library': 'Library',
  'nav.library.sub': 'npm package usage',
  'nav.help': 'Help',
  'nav.help.sub': 'FAQ · troubleshooting',

  // Auth
  'auth.login': 'Login',
  'auth.logout': 'logout',
  'auth.token-placeholder': 'X-Admin-Token',
  'auth.authenticated': 'Authenticated',
  'auth.unauthenticated': 'Not signed in',
  'auth.required': 'Authentication required. Enter the admin token in the top bar to sign in.',

  // Theme / lang
  'theme.dark': 'Dark mode',
  'theme.light': 'Light mode',

  // Common buttons
  'btn.save-memory': 'Save (memory)',
  'btn.save-disk': 'Save + persist',
  'btn.add': '+ Add',
  'btn.delete': 'Delete',
  'btn.run': 'Run',
  'btn.refresh': 'Refresh',
  'btn.start': 'Start',
  'btn.running': 'Running...',
  'btn.invalidate': 'Invalidate URL',
  'btn.clear-all': 'Clear all',
  'btn.measure': 'Measure',
  'btn.cancel': 'Cancel',
  'btn.close': 'Close',

  mode: 'mode',
  origin: 'Origin',
  uptime: 'Uptime',
  node: 'Node',
  url: 'URL',

  // Welcome
  'welcome.headline': 'SPA SEO Gateway',
  'welcome.intro':
    'React/Vue/Svelte SPAs delivered to bots as fully-rendered HTML on demand, while humans see the original SPA. Caching and SWR are bonus optimizations — the core is on-request real-time rendering.',
  'welcome.cards.bot': 'Bots get rendered HTML at request time',
  'welcome.cards.bot.body':
    'Identify bots via isbot (1,000+ UA patterns), then run the SPA in headless Chromium so data fetches / state / DOM all complete before the response.',
  'welcome.cards.cache': 'Cache + SWR',
  'welcome.cards.cache.body':
    '2-tier (memory LRU + Redis), Brotli, stale-while-revalidate. Most bot traffic is a 5ms cache hit.',
  'welcome.cards.shield': 'Defenses',
  'welcome.cards.shield.body':
    'SSRF DNS guard, per-host circuit breaker, automatic soft-404 detection, browser auto-restart, rate limit, host allow-list.',
  'welcome.quickstart': 'Quick start',

  // Dashboard
  'dashboard.empty': 'Not authenticated yet, or no data.',

  // Routes
  'routes.title': 'Route Overrides',
  'routes.intro': 'Drag to reorder, save with ⌘/Ctrl + S. First match wins (top to bottom).',
  'routes.filter.placeholder': 'Filter by pattern / selector...',
  'routes.empty': 'No routes defined yet. Click [+ Add] to create one.',
  'routes.col.pattern': 'Pattern (regex)',
  'routes.col.ttl': 'TTL (ms)',
  'routes.col.waitUntil': 'waitUntil',
  'routes.col.waitSelector': 'waitSelector',
  'routes.col.waitMs': 'waitMs',
  'routes.col.ignore': 'ignore',

  // Cache
  'cache.title': 'Cache Management',
  'cache.invalidate.label': 'Invalidate single URL',
  'cache.clear.label': 'Clear all caches',
  'cache.clear.confirm': 'Clear all caches? Subsequent requests will start cold.',
  'cache.cleared': 'All caches cleared',

  // Warm
  'warm.title': 'Pre-warm (sitemap)',
  'warm.sitemap.label': 'Sitemap URL',
  'warm.max.label': 'Max URLs',
  'warm.concurrency.label': 'Concurrency',
  'warm.run': 'Start warming',

  // Render test
  'test.title': 'Single URL render test',
  'test.url.label': 'URL',
  'test.ua.label': 'User-Agent (optional, default Googlebot)',
  'test.run': 'Run render',
  'test.preview': 'Body preview (first 4000 chars)',

  // Metrics
  'metrics.title': 'Live metrics',
  'metrics.autoRefresh': 'Auto-refresh 5s',
  'metrics.lastUpdated': 'Last updated',
  'metrics.empty': 'No metrics yet. Run a render or send some traffic.',

  // Lighthouse
  'lighthouse.title': 'Lighthouse scores',
  'lighthouse.url.label': 'Target URL',
  'lighthouse.run': 'Measure',
  'lighthouse.cached': '(cached)',
  'lighthouse.scores.performance': 'Performance',
  'lighthouse.scores.accessibility': 'Accessibility',
  'lighthouse.scores.seo': 'SEO',
  'lighthouse.scores.bestPractices': 'Best Practices',

  // Visual
  'visual.title': 'Visual Regression',
  'visual.desc':
    'Capture a screenshot, diff against the local baseline. First run saves the baseline; later runs measure pixel-level differences.',
  'visual.url': 'URL',
  'visual.mode': 'Mode',
  'visual.mode.auto': 'auto — save baseline if missing',
  'visual.mode.create': 'create — force new baseline',
  'visual.mode.compare': 'compare — comparison only',
  'visual.threshold': 'threshold (0~1)',
  'visual.fullPage': 'Full page',
  'visual.run': 'Capture + compare',
  'visual.running': 'Capturing...',
  'visual.diff': 'diff %',
  'visual.diffPx': 'diff pixels',
  'visual.size': 'size',
  'visual.duration': 'duration',
  'visual.created': '✓ new baseline saved',

  // AI
  'ai.title': 'AI-driven schema.org JSON-LD inference',
  'ai.desc':
    'Send page content to an LLM, get back schema.org markup. Inject the adapter at startup with setAiSchemaAdapter().',
  'ai.run': 'Run inference',
  'ai.running': 'Inferring...',
  'ai.setup': 'Adapter quick setup',
  'ai.empty': 'No suggestions returned — content may be sparse or type unclear.',

  // Audit
  'audit.title': 'Audit Log (HMAC chain)',
  'audit.desc':
    'Every admin action is recorded with a SHA-256 hash chain + optional HMAC signature. verifyAuditChain() detects tampering instantly.',
  'audit.refresh': 'Refresh',
  'audit.verify': 'Verify chain',
  'audit.ok': '✓ integrity OK',
  'audit.broken': '✗ tampering detected',
  'audit.empty': 'No audit events recorded yet.',

  // API
  'api.title': 'API endpoint reference',

  // Library
  'library.title': 'Use as a library',

  // Help
  'help.title': 'Help — frequently asked questions',

  // Tour
  'tour.skip': 'Skip',
  'tour.next': 'Next →',
  'tour.start': 'Get started',

  // Cmd palette
  'cmd.placeholder': 'Search tabs... (⌘/Ctrl + K)',
  'cmd.empty': 'No matching tabs.',
};

const dicts: Record<Lang, Strings> = { ko, en };

export function translate(lang: Lang, key: string, fallback?: string): string {
  return dicts[lang]?.[key] ?? dicts.ko[key] ?? fallback ?? key;
}
