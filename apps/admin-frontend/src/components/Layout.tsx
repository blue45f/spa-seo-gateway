import { X } from 'lucide-react';
import { Suspense, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import type { PublicInfo } from '../lib/types';
import { ErrorBoundary } from './ErrorBoundary';
import { Header } from './Header';
import { MobileMenu } from './MobileMenu';
import { RouteAnnouncer } from './RouteAnnouncer';
import { Sidebar } from './Sidebar';

export function Layout() {
  const t = useStore((s) => s.t);
  const publicInfo = useStore((s) => s.publicInfo);
  const setPublicInfo = useStore((s) => s.setPublicInfo);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const location = useLocation();

  // 라우트 변경 시 모바일 사이드바 닫기 — UX 일관성
  // biome-ignore lint/correctness/useExhaustiveDependencies: location.pathname triggers the effect on every route change
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname, setSidebarOpen]);

  useEffect(() => {
    let cancelled = false;
    api<PublicInfo>('GET', '/admin/api/public/info', undefined, { publicEndpoint: true })
      .then((info) => {
        if (!cancelled) setPublicInfo(info);
      })
      .catch(() => {
        if (!cancelled) setPublicInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [setPublicInfo]);

  // ⌘S 와 Escape 는 페이지 별 / App 레벨에서 자체 처리하므로 root div 에 핸들러 불필요.
  return (
    <div className="flex min-h-screen">
      {/* SPA 라우트 전환 시 포커스 이동 + SR 안내 + document.title 갱신 (A11y) */}
      <RouteAnnouncer />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[200] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-fg"
      >
        {t('a11y.skipToContent')}
      </a>
      <MobileMenu />
      {/* Background scrim backdrop overlay for mobile/tablet sidebar */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-scrim backdrop-blur-sm z-30 transition-opacity duration-220 animate-fade-in"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar publicMode={publicInfo?.mode ?? undefined} />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0 ml-0">
        <Header />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6 focus:outline-none"
        >
          <GlobalErrorBanner />
          {/* key on pathname so a crashed page's latched fallback resets when navigating away */}
          <ErrorBoundary key={location.pathname}>
            <Suspense
              fallback={
                <p role="status" aria-live="polite" className="text-sm text-ink-subtle">
                  loading…
                </p>
              }
            >
              <Outlet context={{ publicInfo }} />
            </Suspense>
          </ErrorBoundary>
        </main>
        <footer className="border-t border-line px-6 py-3 text-xs text-ink-subtle">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>spa-seo-gateway · open-source dynamic rendering</span>
            <nav aria-label={t('footer.legal')} className="flex flex-wrap gap-3">
              {/* 약관/방침은 내부 페이지(/terms·/privacy)가 TermsDesk 정본을 렌더 — 지원만 외부 */}
              <Link
                to="/terms"
                className="rounded hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t('footer.terms')}
              </Link>
              <Link
                to="/privacy"
                className="rounded hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t('footer.privacy')}
              </Link>
              <a
                href="https://termsdesk.vercel.app/support/spa-seo-gateway"
                target="_blank"
                rel="noreferrer"
                className="rounded hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t('footer.support')}
              </a>
            </nav>
            <a
              href="https://github.com/blue45f/spa-seo-gateway"
              target="_blank"
              rel="noreferrer"
              className="rounded hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              github
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

function GlobalErrorBanner() {
  const error = useStore((s) => s.globalError);
  const setError = useStore((s) => s.setGlobalError);
  if (!error) return null;
  return (
    <div
      role="alert"
      data-testid="global-error"
      className="alert alert--err flex items-start gap-3"
    >
      <span className="flex-1">{error}</span>
      <button
        type="button"
        onClick={() => setError('')}
        aria-label="Dismiss error"
        className="opacity-70 hover:opacity-100 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-err"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
