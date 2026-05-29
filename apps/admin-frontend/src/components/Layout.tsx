import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import type { PublicInfo } from '../lib/types';
import { ErrorBoundary } from './ErrorBoundary';
import { Header } from './Header';
import { MobileMenu } from './MobileMenu';
import { Sidebar } from './Sidebar';

export function Layout() {
  const publicInfo = useStore((s) => s.publicInfo);
  const setPublicInfo = useStore((s) => s.setPublicInfo);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const location = useLocation();

  // 라우트 변경 시 모바일 사이드바 닫기 — UX 일관성
  // biome-ignore lint/correctness/useExhaustiveDependencies: location.pathname triggers the effect on every route change
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
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
      <MobileMenu />
      <Sidebar publicMode={publicInfo?.mode ?? undefined} />
      <div className="flex-1 flex flex-col min-w-0 md:ml-0 ml-0">
        <Header />
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
          <GlobalErrorBanner />
          <ErrorBoundary>
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
        <footer className="border-t border-line px-6 py-3 text-xs text-ink-subtle flex justify-between bg-panel">
          <span>spa-seo-gateway · open-source dynamic rendering</span>
          <a
            href="https://github.com/blue45f/spa-seo-gateway"
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink"
          >
            github
          </a>
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
      className="bg-err-bg border border-err text-err-fg rounded-lg px-4 py-3 text-sm flex items-start gap-3"
    >
      <span className="flex-1">{error}</span>
      <button
        type="button"
        onClick={() => setError('')}
        aria-label="Dismiss error"
        className="opacity-70 hover:opacity-100 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-err"
      >
        ×
      </button>
    </div>
  );
}
