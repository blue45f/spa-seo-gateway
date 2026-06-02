import { useStore } from '../lib/store';

export function Library() {
  const t = useStore((s) => s.t);
  return (
    <section className="space-y-6" data-testid="page-library">
      <h2 className="text-lg font-semibold tracking-tight text-ink">{t('library.title')}</h2>

      <div className="alert alert--info p-4 text-sm">
        <h3 className="font-semibold text-ink mb-1">{t('library.intro.title')}</h3>
        <p className="text-ink-muted">
          {t('library.intro.body.pre')}
          <a
            href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/LIBRARY-USAGE.md"
            target="_blank"
            rel="noreferrer"
            className="link"
          >
            LIBRARY-USAGE.md
          </a>
          {t('library.intro.body.post')}
        </p>
      </div>

      <Block title={t('library.install')}>
        <pre>{`# Most common combo
pnpm add @heejun/spa-seo-gateway-core @heejun/spa-seo-gateway-admin-ui fastify

# SaaS mode
pnpm add @heejun/spa-seo-gateway-multi-tenant

# CMS mode
pnpm add @heejun/spa-seo-gateway-cms

# AI Schema adapter (optional)
pnpm add @heejun/spa-seo-gateway-anthropic @anthropic-ai/sdk
# Or OpenAI-compatible
pnpm add @heejun/spa-seo-gateway-openai`}</pre>
      </Block>

      <Block title={t('library.s1')}>
        <pre>{`import Fastify from 'fastify';
import { browserPool, config } from '@heejun/spa-seo-gateway-core';
import { registerAdminUI } from '@heejun/spa-seo-gateway-admin-ui';

const app = Fastify({ loggerInstance: console });
await registerAdminUI(app);
await browserPool.start();

await app.listen({ port: 3000 });
console.log('admin: http://localhost:3000/admin/ui');`}</pre>
      </Block>

      <Block title={t('library.s2')}>
        <pre>{`import { setAiSchemaAdapter } from '@heejun/spa-seo-gateway-core';
import { createAnthropicSchemaAdapter } from '@heejun/spa-seo-gateway-anthropic';

setAiSchemaAdapter(createAnthropicSchemaAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-opus-4-7',
}));`}</pre>
        <p className="mt-2 text-xs text-ink-subtle">
          {t('library.s2.note.pre')}
          <code>@heejun/spa-seo-gateway-openai</code>
          {t('library.s2.note.post')}
        </p>
      </Block>

      <Block title={t('library.s3')}>
        <pre>{`{
  "routes": [
    {
      "pattern": "^/products/",
      "ttlMs": 3600000,
      "variants": [
        { "title": "30% off", "weight": 1 },
        { "title": "Free shipping today", "weight": 2 }
      ]
    }
  ]
}`}</pre>
        <p className="mt-2 text-xs text-ink-subtle">
          {t('library.s3.note.pre')}
          <code>x-prerender-variant</code>
          {t('library.s3.note.mid')}
          <code>gateway_variant_impressions_total</code>
          {t('library.s3.note.post')}
        </p>
      </Block>

      <Block title={t('library.s4')}>
        <pre>{`import { runVisualDiff } from '@heejun/spa-seo-gateway-core';

const r = await runVisualDiff('https://staging.example.com/');
if (r.diffPercent > 1) {
  console.error('regression detected', r);
  process.exit(1);
}`}</pre>
      </Block>

      <Block title={t('library.s5')}>
        <pre>{`import { recordAudit, verifyAuditChain } from '@heejun/spa-seo-gateway-core';

recordAudit({ actor: 'admin', action: 'cache.clear', outcome: 'ok' });

// periodic verification
const { ok, brokenAt } = verifyAuditChain();
if (!ok) alertSecurity(\`tampered at \${brokenAt}\`);`}</pre>
      </Block>
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-5">
      <h3 className="font-semibold text-ink mb-3">{title}</h3>
      <div className="text-xs [&>pre]:bg-panel-2 [&>pre]:border [&>pre]:border-line [&>pre]:p-3 [&>pre]:rounded-lg [&>pre]:overflow-auto [&>pre]:font-mono space-y-2">
        {children}
      </div>
    </div>
  );
}
