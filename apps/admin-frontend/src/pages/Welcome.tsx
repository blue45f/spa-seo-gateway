import {
  ArrowRight,
  Activity,
  BookOpen,
  Bot,
  Building2,
  CircleCheck,
  Cpu,
  Globe,
  type LucideIcon,
  Gauge,
  Network,
  Rocket,
  Settings,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'

import { formatUptime } from '../lib/format'
import { useStore } from '../lib/store'

import type { PublicInfo } from '../lib/types'

type Ctx = { publicInfo: PublicInfo | null }

const DOCS_BASE = 'https://github.com/blue45f/spa-seo-gateway/blob/main/docs'

/** Quickstart steps. Step 1 has no link; the rest lead with a nav link, then a t()-keyed tail. */
const QUICKSTART: Array<{ to?: string; navKey?: string; bodyKey: string }> = [
  { bodyKey: 'welcome.qs1' },
  { to: '/test', navKey: 'nav.test', bodyKey: 'welcome.qs2' },
  { to: '/routes', navKey: 'nav.routes', bodyKey: 'welcome.qs3' },
  { to: '/warm', navKey: 'nav.warm', bodyKey: 'welcome.qs4' },
  { to: '/metrics', navKey: 'nav.metrics', bodyKey: 'welcome.qs5' },
]

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
]

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
Human ──→ Edge/CDN ──→ origin (gateway: 204 or proxy)`

export function Welcome() {
  const { publicInfo } = useOutletContext<Ctx>()
  const t = useStore((s) => s.t)
  const [demoChecks, setDemoChecks] = useState({
    test: false,
    routes: false,
    warm: false,
    metrics: false,
  })
  const demoRate = Math.round((Object.values(demoChecks).filter(Boolean).length / 4) * 100)

  return (
    <section className="welcome-page space-y-6" data-testid="page-welcome">
      <div className="welcome-hero">
        <div className="welcome-hero__grid">
          <div className="welcome-hero__copy">
            <div className="welcome-live-chip welcome-enter welcome-enter--chip">
              <span className="welcome-live-dot" aria-hidden="true" />
              <span>{t('welcome.eyebrow')}</span>
            </div>

            <h2 className="welcome-title welcome-enter welcome-enter--title">
              {t('welcome.headline')}
            </h2>
            <p className="welcome-lede welcome-enter welcome-enter--lede">{t('welcome.intro')}</p>

            <div className="welcome-actions welcome-enter welcome-enter--actions">
              <Link
                to="/test"
                className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
              >
                {t('welcome.cta.primary')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href={`${DOCS_BASE}/GETTING-STARTED.md`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost inline-flex items-center gap-2 px-4 py-2 text-sm"
              >
                {t('welcome.cta.secondary')}
              </a>
            </div>
          </div>

          <div className="welcome-flow welcome-enter welcome-enter--flow" aria-label="gateway flow">
            <div className="welcome-flow__node welcome-flow__node--source">
              <Bot className="h-5 w-5" aria-hidden="true" />
              <span>Bot</span>
            </div>
            <div className="welcome-flow__line" aria-hidden="true" />
            <div className="welcome-flow__node welcome-flow__node--core">
              <Cpu className="h-5 w-5" aria-hidden="true" />
              <span>gateway</span>
            </div>
            <div className="welcome-flow__line" aria-hidden="true" />
            <div className="welcome-flow__node welcome-flow__node--result">
              <CircleCheck className="h-5 w-5" aria-hidden="true" />
              <span>HTML</span>
            </div>
            <div className="welcome-flow__metrics">
              <span>
                <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                up {formatUptime(publicInfo?.uptimeSec)}
              </span>
              <span>
                <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                {publicInfo?.site?.routes ?? 0} routes
              </span>
            </div>
          </div>
        </div>

        <div className="welcome-stat-grid welcome-enter welcome-enter--stats">
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

      <div className="panel welcome-section p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-ink">{t('welcome.quickstart')}</h3>
          <span className="font-mono text-xs text-ink-subtle">01-05</span>
        </div>
        <ol className="welcome-steps text-sm text-ink-muted">
          {QUICKSTART.map((step, i) => (
            <li key={step.bodyKey} className="welcome-step">
              <span className="welcome-step__num">{i + 1}</span>
              <span>
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
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="panel welcome-section welcome-demo p-5">
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
        {/* progress readout — accent fill on the inset track, width-only transition (reduced-motion safe) */}
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-panel-2"
          role="progressbar"
          aria-valuenow={demoRate}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Demo readiness"
        >
          <span
            className="block h-full rounded-full bg-accent transition-[width] duration-200 ease-out motion-reduce:transition-none"
            style={{ width: `${demoRate}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-2 text-sm">
          {[
            ['test', '테스트 렌더 완료'],
            ['routes', '라우트 규칙'],
            ['warm', '캐시 워밍'],
            ['metrics', '메트릭 확인'],
          ].map(([key, label]) => (
            <label
              key={key}
              className="welcome-check panel-inset flex items-center gap-2 rounded-lg px-3 py-2"
            >
              <input
                type="checkbox"
                className="checkbox h-4 w-4"
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
        <div className="panel welcome-section p-5">
          <h3 className="font-semibold mb-2 text-ink">{t('welcome.architecture')}</h3>
          <pre className="welcome-architecture panel-inset text-xs p-3 overflow-auto">
            {ARCH_DIAGRAM}
          </pre>
        </div>
        <div className="panel welcome-section p-5">
          <h3 className="font-semibold mb-2 text-ink">{t('welcome.resources')}</h3>
          <ul className="welcome-resources text-sm">
            {RESOURCES.map(({ icon: Icon, href, labelKey }) => (
              <li key={href}>
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
  )
}

function Stat({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div className="welcome-stat bg-panel border border-line rounded-lg p-3">
      <div className="text-xs text-ink-subtle">{label}</div>
      <div className={`font-mono mt-1 text-ink ${truncate ? 'truncate' : ''}`}>{value}</div>
    </div>
  )
}

function Card({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="welcome-feature panel p-5">
      <Icon className="h-6 w-6 text-ink-muted" strokeWidth={1.75} aria-hidden="true" />
      <h3 className="font-semibold mt-2 text-ink">{title}</h3>
      <p className="text-sm text-ink-muted mt-1">{body}</p>
    </div>
  )
}
