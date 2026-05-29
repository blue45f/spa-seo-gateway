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
import { Link, useOutletContext } from 'react-router-dom';
import { formatUptime } from '../lib/format';
import { useStore } from '../lib/store';
import type { PublicInfo } from '../lib/types';

type Ctx = { publicInfo: PublicInfo | null };

export function Welcome() {
  const { publicInfo } = useOutletContext<Ctx>();
  const t = useStore((s) => s.t);

  return (
    <section className="space-y-6" data-testid="page-welcome">
      <div className="bg-accent-soft border border-line rounded-xl p-8">
        <h2 className="text-3xl font-bold tracking-tight text-ink">{t('welcome.headline')}</h2>
        <p className="mt-2 text-ink-muted">{t('welcome.intro')}</p>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label={t('mode')} value={publicInfo?.mode ?? '...'} />
          <Stat label={t('origin')} value={publicInfo?.origin ?? '(미설정)'} truncate />
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
          <li>
            <span className="font-bold mr-2">1</span>
            좌측 메뉴에서 원하는 작업을 선택. 인증이 필요한 페이지는 우측 상단에 토큰 입력 박스가
            표시됩니다.
          </li>
          <li>
            <span className="font-bold mr-2">2</span>
            처음이라면{' '}
            <Link to="/test" className="link">
              렌더 테스트
            </Link>{' '}
            에서 간단한 URL 한 개를 렌더해 동작 확인.
          </li>
          <li>
            <span className="font-bold mr-2">3</span>
            <Link to="/routes" className="link">
              라우트
            </Link>{' '}
            에서 URL 패턴별 캐시 TTL / waitUntil / ignore 정의.
          </li>
          <li>
            <span className="font-bold mr-2">4</span>
            <Link to="/warm" className="link">
              워밍
            </Link>{' '}
            으로 sitemap 으로부터 미리 캐시 채우기.
          </li>
          <li>
            <span className="font-bold mr-2">5</span>
            <Link to="/metrics" className="link">
              메트릭
            </Link>{' '}
            에서 실시간 처리량/지연/에러를 모니터링.
          </li>
        </ol>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="panel p-5">
          <h3 className="font-semibold mb-2 text-ink">아키텍처 한눈에</h3>
          <pre className="panel-inset text-xs p-3 overflow-auto">{`Bot ─→ Edge/CDN ──→ spa-seo-gateway
              (UA로 분기)        ├─ bot detect (isbot)
                                 ├─ host → site/tenant 매핑
                                 ├─ cache lookup ──→ HIT (5ms)
                                 ├─ cache MISS
                                 ├─ in-flight dedup
                                 ├─ render (puppeteer-cluster)
                                 ├─ quality gate
                                 ├─ cache.set
                                 └─ 응답
Human ──→ Edge/CDN ──→ origin (gateway는 204 또는 proxy)`}</pre>
        </div>
        <div className="panel p-5">
          <h3 className="font-semibold mb-2 text-ink">바로가기 / Resources</h3>
          <ul className="text-sm space-y-1.5">
            <li className="flex items-center gap-2">
              <BookOpen
                className="h-4 w-4 shrink-0 text-ink-subtle"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <a
                href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/GETTING-STARTED.md"
                target="_blank"
                rel="noreferrer"
                className="link"
              >
                설치 가이드
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Settings
                className="h-4 w-4 shrink-0 text-ink-subtle"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <a
                href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/CONFIGURATION.md"
                target="_blank"
                rel="noreferrer"
                className="link"
              >
                전체 설정 레퍼런스
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Building2
                className="h-4 w-4 shrink-0 text-ink-subtle"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <a
                href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/MULTI-TENANT.md"
                target="_blank"
                rel="noreferrer"
                className="link"
              >
                SaaS 모드 (다중 테넌트)
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Globe
                className="h-4 w-4 shrink-0 text-ink-subtle"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <a
                href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/CMS-MODE.md"
                target="_blank"
                rel="noreferrer"
                className="link"
              >
                CMS 모드 (다중 사이트)
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Rocket
                className="h-4 w-4 shrink-0 text-ink-subtle"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <a
                href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/DEPLOYMENT.md"
                target="_blank"
                rel="noreferrer"
                className="link"
              >
                배포 가이드 (Docker/K8s/CDN)
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Network
                className="h-4 w-4 shrink-0 text-ink-subtle"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <a
                href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/ARCHITECTURE.md"
                target="_blank"
                rel="noreferrer"
                className="link"
              >
                아키텍처
              </a>
            </li>
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
