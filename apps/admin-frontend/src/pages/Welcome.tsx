import {
  BookOpen,
  Bot,
  Building2,
  Globe,
  type LucideIcon,
  Network,
  Rocket,
  Settings,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { formatUptime } from '../lib/format';
import { useStore } from '../lib/store';
import type { PublicInfo } from '../lib/types';

type Ctx = { publicInfo: PublicInfo | null };

const DOCS_BASE = 'https://github.com/blue45f/spa-seo-gateway/blob/main/docs';

/** Quickstart steps. Step 1 has no link; the rest lead with a nav link, then a t()-keyed tail. */
const QUICKSTART: Array<{ to?: string; navKey?: string; bodyKey: string }> = [
  { bodyKey: 'welcome.qs1' },
  { to: '/test', navKey: 'nav.test', bodyKey: 'welcome.qs2' },
  { to: '/routes', navKey: 'nav.routes', bodyKey: 'welcome.qs3' },
  { to: '/warm', navKey: 'nav.warm', bodyKey: 'welcome.qs4' },
  { to: '/metrics', navKey: 'nav.metrics', bodyKey: 'welcome.qs5' },
];

const RESOURCES: Array<{ icon: LucideIcon; href: string; labelKey: string }> = [
  {
    icon: BookOpen,
    href: `${DOCS_BASE}/GETTING-STARTED.md`,
    labelKey: 'welcome.links.gettingStarted',
  },
  {
    icon: Settings,
    href: `${DOCS_BASE}/CONFIGURATION.md`,
    labelKey: 'welcome.links.configuration',
  },
  { icon: Building2, href: `${DOCS_BASE}/MULTI-TENANT.md`, labelKey: 'welcome.links.multiTenant' },
  { icon: Globe, href: `${DOCS_BASE}/CMS-MODE.md`, labelKey: 'welcome.links.cmsMode' },
  { icon: Rocket, href: `${DOCS_BASE}/DEPLOYMENT.md`, labelKey: 'welcome.links.deployment' },
  { icon: Network, href: `${DOCS_BASE}/ARCHITECTURE.md`, labelKey: 'welcome.links.architecture' },
];

// Technical architecture diagram — locale-neutral (English) so it reads the same in both languages.
const ARCH_DIAGRAM = `Bot ─→ Edge/CDN ──→ spa-seo-gateway
              (split by UA)      ├─ bot detect (isbot)
                                 ├─ host → site/tenant map
                                 ├─ cache lookup ──→ HIT (5ms)
                                 ├─ cache MISS
                                 ├─ in-flight dedup
                                 ├─ render (puppeteer-cluster)
                                 ├─ quality gate
                                 ├─ cache.set
                                 └─ response
Human ──→ Edge/CDN ──→ origin (gateway: 204 or proxy)`;

export function Welcome() {
  const { publicInfo } = useOutletContext<Ctx>();
  const t = useStore((s) => s.t);
  const [demoChecks, setDemoChecks] = useState({
    test: false,
    routes: false,
    warm: false,
    metrics: false,
  });
  const demoRate = Math.round((Object.values(demoChecks).filter(Boolean).length / 4) * 100);

  return (
    <section className="space-y-6" data-testid="page-welcome">
      <div className="bg-accent-soft border border-line rounded-xl p-8">
        <h2 className="text-xl font-semibold tracking-tight text-ink">{t('welcome.headline')}</h2>
        <p className="mt-2 text-ink-muted">{t('welcome.intro')}</p>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label={t('mode')} value={publicInfo?.mode ?? '...'} />
          <Stat
            label={t('origin')}
            value={publicInfo?.origin ?? t('welcome.origin.unset')}
            truncate
          />
          <Stat label={t('uptime')} value={formatUptime(publicInfo?.uptimeSec)} />
          <Stat label={t('node')} value={publicInfo?.nodeVersion ?? '...'} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card icon={Bot} title={t('welcome.cards.bot')} body={t('welcome.cards.bot.body')} />
        <Card icon={Zap} title={t('welcome.cards.cache')} body={t('welcome.cards.cache.body')} />
        <Card
          icon={ShieldCheck}
          title={t('welcome.cards.shield')}
          body={t('welcome.cards.shield.body')}
        />
      </div>

      <div className="panel p-5">
        <h3 className="font-semibold mb-3 text-ink">{t('welcome.quickstart')}</h3>
        <ol className="text-sm space-y-3 text-ink-muted">
          {QUICKSTART.map((step, i) => (
            <li key={step.bodyKey}>
              <span className="font-bold mr-2">{i + 1}</span>
              {step.to && step.navKey ? (
                <>
                  <Link to={step.to} className="link">
                    {t(step.navKey)}
                  </Link>
                  {t(step.bodyKey)}
                </>
              ) : (
                t(step.bodyKey)
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="panel p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Demo readiness
            </p>
            <h3 className="mt-1 font-semibold text-ink">운영 데모 체크리스트</h3>
            <p className="mt-1 text-sm text-ink-muted">
              테스트 렌더, 라우트 편집, 워밍, 메트릭 확인을 한 흐름으로 점검합니다.
            </p>
          </div>
          <span className="font-mono text-sm text-ink">{demoRate}%</span>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-2 text-sm">
          {[
            ['test', '테스트 렌더 완료'],
            ['routes', '라우트 규칙'],
            ['warm', '캐시 워밍'],
            ['metrics', '메트릭 확인'],
          ].map(([key, label]) => (
            <label key={key} className="panel-inset flex items-center gap-2 rounded-lg px-3 py-2">
              <input
                type="checkbox"
                checked={demoChecks[key as keyof typeof demoChecks]}
                onChange={(event) =>
                  setDemoChecks((current) => ({ ...current, [key]: event.target.checked }))
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="panel p-5">
          <h3 className="font-semibold mb-2 text-ink">{t('welcome.architecture')}</h3>
          <pre className="panel-inset text-xs p-3 overflow-auto">{ARCH_DIAGRAM}</pre>
        </div>
        <div className="panel p-5">
          <h3 className="font-semibold mb-2 text-ink">{t('welcome.resources')}</h3>
          <ul className="text-sm space-y-1.5">
            {RESOURCES.map(({ icon: Icon, href, labelKey }) => (
              <li key={href} className="flex items-center gap-2">
                <Icon
                  className="h-4 w-4 shrink-0 text-ink-subtle"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <a href={href} target="_blank" rel="noreferrer" className="link">
                  {t(labelKey)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div className="bg-panel border border-line rounded-lg p-3">
      <div className="text-xs text-ink-subtle">{label}</div>
      <div className={`font-mono mt-1 text-ink ${truncate ? 'truncate' : ''}`}>{value}</div>
    </div>
  );
}

function Card({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="panel p-5">
      <Icon className="h-6 w-6 text-ink-muted" strokeWidth={1.75} aria-hidden="true" />
      <h3 className="font-semibold mt-2 text-ink">{title}</h3>
      <p className="text-sm text-ink-muted mt-1">{body}</p>
    </div>
  );
}
