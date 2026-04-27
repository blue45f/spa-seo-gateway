import { useStore } from '../lib/store';

export function Library() {
  const t = useStore((s) => s.t);
  return (
    <section className="space-y-6" data-testid="page-library">
      <h2 className="font-semibold text-lg">{t('library.title')}</h2>

      <div className="bg-blue-50 dark:bg-indigo-950 dark:border-indigo-900 border border-blue-200 rounded-lg p-4 text-sm">
        <h3 className="font-semibold text-blue-900 dark:text-indigo-200 mb-1">
          npm 라이브러리로 사용
        </h3>
        <p className="text-blue-800 dark:text-indigo-300">
          외부 Fastify 앱에 admin UI / 코어 엔진을 직접 임베드. 6가지 시나리오는{' '}
          <a
            href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/LIBRARY-USAGE.md"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            LIBRARY-USAGE.md
          </a>
          .
        </p>
      </div>

      <Block title="설치">
        <pre>{`# 가장 흔한 조합
pnpm add @heejun/spa-seo-gateway-core @heejun/spa-seo-gateway-admin-ui fastify

# SaaS 모드
pnpm add @heejun/spa-seo-gateway-multi-tenant

# CMS 모드
pnpm add @heejun/spa-seo-gateway-cms

# AI Schema 어댑터 (옵션)
pnpm add @heejun/spa-seo-gateway-anthropic @anthropic-ai/sdk
# 또는 OpenAI 호환
pnpm add @heejun/spa-seo-gateway-openai`}</pre>
      </Block>

      <Block title="시나리오 1 — 새 Fastify 앱에 통째로 끼우기">
        <pre>{`import Fastify from 'fastify';
import { browserPool, config } from '@heejun/spa-seo-gateway-core';
import { registerAdminUI } from '@heejun/spa-seo-gateway-admin-ui';

const app = Fastify({ loggerInstance: console });
await registerAdminUI(app);
await browserPool.start();

await app.listen({ port: 3000 });
console.log('admin: http://localhost:3000/admin/ui');`}</pre>
      </Block>

      <Block title="시나리오 2 — AI Schema 어댑터 주입">
        <pre>{`import { setAiSchemaAdapter } from '@heejun/spa-seo-gateway-core';
import { createAnthropicSchemaAdapter } from '@heejun/spa-seo-gateway-anthropic';

setAiSchemaAdapter(createAnthropicSchemaAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-opus-4-7',
}));`}</pre>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          OpenAI / Groq / Ollama 도 동일한 인터페이스로{' '}
          <code>@heejun/spa-seo-gateway-openai</code> 패키지에서 제공.
        </p>
      </Block>

      <Block title="시나리오 3 — A/B variant 설정">
        <pre>{`{
  "routes": [
    {
      "pattern": "^/products/",
      "ttlMs": 3600000,
      "variants": [
        { "title": "구매 30% 할인", "weight": 1 },
        { "title": "지금 구매하면 무료배송", "weight": 2 }
      ]
    }
  ]
}`}</pre>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          응답 헤더 <code>x-prerender-variant</code> + Prometheus{' '}
          <code>gateway_variant_impressions_total</code> 으로 인상 추적.
        </p>
      </Block>

      <Block title="시나리오 4 — Visual regression CI">
        <pre>{`import { runVisualDiff } from '@heejun/spa-seo-gateway-core';

const r = await runVisualDiff('https://staging.example.com/');
if (r.diffPercent > 1) {
  console.error('회귀 감지', r);
  process.exit(1);
}`}</pre>
      </Block>

      <Block title="시나리오 5 — Audit chain 변조 감지">
        <pre>{`import { recordAudit, verifyAuditChain } from '@heejun/spa-seo-gateway-core';

recordAudit({ actor: 'admin', action: 'cache.clear', outcome: 'ok' });

// 주기 검증
const { ok, brokenAt } = verifyAuditChain();
if (!ok) alertSecurity(\`tampered at \${brokenAt}\`);`}</pre>
      </Block>
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5">
      <h3 className="font-semibold mb-3">{title}</h3>
      <div className="text-xs [&>pre]:bg-slate-50 dark:[&>pre]:bg-slate-800 [&>pre]:p-3 [&>pre]:rounded [&>pre]:overflow-auto [&>pre]:font-mono space-y-2">
        {children}
      </div>
    </div>
  );
}
