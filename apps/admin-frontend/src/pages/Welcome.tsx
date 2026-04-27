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
      <div className="bg-gradient-to-br from-slate-900 to-indigo-900 text-white rounded-xl p-8 shadow-lg">
        <h2 className="text-3xl font-bold">{t('welcome.headline')}</h2>
        <p className="mt-2 text-slate-300">{t('welcome.intro')}</p>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label={t('mode')} value={publicInfo?.mode ?? '...'} />
          <Stat label={t('origin')} value={publicInfo?.origin ?? '(미설정)'} truncate />
          <Stat label={t('uptime')} value={formatUptime(publicInfo?.uptimeSec)} />
          <Stat label={t('node')} value={publicInfo?.nodeVersion ?? '...'} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card icon="🤖" title={t('welcome.cards.bot')} body={t('welcome.cards.bot.body')} />
        <Card icon="⚡" title={t('welcome.cards.cache')} body={t('welcome.cards.cache.body')} />
        <Card icon="🛡️" title={t('welcome.cards.shield')} body={t('welcome.cards.shield.body')} />
      </div>

      <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5">
        <h3 className="font-semibold mb-3">{t('welcome.quickstart')}</h3>
        <ol className="text-sm space-y-3 text-slate-700 dark:text-slate-200">
          <li>
            <span className="font-bold mr-2">1</span>
            좌측 메뉴에서 원하는 작업을 선택. 인증이 필요한 페이지는 우측 상단에 토큰 입력 박스가 표시됩니다.
          </li>
          <li>
            <span className="font-bold mr-2">2</span>
            처음이라면{' '}
            <Link to="/test" className="text-indigo-600 hover:underline">
              렌더 테스트
            </Link>{' '}
            에서 간단한 URL 한 개를 렌더해 동작 확인.
          </li>
          <li>
            <span className="font-bold mr-2">3</span>
            <Link to="/routes" className="text-indigo-600 hover:underline">
              라우트
            </Link>{' '}
            에서 URL 패턴별 캐시 TTL / waitUntil / ignore 정의.
          </li>
          <li>
            <span className="font-bold mr-2">4</span>
            <Link to="/warm" className="text-indigo-600 hover:underline">
              워밍
            </Link>{' '}
            으로 sitemap 으로부터 미리 캐시 채우기.
          </li>
          <li>
            <span className="font-bold mr-2">5</span>
            <Link to="/metrics" className="text-indigo-600 hover:underline">
              메트릭
            </Link>{' '}
            에서 실시간 처리량/지연/에러를 모니터링.
          </li>
        </ol>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5">
          <h3 className="font-semibold mb-2">아키텍처 한눈에</h3>
          <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 overflow-auto">{`Bot ─→ Edge/CDN ──→ spa-seo-gateway
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
        <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5">
          <h3 className="font-semibold mb-2">바로가기 / Resources</h3>
          <ul className="text-sm space-y-1.5">
            <li>
              📚{' '}
              <a
                href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/GETTING-STARTED.md"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline"
              >
                설치 가이드
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
              🚀{' '}
              <a
                href="https://github.com/blue45f/spa-seo-gateway/blob/main/docs/DEPLOYMENT.md"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline"
              >
                배포 가이드 (Docker/K8s/CDN)
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
    <div className="bg-white/10 rounded p-3">
      <div className="text-xs text-slate-300">{label}</div>
      <div className={`font-mono mt-1 ${truncate ? 'truncate' : ''}`}>{value}</div>
    </div>
  );
}

function Card({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5">
      <div className="text-2xl">{icon}</div>
      <h3 className="font-semibold mt-2">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{body}</p>
    </div>
  );
}
