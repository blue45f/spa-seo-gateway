import { useStore } from '../lib/store';

const FAQS = [
  {
    q: '어드민 UI 가 401 / 404 만 띄워요',
    a: 'ADMIN_TOKEN 환경변수를 설정하고 게이트웨이를 재시작하세요. 그 후 우측 상단의 입력 박스에 토큰을 넣고 [로그인].',
  },
  {
    q: '봇 요청은 잘 되는데 사람은 모두 204 만 받아요',
    a: 'render-only 모드는 봇만 렌더, 사람에겐 204 만 반환합니다. CDN/리버스프록시에서 봇 분기 후 게이트웨이로 보내야 합니다. 자체 프록시를 원하면 GATEWAY_MODE=proxy + ORIGIN_URL 설정.',
  },
  {
    q: 'soft 404 가 잘못 트리거 돼요 (정상 페이지인데 404로 캐싱됨)',
    a: 'QUALITY_CHECK=false 로 quality gate 를 끄거나 MIN_TEXT_LENGTH 를 낮춰보세요. 보다 정밀한 제어는 라우트 페이지에서 해당 URL 패턴에 ttlMs 를 명시적으로 지정.',
  },
  {
    q: '풀이 가득 차서 요청이 큐잉돼요',
    a: 'POOL_MAX 를 늘리거나 (기본 8 → 16~32), 캐시 TTL 을 늘려 cold render 빈도를 줄이세요. 워밍 탭에서 sitemap 으로 미리 채우는 것도 효과적.',
  },
  {
    q: 'Redis 연결 에러 로그가 떠요',
    a: 'REDIS_CACHE_ENABLED=true 인데 REDIS_URL 이 잘못되었거나 Redis 가 다운된 상태. 게이트웨이는 자동으로 메모리 캐시로 강등되어 동작은 계속합니다.',
  },
  {
    q: '특정 페이지에 라우트 오버라이드가 적용 안 돼요',
    a: '라우트 탭의 정규식이 URL 의 pathname + search 와 매칭되는지 확인. 위에서 아래로 첫 매칭이 승리합니다 — 더 구체적인 패턴을 위로.',
  },
  {
    q: 'CMS / SaaS 모드에서 어떻게 사이트/테넌트를 추가하나요',
    a: 'API 탭의 /admin/api/sites 또는 /admin/api/tenants POST 항목 참고. 자세한 가이드는 docs/CMS-MODE.md / docs/MULTI-TENANT.md.',
  },
  {
    q: '메트릭 페이지가 비어있어요',
    a: '아직 처리한 요청이 없으면 메트릭이 모이지 않습니다. 렌더 테스트에서 한두 개 렌더해 본 뒤 다시 보세요.',
  },
  {
    q: 'Visual diff baseline 을 어떻게 갱신하나요?',
    a: 'mode 를 "create" 로 두고 한 번 캡처하면 새 baseline 으로 덮어쓰기. CI 에선 PR 머지 후에만 갱신을 권장.',
  },
  {
    q: 'AI Schema 가 501 응답을 줍니다',
    a: 'setAiSchemaAdapter() 로 어댑터를 주입하지 않은 상태입니다. @heejun/spa-seo-gateway-anthropic 또는 -openai 패키지를 시작 코드에서 등록하세요.',
  },
];

export function Help() {
  const t = useStore((s) => s.t);
  return (
    <section className="space-y-4" data-testid="page-help">
      <div className="bg-blue-50 dark:bg-indigo-950 dark:border-indigo-900 border border-blue-200 rounded-lg p-4 text-sm">
        <h3 className="font-semibold text-blue-900 dark:text-indigo-200 mb-1">{t('help.title')}</h3>
        <p className="text-blue-800 dark:text-indigo-300">
          처음 접하는 분들이 흔히 만나는 상황과 해결법.
        </p>
      </div>
      {FAQS.map((f) => (
        <details
          key={f.q}
          className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-4"
        >
          <summary className="cursor-pointer font-semibold">{f.q}</summary>
          <div className="mt-2 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            {f.a}
          </div>
        </details>
      ))}
      <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5 text-sm">
        <h3 className="font-semibold mb-2">더 자세한 가이드</h3>
        <ul className="space-y-1.5">
          <li>
            📚{' '}
            <a
              href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/GETTING-STARTED.md"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:underline"
            >
              5분 시작 가이드
            </a>
          </li>
          <li>
            ⚙️{' '}
            <a
              href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/CONFIGURATION.md"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:underline"
            >
              전체 설정 레퍼런스
            </a>
          </li>
          <li>
            🚀{' '}
            <a
              href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/DEPLOYMENT.md"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:underline"
            >
              배포 (Docker / K8s / CDN)
            </a>
          </li>
          <li>
            🏢{' '}
            <a
              href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/MULTI-TENANT.md"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:underline"
            >
              SaaS 모드 (다중 테넌트)
            </a>
          </li>
          <li>
            🌐{' '}
            <a
              href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/CMS-MODE.md"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:underline"
            >
              CMS 모드 (다중 사이트)
            </a>
          </li>
          <li>
            🏗️{' '}
            <a
              href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/ARCHITECTURE.md"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:underline"
            >
              내부 아키텍처
            </a>
          </li>
          <li>
            ⚡{' '}
            <a
              href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/CONCURRENCY.md"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:underline"
            >
              동시성 모델
            </a>
          </li>
          <li>
            📊{' '}
            <a
              href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/BENCHMARKS.md"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:underline"
            >
              벤치마크 시나리오
            </a>
          </li>
          <li>
            ⬆️{' '}
            <a
              href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/MIGRATION-1.7.md"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:underline"
            >
              v1.5 → v1.7 마이그레이션
            </a>
          </li>
        </ul>
      </div>
    </section>
  );
}
