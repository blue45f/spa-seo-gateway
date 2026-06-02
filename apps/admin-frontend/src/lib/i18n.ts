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
  'nav.sites': '사이트 관리',
  'nav.sites.sub': 'CMS · 다중 사이트',
  'nav.tenants': '테넌트 관리',
  'nav.tenants.sub': 'SaaS · 다중 고객',
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
  'auth.disabled': 'admin 비활성화됨. 환경변수 ADMIN_TOKEN 을 설정하고 게이트웨이를 재시작하세요.',

  // Toast
  'toast.site.saved': '사이트 저장됨',
  'toast.site.deleted': '사이트 삭제됨',
  'toast.tenant.saved': '테넌트 저장됨',
  'toast.tenant.deleted': '테넌트 삭제됨',
  'toast.url.invalidated': 'URL 무효화 완료',
  'toast.warm.done': '워밍 완료',
  'toast.clipboard.denied': 'clipboard 접근 거부됨',
  'toast.visual.failed': '시각 회귀 실패',
  'toast.ai.suggestions': 'schema 제안',
  'toast.ai.failed': 'AI schema 추론 실패. 어댑터 설정을 확인하세요.',
  'toast.apikey.changed': 'API key 변경됨. 저장 버튼을 눌러야 적용됩니다.',
  'toast.routes.reordered': '라우트 순서 변경',

  // Theme / lang
  'theme.dark': '다크 모드',
  'theme.light': '라이트 모드',
  'theme.system': '시스템 테마',
  'density.comfortable': '보통 간격',
  'density.compact': '좁은 간격',

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
  'welcome.origin.unset': '(미설정)',
  'welcome.qs1':
    '좌측 메뉴에서 원하는 작업을 선택. 인증이 필요한 페이지는 우측 상단에 토큰 입력 박스가 표시됩니다.',
  'welcome.qs2': ' 에서 URL 한 개를 즉시 렌더해 동작 확인.',
  'welcome.qs3': ' 에서 URL 패턴별 캐시 TTL / waitUntil / ignore 정의.',
  'welcome.qs4': ' 으로 sitemap 으로부터 미리 캐시 채우기.',
  'welcome.qs5': ' 에서 실시간 처리량 / 지연 / 에러 모니터링.',
  'welcome.architecture': '아키텍처 한눈에',
  'welcome.resources': '리소스',
  'welcome.links.gettingStarted': '설치 가이드',
  'welcome.links.configuration': '전체 설정 레퍼런스',
  'welcome.links.multiTenant': 'SaaS 모드 (다중 테넌트)',
  'welcome.links.cmsMode': 'CMS 모드 (다중 사이트)',
  'welcome.links.deployment': '배포 가이드 (Docker/K8s/CDN)',
  'welcome.links.architecture': '아키텍처',

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
  'lighthouse.cached': '캐시된 결과',
  'lighthouse.band.good': '양호',
  'lighthouse.band.needs': '개선 필요',
  'lighthouse.band.poor': '미흡',
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
  'visual.mode.auto': 'auto: 없으면 baseline 저장',
  'visual.mode.create': 'create: 새 baseline 강제 저장',
  'visual.mode.compare': 'compare: 비교만',
  'visual.threshold': 'threshold (0~1)',
  'visual.fullPage': '전체 페이지 캡처',
  'visual.run': '캡처 + 비교',
  'visual.running': '캡처 중...',
  'visual.diff': 'diff %',
  'visual.diffPx': 'diff pixels',
  'visual.size': '크기',
  'visual.duration': '소요',
  'visual.created': '새 baseline 저장됨',

  // AI
  'ai.title': 'AI 기반 schema.org JSON-LD 추론',
  'ai.desc':
    'URL 본문을 LLM 에 보내 Article/Product/FAQPage/HowTo 등 적합한 schema.org 마크업을 자동 추론. 시작 시 setAiSchemaAdapter() 로 어댑터를 주입하세요.',
  'ai.run': '추론 실행',
  'ai.running': '추론 중...',
  'ai.setup': '어댑터 빠른 설정',
  'ai.empty': '추론된 schema 가 없습니다. 본문이 짧거나 타입이 불명확할 수 있습니다.',
  'ai.empty.hint':
    '본문이 짧거나 타입이 불명확하면 제안이 없을 수 있습니다. 더 본문이 풍부한 페이지 URL 을 입력해 보세요.',

  // Audit
  'audit.title': '감사 로그 (HMAC chain)',
  'audit.desc':
    '모든 admin 액션은 SHA-256 hash chain + 옵션 HMAC 서명으로 기록됩니다. verifyAuditChain() 으로 변조 즉시 검출.',
  'audit.refresh': '새로고침',
  'audit.verify': '체인 검증',
  'audit.ok': '무결성 OK',
  'audit.broken': '변조 감지',
  'audit.empty': '기록된 감사 이벤트가 없습니다.',

  // API
  'api.title': 'API 엔드포인트 레퍼런스',
  'api.mode': '모드',
  'api.intro': '모드별 추가 엔드포인트가 자동으로 노출됩니다.',
  'api.desc.health': 'Liveness: 풀/캐시/breaker 상태 JSON',
  'api.desc.healthDeep': 'Deep readiness: 실제 1회 렌더 후 OK (수초 소요)',
  'api.desc.metrics': 'Prometheus exposition (시각화는 Metrics 탭)',
  'api.desc.publicInfo': '비민감 게이트웨이 정보 (모드, origin, uptime). Welcome 페이지에서 사용',
  'api.desc.site': '게이트웨이 종합 상태 (대시보드 데이터 소스)',
  'api.desc.routesGet': '현재 라우트 오버라이드 목록',
  'api.desc.routesPut': '라우트 일괄 교체. persist:true 면 디스크 영구화',
  'api.desc.cacheInvalidate': 'URL 한 개 무효화',
  'api.desc.cacheClear': '전체 캐시 초기화',
  'api.desc.warm': 'Sitemap 기반 사전 워밍',
  'api.desc.renderTest': '단일 URL 즉시 렌더 테스트 (캐시 우회)',
  'api.desc.audit': '최근 200건 감사 이벤트 (HMAC chain)',
  'api.desc.auditVerify': '감사 체인 무결성 검증. 변조 시 brokenAt 인덱스 반환',
  'api.desc.visualDiff': 'URL 스크린샷 → baseline 비교 (pixelmatch)',
  'api.desc.aiSchema': 'AI 어댑터로 schema.org JSON-LD 추론',
  'api.desc.lighthouse': 'Lighthouse 점수 측정 (peer dep 필요)',
  'api.desc.cmsSitesGet': '[CMS] 사이트 목록',
  'api.desc.cmsSitesPost': '[CMS] 사이트 추가/갱신',
  'api.desc.cmsSitesDelete': '[CMS] 사이트 삭제',
  'api.desc.cmsSiteInvalidate': '[CMS] 사이트별 URL 무효화',
  'api.desc.cmsSiteWarm': '[CMS] 사이트별 sitemap 워밍',
  'api.desc.cmsStats': '[CMS] 사이트 카운트 + 캐시 상태',
  'api.desc.saasTenantsGet': '[SaaS] 테넌트 목록',
  'api.desc.saasTenantsPost': '[SaaS] 테넌트 추가/갱신',
  'api.desc.saasTenantsDelete': '[SaaS] 테넌트 삭제',
  'api.desc.saasSelfInvalidate': '[SaaS] 테넌트가 자기 캐시 무효화 (apiKey 인증)',
  'api.desc.saasStats': '[SaaS] 테넌트 통계',

  // Library
  'library.title': '라이브러리로 사용',
  'library.intro.title': 'npm 라이브러리로 사용',
  'library.intro.body.pre':
    '외부 Fastify 앱에 admin UI / 코어 엔진을 직접 임베드. 6가지 시나리오는 ',
  'library.intro.body.post': ' 참고.',
  'library.install': '설치',
  'library.s1': '시나리오 1: 새 Fastify 앱에 통째로 끼우기',
  'library.s2': '시나리오 2: AI Schema 어댑터 주입',
  'library.s2.note.pre': 'OpenAI / Groq / Ollama 도 동일한 인터페이스로 ',
  'library.s2.note.post': ' 패키지에서 제공.',
  'library.s3': '시나리오 3: A/B variant 설정',
  'library.s3.note.pre': '응답 헤더 ',
  'library.s3.note.mid': ' + Prometheus ',
  'library.s3.note.post': ' 으로 인상 추적.',
  'library.s4': '시나리오 4: Visual regression CI',
  'library.s5': '시나리오 5: Audit chain 변조 감지',

  // Sites (CMS)
  'sites.title': '사이트 관리: CMS 모드',
  'sites.intro':
    '한 게이트웨이에서 여러 사이트를 host 헤더로 분기. 각 사이트는 자기 origin / routes / 캐시 네임스페이스를 갖는다.',
  'sites.add': '+ 새 사이트',
  'sites.edit': '편집',
  'sites.delete': '삭제',
  'sites.invalidate': 'URL 무효화',
  'sites.warm': 'Sitemap 워밍',
  'sites.empty': '아직 등록된 사이트가 없습니다. 우측 상단 [+ 새 사이트] 로 추가.',
  'sites.col.id': 'ID',
  'sites.col.name': '이름',
  'sites.col.origin': 'Origin',
  'sites.col.routes': 'routes',
  'sites.col.enabled': '활성',
  'sites.col.actions': '작업',
  'sites.form.id': 'ID (소문자/숫자/-/_)',
  'sites.form.name': '표시 이름',
  'sites.form.origin': 'Origin URL (https://...)',
  'sites.form.enabled': '활성화',
  'sites.form.webhookRender': 'Webhook on render (선택)',
  'sites.form.webhookError': 'Webhook on error (선택)',
  'sites.form.save': '저장',
  'sites.delete.confirm': '정말 사이트를 삭제할까요? 영구적이며 캐시도 함께 정리됩니다.',
  'sites.invalidate.prompt': '무효화할 URL 을 입력하세요',
  'sites.detail.metadata': '메타데이터',
  'sites.detail.routes': '라우트 오버라이드 (사이트별)',
  'sites.detail.notFound': '존재하지 않는 사이트입니다.',
  'sites.detail.back': '← 목록으로',

  // Tenants (SaaS)
  'tenants.title': '테넌트 관리: SaaS 모드',
  'tenants.intro': '외부 고객별 격리된 컨텍스트. apiKey 또는 host 로 식별하며 plan 별 한도를 적용.',
  'tenants.add': '+ 새 테넌트',
  'tenants.edit': '편집',
  'tenants.delete': '삭제',
  'tenants.empty': '아직 등록된 테넌트가 없습니다.',
  'tenants.col.id': 'ID',
  'tenants.col.name': '이름',
  'tenants.col.origin': 'Origin',
  'tenants.col.plan': 'Plan',
  'tenants.col.apikey': 'API Key',
  'tenants.col.enabled': '활성',
  'tenants.col.actions': '작업',
  'tenants.form.id': 'ID (소문자/숫자/-/_)',
  'tenants.form.name': '표시 이름',
  'tenants.form.origin': 'Origin URL (https://...)',
  'tenants.form.apikey': 'API Key (20자 이상)',
  'tenants.form.apikey.gen': '생성',
  'tenants.form.plan': 'Plan',
  'tenants.form.enabled': '활성화',
  'tenants.form.save': '저장',
  'tenants.delete.confirm': '정말 테넌트를 삭제할까요? 영구적이며 캐시도 함께 정리됩니다.',
  'tenants.copy': '복사',
  'tenants.copied': '클립보드에 복사됨',
  'tenants.detail.metadata': '메타데이터',
  'tenants.detail.routes': '라우트 오버라이드 (테넌트별)',
  'tenants.detail.notFound': '존재하지 않는 테넌트입니다.',
  'tenants.detail.back': '← 목록으로',
  'tenants.detail.rotate': 'API key 회전',
  'tenants.detail.rotate.confirm': 'API key 를 새로 발급할까요? 이전 키는 즉시 무효화됩니다.',

  // Help
  'help.title': '도움말: 자주 묻는 질문',
  'help.intro': '처음 접하는 분들이 흔히 만나는 상황과 해결법.',
  'help.guides': '더 자세한 가이드',
  'help.faq.q1': '어드민 UI 가 401 / 404 만 띄워요',
  'help.faq.a1':
    'ADMIN_TOKEN 환경변수를 설정하고 게이트웨이를 재시작하세요. 그 후 우측 상단의 입력 박스에 토큰을 넣고 [로그인].',
  'help.faq.q2': '봇 요청은 잘 되는데 사람은 모두 204 만 받아요',
  'help.faq.a2':
    'render-only 모드는 봇만 렌더, 사람에겐 204 만 반환합니다. CDN/리버스프록시에서 봇 분기 후 게이트웨이로 보내야 합니다. 자체 프록시를 원하면 GATEWAY_MODE=proxy + ORIGIN_URL 설정.',
  'help.faq.q3': 'soft 404 가 잘못 트리거 돼요 (정상 페이지인데 404로 캐싱됨)',
  'help.faq.a3':
    'QUALITY_CHECK=false 로 quality gate 를 끄거나 MIN_TEXT_LENGTH 를 낮춰보세요. 보다 정밀한 제어는 라우트 페이지에서 해당 URL 패턴에 ttlMs 를 명시적으로 지정.',
  'help.faq.q4': '풀이 가득 차서 요청이 큐잉돼요',
  'help.faq.a4':
    'POOL_MAX 를 늘리거나 (기본 8 → 16~32), 캐시 TTL 을 늘려 cold render 빈도를 줄이세요. 워밍 탭에서 sitemap 으로 미리 채우는 것도 효과적.',
  'help.faq.q5': 'Redis 연결 에러 로그가 떠요',
  'help.faq.a5':
    'REDIS_CACHE_ENABLED=true 인데 REDIS_URL 이 잘못되었거나 Redis 가 다운된 상태. 게이트웨이는 자동으로 메모리 캐시로 강등되어 동작은 계속합니다.',
  'help.faq.q6': '특정 페이지에 라우트 오버라이드가 적용 안 돼요',
  'help.faq.a6':
    '라우트 탭의 정규식이 URL 의 pathname + search 와 매칭되는지 확인. 위에서 아래로 첫 매칭이 승리하니 더 구체적인 패턴을 위로 두세요.',
  'help.faq.q7': 'CMS / SaaS 모드에서 어떻게 사이트/테넌트를 추가하나요',
  'help.faq.a7':
    'API 탭의 /admin/api/sites 또는 /admin/api/tenants POST 항목 참고. 자세한 가이드는 docs/CMS-MODE.md / docs/MULTI-TENANT.md.',
  'help.faq.q8': '메트릭 페이지가 비어있어요',
  'help.faq.a8':
    '아직 처리한 요청이 없으면 메트릭이 모이지 않습니다. 렌더 테스트에서 한두 개 렌더해 본 뒤 다시 보세요.',
  'help.faq.q9': 'Visual diff baseline 을 어떻게 갱신하나요?',
  'help.faq.a9':
    'mode 를 "create" 로 두고 한 번 캡처하면 새 baseline 으로 덮어쓰기. CI 에선 PR 머지 후에만 갱신을 권장.',
  'help.faq.q10': 'AI Schema 가 501 응답을 줍니다',
  'help.faq.a10':
    'setAiSchemaAdapter() 로 어댑터를 주입하지 않은 상태입니다. @heejun/spa-seo-gateway-anthropic 또는 -openai 패키지를 시작 코드에서 등록하세요.',
  'help.links.gettingStarted': '5분 시작 가이드',
  'help.links.configuration': '전체 설정 레퍼런스',
  'help.links.deployment': '배포 (Docker / K8s / CDN)',
  'help.links.multiTenant': 'SaaS 모드 (다중 테넌트)',
  'help.links.cmsMode': 'CMS 모드 (다중 사이트)',
  'help.links.architecture': '내부 아키텍처',
  'help.links.concurrency': '동시성 모델',
  'help.links.benchmarks': '벤치마크 시나리오',
  'help.links.migration': 'v1.5 → v1.7 마이그레이션',

  // Page bodies
  'dashboard.title': '현재 게이트웨이 상태',
  'dashboard.empty.hint':
    '게이트웨이가 시작되면 mode · routes · cache 와 호스트별 서킷 브레이커 상태가 여기 표시됩니다.',
  'dashboard.origin.unset': '(origin 미설정)',
  'dashboard.routes.detail': '런타임 활성',
  'dashboard.breakers.title': 'Circuit breakers (호스트별)',
  'dashboard.breakers.empty.title': '아직 추적된 호스트가 없습니다',
  'dashboard.breakers.empty.hint':
    '봇 요청이 오리진 호스트로 라우팅되면 실패율 기반 상태(closed · half-open · open)가 집계됩니다.',
  'sites.empty.hint': '사이트를 추가하면 host별 origin · routes · 캐시 설정을 관리할 수 있습니다.',
  'tenants.empty.hint':
    '테넌트를 추가하면 apiKey · host 로 식별되는 고객별 origin · routes 설정을 관리할 수 있습니다.',
  'audit.empty.hint': '설정 변경 · 캐시 무효화 같은 관리자 작업이 발생하면 여기에 기록됩니다.',
  'cache.clear.desc': '배포 후 또는 대규모 데이터 변경 시 사용. 다음 요청부터는 cold render.',
  'lighthouse.peerDep.pre': 'peer-installed ',
  'lighthouse.peerDep.mid': ' + ',
  'lighthouse.peerDep.post': ' 가 필요합니다.',
  'ai.providers': 'OpenAI / Groq / Ollama (호환 엔드포인트)',
  'routes.persist.title': 'seo-gateway.config.json 에 영구 저장',
  'metrics.inflight.detail': '현재 렌더 중',
  'metrics.histogram.title': '렌더 지연 히스토그램 (per outcome/host)',
  'metrics.errors.title': '에러 분류',
  'metrics.raw.summary': '/metrics 원본 (Prometheus exposition)',
  'warm.intro':
    'sitemap.xml URL 입력 → 재귀 sitemap-index 파싱 + 동시 N개 워밍. cold start 제거에 효과적.',
  'warm.result': '결과',
  'test.responseHeaders': '응답 헤더',
  'shortcuts.title': '키보드 단축키',
  'a11y.skipToContent': '메인 콘텐츠로 건너뛰기',

  // Tour
  'tour.skip': '건너뛰기',
  'tour.next': '다음 →',
  'tour.start': '시작하기',

  // Cmd palette
  'cmd.placeholder': '탭 검색... (⌘/Ctrl + K)',
  'cmd.empty': '일치하는 탭이 없습니다.',

  // Not found
  'notFound.title': '페이지를 찾을 수 없습니다',
  'notFound.hint': '주소가 바뀌었거나 삭제된 페이지일 수 있어요. 사이드바에서 다시 찾아보세요.',
  'notFound.home': '홈으로',
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
  'nav.sites': 'Sites',
  'nav.sites.sub': 'CMS · multi-site',
  'nav.tenants': 'Tenants',
  'nav.tenants.sub': 'SaaS · multi-customer',
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
  'auth.disabled': 'Admin disabled. Set the ADMIN_TOKEN env var and restart the gateway.',

  // Toast
  'toast.site.saved': 'Site saved',
  'toast.site.deleted': 'Site deleted',
  'toast.tenant.saved': 'Tenant saved',
  'toast.tenant.deleted': 'Tenant deleted',
  'toast.url.invalidated': 'URL invalidated',
  'toast.warm.done': 'Warming done',
  'toast.clipboard.denied': 'Clipboard access denied',
  'toast.visual.failed': 'Visual regression failed',
  'toast.ai.suggestions': 'schema suggestions',
  'toast.ai.failed': 'AI schema inference failed. Check the adapter setup.',
  'toast.apikey.changed': 'API key changed. Click Save to apply.',
  'toast.routes.reordered': 'Route reordered',

  // Theme / lang
  'theme.dark': 'Dark mode',
  'theme.light': 'Light mode',
  'theme.system': 'System theme',
  'density.comfortable': 'Comfortable',
  'density.compact': 'Compact',

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
    'React/Vue/Svelte SPAs delivered to bots as fully-rendered HTML on demand, while humans see the original SPA. Caching and SWR are bonus optimizations. The core is on-request real-time rendering.',
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
  'welcome.origin.unset': '(unset)',
  'welcome.qs1':
    'Pick a task from the left nav. Pages that need auth show a token box in the top bar.',
  'welcome.qs2': ': render a single URL to verify it works.',
  'welcome.qs3': ': define cache TTL / waitUntil / ignore per URL pattern.',
  'welcome.qs4': ': pre-fill the cache from a sitemap.',
  'welcome.qs5': ': monitor live throughput, latency, and errors.',
  'welcome.architecture': 'Architecture at a glance',
  'welcome.resources': 'Resources',
  'welcome.links.gettingStarted': 'Getting started',
  'welcome.links.configuration': 'Full configuration reference',
  'welcome.links.multiTenant': 'SaaS mode (multi-tenant)',
  'welcome.links.cmsMode': 'CMS mode (multi-site)',
  'welcome.links.deployment': 'Deployment (Docker/K8s/CDN)',
  'welcome.links.architecture': 'Architecture',

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
  'lighthouse.cached': 'cached',
  'lighthouse.band.good': 'good',
  'lighthouse.band.needs': 'needs improvement',
  'lighthouse.band.poor': 'poor',
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
  'visual.mode.auto': 'auto: save baseline if missing',
  'visual.mode.create': 'create: force new baseline',
  'visual.mode.compare': 'compare: comparison only',
  'visual.threshold': 'threshold (0~1)',
  'visual.fullPage': 'Full page',
  'visual.run': 'Capture + compare',
  'visual.running': 'Capturing...',
  'visual.diff': 'diff %',
  'visual.diffPx': 'diff pixels',
  'visual.size': 'size',
  'visual.duration': 'duration',
  'visual.created': 'new baseline saved',

  // AI
  'ai.title': 'AI-driven schema.org JSON-LD inference',
  'ai.desc':
    'Send page content to an LLM, get back schema.org markup. Inject the adapter at startup with setAiSchemaAdapter().',
  'ai.run': 'Run inference',
  'ai.running': 'Inferring...',
  'ai.setup': 'Adapter quick setup',
  'ai.empty': 'No suggestions returned. Content may be sparse or type unclear.',
  'ai.empty.hint':
    'Sparse content or an unclear type can yield no suggestions. Try a URL with richer body content.',

  // Audit
  'audit.title': 'Audit Log (HMAC chain)',
  'audit.desc':
    'Every admin action is recorded with a SHA-256 hash chain + optional HMAC signature. verifyAuditChain() detects tampering instantly.',
  'audit.refresh': 'Refresh',
  'audit.verify': 'Verify chain',
  'audit.ok': 'integrity OK',
  'audit.broken': 'tampering detected',
  'audit.empty': 'No audit events recorded yet.',

  // API
  'api.title': 'API endpoint reference',
  'api.mode': 'Mode',
  'api.intro': 'Mode-specific endpoints appear automatically.',
  'api.desc.health': 'Liveness: pool / cache / breaker status as JSON',
  'api.desc.healthDeep': 'Deep readiness: one real render before OK (takes a few seconds)',
  'api.desc.metrics': 'Prometheus exposition (visualized in the Metrics tab)',
  'api.desc.publicInfo':
    'Non-sensitive gateway info (mode, origin, uptime). Used by the Welcome page.',
  'api.desc.site': 'Aggregate gateway status (the dashboard data source).',
  'api.desc.routesGet': 'Current route override list.',
  'api.desc.routesPut': 'Replace all routes. persist:true persists to disk.',
  'api.desc.cacheInvalidate': 'Invalidate a single URL.',
  'api.desc.cacheClear': 'Clear the entire cache.',
  'api.desc.warm': 'Sitemap-based pre-warming.',
  'api.desc.renderTest': 'Render a single URL immediately, bypassing the cache.',
  'api.desc.audit': 'The last 200 audit events (HMAC chain).',
  'api.desc.auditVerify': 'Verify audit-chain integrity; returns a brokenAt index on tampering.',
  'api.desc.visualDiff': 'Screenshot a URL and compare against the baseline (pixelmatch).',
  'api.desc.aiSchema': 'Infer schema.org JSON-LD via the AI adapter.',
  'api.desc.lighthouse': 'Measure Lighthouse scores (requires the peer dep).',
  'api.desc.cmsSitesGet': '[CMS] List sites.',
  'api.desc.cmsSitesPost': '[CMS] Add or update a site.',
  'api.desc.cmsSitesDelete': '[CMS] Delete a site.',
  'api.desc.cmsSiteInvalidate': '[CMS] Invalidate a URL for a site.',
  'api.desc.cmsSiteWarm': '[CMS] Warm a site from its sitemap.',
  'api.desc.cmsStats': '[CMS] Site count + cache status.',
  'api.desc.saasTenantsGet': '[SaaS] List tenants.',
  'api.desc.saasTenantsPost': '[SaaS] Add or update a tenant.',
  'api.desc.saasTenantsDelete': '[SaaS] Delete a tenant.',
  'api.desc.saasSelfInvalidate': '[SaaS] A tenant invalidates its own cache (apiKey auth).',
  'api.desc.saasStats': '[SaaS] Tenant statistics.',

  // Library
  'library.title': 'Use as a library',
  'library.intro.title': 'Use as an npm library',
  'library.intro.body.pre':
    'Embed the admin UI / core engine directly in an external Fastify app. The 6 scenarios are in ',
  'library.intro.body.post': '.',
  'library.install': 'Install',
  'library.s1': 'Scenario 1: drop into a fresh Fastify app',
  'library.s2': 'Scenario 2: inject an AI Schema adapter',
  'library.s2.note.pre': 'OpenAI / Groq / Ollama use the same interface via the ',
  'library.s2.note.post': ' package.',
  'library.s3': 'Scenario 3: A/B variant setup',
  'library.s3.note.pre': 'Response header ',
  'library.s3.note.mid': ' + Prometheus ',
  'library.s3.note.post': ' tracks impressions.',
  'library.s4': 'Scenario 4: visual regression CI',
  'library.s5': 'Scenario 5: detect audit-chain tampering',

  // Sites (CMS)
  'sites.title': 'Sites: CMS mode',
  'sites.intro':
    'One gateway, many sites, routed by Host header. Each site has its own origin, routes, and cache namespace.',
  'sites.add': '+ New site',
  'sites.edit': 'Edit',
  'sites.delete': 'Delete',
  'sites.invalidate': 'Invalidate URL',
  'sites.warm': 'Warm sitemap',
  'sites.empty': 'No sites yet. Click [+ New site] to add one.',
  'sites.col.id': 'ID',
  'sites.col.name': 'Name',
  'sites.col.origin': 'Origin',
  'sites.col.routes': 'routes',
  'sites.col.enabled': 'Enabled',
  'sites.col.actions': 'Actions',
  'sites.form.id': 'ID (lowercase / digits / -/_)',
  'sites.form.name': 'Display name',
  'sites.form.origin': 'Origin URL (https://...)',
  'sites.form.enabled': 'Enabled',
  'sites.form.webhookRender': 'Webhook on render (optional)',
  'sites.form.webhookError': 'Webhook on error (optional)',
  'sites.form.save': 'Save',
  'sites.delete.confirm':
    'Delete this site? The action is permanent and clears its cache namespace.',
  'sites.invalidate.prompt': 'URL to invalidate',
  'sites.detail.metadata': 'Metadata',
  'sites.detail.routes': 'Route overrides (per-site)',
  'sites.detail.notFound': 'Site not found.',
  'sites.detail.back': '← Back to list',

  // Tenants (SaaS)
  'tenants.title': 'Tenants: SaaS mode',
  'tenants.intro':
    'Isolated contexts per external customer. Identified by apiKey or host; per-plan quotas.',
  'tenants.add': '+ New tenant',
  'tenants.edit': 'Edit',
  'tenants.delete': 'Delete',
  'tenants.empty': 'No tenants yet.',
  'tenants.col.id': 'ID',
  'tenants.col.name': 'Name',
  'tenants.col.origin': 'Origin',
  'tenants.col.plan': 'Plan',
  'tenants.col.apikey': 'API Key',
  'tenants.col.enabled': 'Enabled',
  'tenants.col.actions': 'Actions',
  'tenants.form.id': 'ID (lowercase / digits / -/_)',
  'tenants.form.name': 'Display name',
  'tenants.form.origin': 'Origin URL (https://...)',
  'tenants.form.apikey': 'API Key (20+ chars)',
  'tenants.form.apikey.gen': 'Generate',
  'tenants.form.plan': 'Plan',
  'tenants.form.enabled': 'Enabled',
  'tenants.form.save': 'Save',
  'tenants.delete.confirm':
    'Delete this tenant? The action is permanent and clears its cache namespace.',
  'tenants.copy': 'Copy',
  'tenants.copied': 'Copied to clipboard',
  'tenants.detail.metadata': 'Metadata',
  'tenants.detail.routes': 'Route overrides (per-tenant)',
  'tenants.detail.notFound': 'Tenant not found.',
  'tenants.detail.back': '← Back to list',
  'tenants.detail.rotate': 'Rotate API key',
  'tenants.detail.rotate.confirm':
    'Issue a new API key? The previous key is invalidated immediately.',

  // Help
  'help.title': 'Help: frequently asked questions',
  'help.intro': 'Common situations new operators run into, and how to resolve them.',
  'help.guides': 'More guides',
  'help.faq.q1': 'The admin UI only shows 401 / 404',
  'help.faq.a1':
    'Set the ADMIN_TOKEN env var and restart the gateway, then enter the token in the top-right box and sign in.',
  'help.faq.q2': 'Bots work but humans all get 204',
  'help.faq.a2':
    'render-only mode renders for bots and returns 204 to humans. Branch bots at your CDN / reverse proxy and forward them to the gateway. For a built-in proxy, set GATEWAY_MODE=proxy + ORIGIN_URL.',
  'help.faq.q3': 'soft 404 triggers incorrectly (a valid page is cached as 404)',
  'help.faq.a3':
    'Turn the quality gate off with QUALITY_CHECK=false, or lower MIN_TEXT_LENGTH. For finer control, set an explicit ttlMs on the URL pattern in the Routes page.',
  'help.faq.q4': 'The pool fills up and requests queue',
  'help.faq.a4':
    'Raise POOL_MAX (default 8, try 16-32) or raise the cache TTL to cut cold renders. Pre-filling from a sitemap in the Warm tab also helps.',
  'help.faq.q5': 'Redis connection errors show in the logs',
  'help.faq.a5':
    'REDIS_CACHE_ENABLED=true but REDIS_URL is wrong or Redis is down. The gateway falls back to the memory cache automatically and keeps running.',
  'help.faq.q6': 'A route override is not applying to a specific page',
  'help.faq.a6':
    'Check that the Routes regex matches the URL pathname + search. First match from top to bottom wins, so put more specific patterns higher.',
  'help.faq.q7': 'How do I add sites / tenants in CMS / SaaS mode?',
  'help.faq.a7':
    'See the /admin/api/sites or /admin/api/tenants POST entries in the API tab. Full guides: docs/CMS-MODE.md / docs/MULTI-TENANT.md.',
  'help.faq.q8': 'The Metrics page is empty',
  'help.faq.a8':
    'Metrics only accumulate once requests have been processed. Render one or two URLs in Render Test, then check again.',
  'help.faq.q9': 'How do I update the Visual diff baseline?',
  'help.faq.a9':
    'Set mode to "create" and capture once to overwrite the baseline. In CI, update only after a PR merges.',
  'help.faq.q10': 'AI Schema returns 501',
  'help.faq.a10':
    'No adapter was injected via setAiSchemaAdapter(). Register the @heejun/spa-seo-gateway-anthropic or -openai package in your startup code.',
  'help.links.gettingStarted': 'Getting started (5 min)',
  'help.links.configuration': 'Full configuration reference',
  'help.links.deployment': 'Deployment (Docker / K8s / CDN)',
  'help.links.multiTenant': 'SaaS mode (multi-tenant)',
  'help.links.cmsMode': 'CMS mode (multi-site)',
  'help.links.architecture': 'Internal architecture',
  'help.links.concurrency': 'Concurrency model',
  'help.links.benchmarks': 'Benchmark scenarios',
  'help.links.migration': 'v1.5 → v1.7 migration',

  // Page bodies
  'dashboard.title': 'Current gateway status',
  'dashboard.empty.hint':
    'Once the gateway starts, mode · routes · cache and per-host circuit-breaker status appear here.',
  'dashboard.origin.unset': '(origin unset)',
  'dashboard.routes.detail': 'active at runtime',
  'dashboard.breakers.title': 'Circuit breakers (per host)',
  'dashboard.breakers.empty.title': 'No hosts tracked yet',
  'dashboard.breakers.empty.hint':
    'Once bot requests route to an origin host, failure-rate states (closed · half-open · open) accumulate here.',
  'sites.empty.hint': 'Add a site to manage per-host origin · routes · cache settings.',
  'tenants.empty.hint':
    'Add a tenant to manage per-customer origin · routes, identified by apiKey · host.',
  'audit.empty.hint': 'Admin actions like config changes · cache invalidations are recorded here.',
  'cache.clear.desc':
    'Use after a deploy or a large data change. The next requests are cold renders.',
  'lighthouse.peerDep.pre': 'peer-installed ',
  'lighthouse.peerDep.mid': ' + ',
  'lighthouse.peerDep.post': ' are required.',
  'ai.providers': 'OpenAI / Groq / Ollama (compatible endpoints)',
  'routes.persist.title': 'Persist to seo-gateway.config.json',
  'metrics.inflight.detail': 'rendering now',
  'metrics.histogram.title': 'Render latency histogram (per outcome/host)',
  'metrics.errors.title': 'Error breakdown',
  'metrics.raw.summary': '/metrics raw (Prometheus exposition)',
  'warm.intro':
    'Enter a sitemap.xml URL: recursive sitemap-index parsing + N concurrent warms. Effective at removing cold starts.',
  'warm.result': 'Result',
  'test.responseHeaders': 'Response headers',
  'shortcuts.title': 'Keyboard shortcuts',
  'a11y.skipToContent': 'Skip to main content',

  // Tour
  'tour.skip': 'Skip',
  'tour.next': 'Next →',
  'tour.start': 'Get started',

  // Cmd palette
  'cmd.placeholder': 'Search tabs... (⌘/Ctrl + K)',
  'cmd.empty': 'No matching tabs.',

  // Not found
  'notFound.title': 'Page not found',
  'notFound.hint': 'The address may have changed or been removed. Try the sidebar.',
  'notFound.home': 'Back to home',
};

const dicts: Record<Lang, Strings> = { ko, en };

export function translate(lang: Lang, key: string, fallback?: string): string {
  return dicts[lang]?.[key] ?? dicts.ko[key] ?? fallback ?? key;
}
