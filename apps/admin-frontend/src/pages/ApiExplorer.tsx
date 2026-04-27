import { useOutletContext } from 'react-router-dom';
import { methodPillClass } from '../lib/format';
import { useStore } from '../lib/store';
import type { PublicInfo } from '../lib/types';

type Endpoint = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  auth: 'public' | 'admin' | 'apiKey';
  desc: string;
  example: string;
};

const COMMON: Endpoint[] = [
  { method: 'GET', path: '/health', auth: 'public', desc: 'Liveness — 풀/캐시/breaker 상태 JSON', example: 'curl http://localhost:3000/health' },
  { method: 'GET', path: '/health/deep', auth: 'public', desc: 'Deep readiness — 실제 1회 렌더 후 OK. 시간 걸림 (수초)', example: 'curl http://localhost:3000/health/deep' },
  { method: 'GET', path: '/metrics', auth: 'public', desc: 'Prometheus exposition — 시각화는 Metrics 탭', example: 'curl http://localhost:3000/metrics' },
  { method: 'GET', path: '/admin/api/public/info', auth: 'public', desc: '비민감 게이트웨이 정보 (모드, origin, uptime). Welcome 페이지에서 사용', example: 'curl http://localhost:3000/admin/api/public/info' },
  { method: 'GET', path: '/admin/api/site', auth: 'admin', desc: '게이트웨이 종합 상태 (대시보드 데이터 소스)', example: 'curl -H "x-admin-token: $T" http://localhost:3000/admin/api/site' },
  { method: 'GET', path: '/admin/api/routes', auth: 'admin', desc: '현재 라우트 오버라이드 목록', example: 'curl -H "x-admin-token: $T" http://localhost:3000/admin/api/routes' },
  { method: 'PUT', path: '/admin/api/routes', auth: 'admin', desc: '라우트 일괄 교체. persist:true 면 디스크 영구화', example: `curl -X PUT -H "x-admin-token: $T" -H "content-type: application/json" \\\n  -d '{"routes":[{"pattern":"^/blog/","ttlMs":86400000}],"persist":true}' \\\n  http://localhost:3000/admin/api/routes` },
  { method: 'POST', path: '/admin/api/cache/invalidate', auth: 'admin', desc: 'URL 한 개 무효화', example: `curl -X POST -H "x-admin-token: $T" -d '{"url":"https://www.example.com/x"}' http://localhost:3000/admin/api/cache/invalidate` },
  { method: 'POST', path: '/admin/api/cache/clear', auth: 'admin', desc: '전체 캐시 초기화', example: 'curl -X POST -H "x-admin-token: $T" http://localhost:3000/admin/api/cache/clear' },
  { method: 'POST', path: '/admin/api/warm', auth: 'admin', desc: 'Sitemap 기반 사전 워밍', example: `curl -X POST -H "x-admin-token: $T" -d '{"sitemap":"https://www.example.com/sitemap.xml","max":500}' http://localhost:3000/admin/api/warm` },
  { method: 'POST', path: '/admin/api/render-test', auth: 'admin', desc: '단일 URL 즉시 렌더 테스트 (캐시 우회)', example: `curl -X POST -H "x-admin-token: $T" -d '{"url":"https://www.example.com/","ua":"Googlebot/2.1"}' http://localhost:3000/admin/api/render-test` },
  { method: 'GET', path: '/admin/api/audit', auth: 'admin', desc: '최근 200건 감사 이벤트 (HMAC chain)', example: 'curl -H "x-admin-token: $T" http://localhost:3000/admin/api/audit' },
  { method: 'GET', path: '/admin/api/audit/verify', auth: 'admin', desc: '감사 체인 무결성 검증 — 변조 시 brokenAt 인덱스 반환', example: 'curl -H "x-admin-token: $T" http://localhost:3000/admin/api/audit/verify' },
  { method: 'POST', path: '/admin/api/visual-diff', auth: 'admin', desc: 'URL 스크린샷 → baseline 비교 (pixelmatch)', example: `curl -X POST -H "x-admin-token: $T" -d '{"url":"https://www.example.com/","mode":"auto","threshold":0.1}' http://localhost:3000/admin/api/visual-diff` },
  { method: 'POST', path: '/admin/api/ai/schema', auth: 'admin', desc: 'AI 어댑터로 schema.org JSON-LD 추론', example: `curl -X POST -H "x-admin-token: $T" -d '{"url":"https://www.example.com/blog/x"}' http://localhost:3000/admin/api/ai/schema` },
  { method: 'POST', path: '/admin/api/lighthouse', auth: 'admin', desc: 'Lighthouse 점수 측정 (peer dep 필요)', example: `curl -X POST -H "x-admin-token: $T" -d '{"url":"https://www.example.com/"}' http://localhost:3000/admin/api/lighthouse` },
];

const CMS_EXTRA: Endpoint[] = [
  { method: 'GET', path: '/admin/api/sites', auth: 'admin', desc: '[CMS] 사이트 목록', example: 'curl -H "x-admin-token: $T" http://localhost:3000/admin/api/sites' },
  { method: 'POST', path: '/admin/api/sites', auth: 'admin', desc: '[CMS] 사이트 추가/갱신', example: `curl -X POST -H "x-admin-token: $T" -d '{"id":"docs","name":"Docs","origin":"https://docs.example.com","routes":[]}' http://localhost:3000/admin/api/sites` },
  { method: 'DELETE', path: '/admin/api/sites/:id', auth: 'admin', desc: '[CMS] 사이트 삭제', example: 'curl -X DELETE -H "x-admin-token: $T" http://localhost:3000/admin/api/sites/docs' },
  { method: 'POST', path: '/admin/api/sites/:id/cache/invalidate', auth: 'admin', desc: '[CMS] 사이트별 URL 무효화', example: `curl -X POST -H "x-admin-token: $T" -d '{"url":"https://docs.example.com/x"}' http://localhost:3000/admin/api/sites/docs/cache/invalidate` },
  { method: 'POST', path: '/admin/api/sites/:id/warm', auth: 'admin', desc: '[CMS] 사이트별 sitemap 워밍', example: `curl -X POST -H "x-admin-token: $T" -d '{"max":500}' http://localhost:3000/admin/api/sites/docs/warm` },
  { method: 'GET', path: '/admin/api/cms/stats', auth: 'admin', desc: '[CMS] 사이트 카운트 + 캐시 상태', example: 'curl -H "x-admin-token: $T" http://localhost:3000/admin/api/cms/stats' },
];

const SAAS_EXTRA: Endpoint[] = [
  { method: 'GET', path: '/admin/api/tenants', auth: 'admin', desc: '[SaaS] 테넌트 목록', example: 'curl -H "x-admin-token: $T" http://localhost:3000/admin/api/tenants' },
  { method: 'POST', path: '/admin/api/tenants', auth: 'admin', desc: '[SaaS] 테넌트 추가/갱신', example: `curl -X POST -H "x-admin-token: $T" -d '{"id":"acme","name":"ACME","origin":"https://www.acme.com","apiKey":"tk_live_xxx","plan":"pro","routes":[]}' http://localhost:3000/admin/api/tenants` },
  { method: 'DELETE', path: '/admin/api/tenants/:id', auth: 'admin', desc: '[SaaS] 테넌트 삭제', example: 'curl -X DELETE -H "x-admin-token: $T" http://localhost:3000/admin/api/tenants/acme' },
  { method: 'POST', path: '/api/cache/invalidate', auth: 'apiKey', desc: '[SaaS] 테넌트가 자기 캐시 무효화 (apiKey 인증)', example: `curl -X POST -H "x-api-key: tk_..." -d '{"url":"https://www.acme.com/x"}' http://localhost:3000/api/cache/invalidate` },
  { method: 'GET', path: '/admin/api/multi-tenant/stats', auth: 'admin', desc: '[SaaS] 테넌트 통계', example: 'curl -H "x-admin-token: $T" http://localhost:3000/admin/api/multi-tenant/stats' },
];

type Ctx = { publicInfo: PublicInfo | null };

export function ApiExplorer() {
  const t = useStore((s) => s.t);
  const { publicInfo } = useOutletContext<Ctx>();
  const mode = publicInfo?.mode;
  const list = [
    ...COMMON,
    ...(mode === 'cms' ? CMS_EXTRA : []),
    ...(mode === 'saas' ? SAAS_EXTRA : []),
  ];

  return (
    <section className="space-y-4" data-testid="page-api">
      <h2 className="font-semibold text-lg">{t('api.title')}</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        모드: <code className="font-mono">{mode ?? '(loading)'}</code>. 모드별 추가 엔드포인트가 자동으로 노출됩니다.
      </p>
      <div className="space-y-3">
        {list.map((e) => (
          <details
            key={`${e.method}-${e.path}`}
            className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200"
          >
            <summary className="cursor-pointer px-4 py-3 flex items-center gap-3">
              <span
                className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${methodPillClass(e.method)}`}
              >
                {e.method}
              </span>
              <code className="font-mono text-sm">{e.path}</code>
              <span className="ml-auto text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {e.auth}
              </span>
            </summary>
            <div className="px-4 pb-4 pt-2 text-sm text-slate-700 dark:text-slate-200">
              <p className="mb-2">{e.desc}</p>
              <pre className="bg-slate-50 dark:bg-slate-800 p-3 rounded text-xs overflow-auto">
                {e.example}
              </pre>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
