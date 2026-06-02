import { useOutletContext } from 'react-router-dom';
import { methodPillClass } from '../lib/format';
import { useStore } from '../lib/store';
import type { PublicInfo } from '../lib/types';

type Endpoint = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  auth: 'public' | 'admin' | 'apiKey';
  descKey: string;
  example: string;
};

const COMMON: Endpoint[] = [
  {
    method: 'GET',
    path: '/health',
    auth: 'public',
    descKey: 'api.desc.health',
    example: 'curl http://localhost:3000/health',
  },
  {
    method: 'GET',
    path: '/health/deep',
    auth: 'public',
    descKey: 'api.desc.healthDeep',
    example: 'curl http://localhost:3000/health/deep',
  },
  {
    method: 'GET',
    path: '/metrics',
    auth: 'public',
    descKey: 'api.desc.metrics',
    example: 'curl http://localhost:3000/metrics',
  },
  {
    method: 'GET',
    path: '/admin/api/public/info',
    auth: 'public',
    descKey: 'api.desc.publicInfo',
    example: 'curl http://localhost:3000/admin/api/public/info',
  },
  {
    method: 'GET',
    path: '/admin/api/site',
    auth: 'admin',
    descKey: 'api.desc.site',
    example: 'curl -H "x-admin-token: $T" http://localhost:3000/admin/api/site',
  },
  {
    method: 'GET',
    path: '/admin/api/routes',
    auth: 'admin',
    descKey: 'api.desc.routesGet',
    example: 'curl -H "x-admin-token: $T" http://localhost:3000/admin/api/routes',
  },
  {
    method: 'PUT',
    path: '/admin/api/routes',
    auth: 'admin',
    descKey: 'api.desc.routesPut',
    example: `curl -X PUT -H "x-admin-token: $T" -H "content-type: application/json" \\\n  -d '{"routes":[{"pattern":"^/blog/","ttlMs":86400000}],"persist":true}' \\\n  http://localhost:3000/admin/api/routes`,
  },
  {
    method: 'POST',
    path: '/admin/api/cache/invalidate',
    auth: 'admin',
    descKey: 'api.desc.cacheInvalidate',
    example: `curl -X POST -H "x-admin-token: $T" -d '{"url":"https://www.example.com/x"}' http://localhost:3000/admin/api/cache/invalidate`,
  },
  {
    method: 'POST',
    path: '/admin/api/cache/clear',
    auth: 'admin',
    descKey: 'api.desc.cacheClear',
    example: 'curl -X POST -H "x-admin-token: $T" http://localhost:3000/admin/api/cache/clear',
  },
  {
    method: 'POST',
    path: '/admin/api/warm',
    auth: 'admin',
    descKey: 'api.desc.warm',
    example: `curl -X POST -H "x-admin-token: $T" -d '{"sitemap":"https://www.example.com/sitemap.xml","max":500}' http://localhost:3000/admin/api/warm`,
  },
  {
    method: 'POST',
    path: '/admin/api/render-test',
    auth: 'admin',
    descKey: 'api.desc.renderTest',
    example: `curl -X POST -H "x-admin-token: $T" -d '{"url":"https://www.example.com/","ua":"Googlebot/2.1"}' http://localhost:3000/admin/api/render-test`,
  },
  {
    method: 'GET',
    path: '/admin/api/audit',
    auth: 'admin',
    descKey: 'api.desc.audit',
    example: 'curl -H "x-admin-token: $T" http://localhost:3000/admin/api/audit',
  },
  {
    method: 'GET',
    path: '/admin/api/audit/verify',
    auth: 'admin',
    descKey: 'api.desc.auditVerify',
    example: 'curl -H "x-admin-token: $T" http://localhost:3000/admin/api/audit/verify',
  },
  {
    method: 'POST',
    path: '/admin/api/visual-diff',
    auth: 'admin',
    descKey: 'api.desc.visualDiff',
    example: `curl -X POST -H "x-admin-token: $T" -d '{"url":"https://www.example.com/","mode":"auto","threshold":0.1}' http://localhost:3000/admin/api/visual-diff`,
  },
  {
    method: 'POST',
    path: '/admin/api/ai/schema',
    auth: 'admin',
    descKey: 'api.desc.aiSchema',
    example: `curl -X POST -H "x-admin-token: $T" -d '{"url":"https://www.example.com/blog/x"}' http://localhost:3000/admin/api/ai/schema`,
  },
  {
    method: 'POST',
    path: '/admin/api/lighthouse',
    auth: 'admin',
    descKey: 'api.desc.lighthouse',
    example: `curl -X POST -H "x-admin-token: $T" -d '{"url":"https://www.example.com/"}' http://localhost:3000/admin/api/lighthouse`,
  },
];

const CMS_EXTRA: Endpoint[] = [
  {
    method: 'GET',
    path: '/admin/api/sites',
    auth: 'admin',
    descKey: 'api.desc.cmsSitesGet',
    example: 'curl -H "x-admin-token: $T" http://localhost:3000/admin/api/sites',
  },
  {
    method: 'POST',
    path: '/admin/api/sites',
    auth: 'admin',
    descKey: 'api.desc.cmsSitesPost',
    example: `curl -X POST -H "x-admin-token: $T" -d '{"id":"docs","name":"Docs","origin":"https://docs.example.com","routes":[]}' http://localhost:3000/admin/api/sites`,
  },
  {
    method: 'DELETE',
    path: '/admin/api/sites/:id',
    auth: 'admin',
    descKey: 'api.desc.cmsSitesDelete',
    example: 'curl -X DELETE -H "x-admin-token: $T" http://localhost:3000/admin/api/sites/docs',
  },
  {
    method: 'POST',
    path: '/admin/api/sites/:id/cache/invalidate',
    auth: 'admin',
    descKey: 'api.desc.cmsSiteInvalidate',
    example: `curl -X POST -H "x-admin-token: $T" -d '{"url":"https://docs.example.com/x"}' http://localhost:3000/admin/api/sites/docs/cache/invalidate`,
  },
  {
    method: 'POST',
    path: '/admin/api/sites/:id/warm',
    auth: 'admin',
    descKey: 'api.desc.cmsSiteWarm',
    example: `curl -X POST -H "x-admin-token: $T" -d '{"max":500}' http://localhost:3000/admin/api/sites/docs/warm`,
  },
  {
    method: 'GET',
    path: '/admin/api/cms/stats',
    auth: 'admin',
    descKey: 'api.desc.cmsStats',
    example: 'curl -H "x-admin-token: $T" http://localhost:3000/admin/api/cms/stats',
  },
];

const SAAS_EXTRA: Endpoint[] = [
  {
    method: 'GET',
    path: '/admin/api/tenants',
    auth: 'admin',
    descKey: 'api.desc.saasTenantsGet',
    example: 'curl -H "x-admin-token: $T" http://localhost:3000/admin/api/tenants',
  },
  {
    method: 'POST',
    path: '/admin/api/tenants',
    auth: 'admin',
    descKey: 'api.desc.saasTenantsPost',
    example: `curl -X POST -H "x-admin-token: $T" -d '{"id":"acme","name":"ACME","origin":"https://www.acme.com","apiKey":"tk_live_xxx","plan":"pro","routes":[]}' http://localhost:3000/admin/api/tenants`,
  },
  {
    method: 'DELETE',
    path: '/admin/api/tenants/:id',
    auth: 'admin',
    descKey: 'api.desc.saasTenantsDelete',
    example: 'curl -X DELETE -H "x-admin-token: $T" http://localhost:3000/admin/api/tenants/acme',
  },
  {
    method: 'POST',
    path: '/api/cache/invalidate',
    auth: 'apiKey',
    descKey: 'api.desc.saasSelfInvalidate',
    example: `curl -X POST -H "x-api-key: tk_..." -d '{"url":"https://www.acme.com/x"}' http://localhost:3000/api/cache/invalidate`,
  },
  {
    method: 'GET',
    path: '/admin/api/multi-tenant/stats',
    auth: 'admin',
    descKey: 'api.desc.saasStats',
    example: 'curl -H "x-admin-token: $T" http://localhost:3000/admin/api/multi-tenant/stats',
  },
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
      <h2 className="text-lg font-semibold tracking-tight text-ink">{t('api.title')}</h2>
      <p className="text-sm text-ink-muted">
        {t('api.mode')}: <code className="font-mono">{mode ?? '(loading)'}</code>. {t('api.intro')}
      </p>
      <div className="space-y-3">
        {list.map((e) => (
          <details key={`${e.method}-${e.path}`} className="panel">
            <summary className="cursor-pointer px-4 py-3 flex items-center gap-3">
              <span
                className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${methodPillClass(e.method)}`}
              >
                {e.method}
              </span>
              <code className="font-mono text-sm">{e.path}</code>
              <span className="badge badge--neutral ml-auto">{e.auth}</span>
            </summary>
            <div className="px-4 pb-4 pt-2 text-sm text-ink-muted">
              <p className="mb-2">{t(e.descKey)}</p>
              <pre className="panel-inset p-3 text-xs overflow-auto">{e.example}</pre>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
