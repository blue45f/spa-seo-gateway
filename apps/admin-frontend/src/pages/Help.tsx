import {
  BookOpen,
  Building2,
  ChartColumn,
  Globe,
  type LucideIcon,
  Network,
  Palette,
  Rocket,
  Settings,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { useStore } from '../lib/store'

const DOCS_BASE = 'https://github.com/blue45f/spa-seo-gateway/blob/main/docs'

const GUIDES: Array<{ icon: LucideIcon; href: string; labelKey: string }> = [
  {
    icon: BookOpen,
    href: `${DOCS_BASE}/GETTING-STARTED.md`,
    labelKey: 'help.links.gettingStarted',
  },
  { icon: Settings, href: `${DOCS_BASE}/CONFIGURATION.md`, labelKey: 'help.links.configuration' },
  { icon: Rocket, href: `${DOCS_BASE}/DEPLOYMENT.md`, labelKey: 'help.links.deployment' },
  { icon: Building2, href: `${DOCS_BASE}/MULTI-TENANT.md`, labelKey: 'help.links.multiTenant' },
  { icon: Globe, href: `${DOCS_BASE}/CMS-MODE.md`, labelKey: 'help.links.cmsMode' },
  { icon: Network, href: `${DOCS_BASE}/ARCHITECTURE.md`, labelKey: 'help.links.architecture' },
  { icon: Zap, href: `${DOCS_BASE}/CONCURRENCY.md`, labelKey: 'help.links.concurrency' },
  { icon: ChartColumn, href: `${DOCS_BASE}/BENCHMARKS.md`, labelKey: 'help.links.benchmarks' },
  { icon: TrendingUp, href: `${DOCS_BASE}/MIGRATION-1.7.md`, labelKey: 'help.links.migration' },
]

const FAQ_COUNT = 10

export function Help() {
  const t = useStore((s) => s.t)
  return (
    <section className="space-y-4" data-testid="page-help">
      <div className="alert alert--info p-4 text-sm">
        <h3 className="font-semibold text-ink mb-1">{t('help.title')}</h3>
        <p className="text-ink-muted">{t('help.intro')}</p>
      </div>
      {Array.from({ length: FAQ_COUNT }, (_, i) => i + 1).map((n) => (
        <details key={n} className="panel p-4">
          <summary className="cursor-pointer font-semibold text-ink">{t(`help.faq.q${n}`)}</summary>
          <div className="mt-2 text-sm text-ink-muted leading-relaxed">{t(`help.faq.a${n}`)}</div>
        </details>
      ))}
      <div className="panel p-5 text-sm">
        <h3 className="font-semibold text-ink mb-2">{t('help.guides')}</h3>
        <ul className="space-y-1.5">
          {GUIDES.map(({ icon: Icon, href, labelKey }) => (
            <li key={href}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="link inline-flex items-center gap-2"
              >
                <Icon
                  className="h-4 w-4 shrink-0 text-ink-subtle"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                {t(labelKey)}
              </a>
            </li>
          ))}
          <li className="mt-1.5 border-t border-line pt-1.5">
            <Link to="/design" className="link inline-flex items-center gap-2">
              <Palette
                className="h-4 w-4 shrink-0 text-ink-subtle"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {t('help.designLink')}
            </Link>
          </li>
        </ul>
      </div>
    </section>
  )
}
