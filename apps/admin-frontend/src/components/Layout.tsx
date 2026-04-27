import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import type { PublicInfo } from '../lib/types';
import { Header } from './Header';
import { MobileMenu } from './MobileMenu';
import { Sidebar } from './Sidebar';

export function Layout() {
  const publicInfo = useStore((s) => s.publicInfo);
  const setPublicInfo = useStore((s) => s.setPublicInfo);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const location = useLocation();

  // 라우트 변경 시 모바일 사이드바 닫기 — UX 일관성
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

  return (
    <div
      className="flex min-h-screen"
      onKeyDown={(e) => {
        // ⌘S 는 페이지 별로 자체 처리. 여기서는 막지 않음.
        if (e.key === 'Escape') {
          // close palette/shortcuts handled at App level
        }
      }}
    >
      <MobileMenu />
      <Sidebar publicMode={publicInfo?.mode ?? undefined} />
      <div className="flex-1 flex flex-col min-w-0 md:ml-0 ml-0">
        <Header />
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
          <GlobalErrorBanner />
          <Outlet context={{ publicInfo }} />
        </main>
        <footer className="border-t border-slate-200 px-6 py-3 text-xs text-slate-500 dark:text-slate-400 flex justify-between bg-white dark:bg-slate-900 dark:border-slate-800">
          <span>spa-seo-gateway · open-source dynamic rendering</span>
          <a
            href="https://github.com/blue45f/spa-seo-gateway"
            target="_blank"
            rel="noreferrer"
            className="hover:text-slate-700 dark:text-slate-200"
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
    <div className="bg-red-50 border border-red-200 text-red-800 rounded px-4 py-3 text-sm flex items-start gap-3">
      <span className="flex-1">{error}</span>
      <button type="button" onClick={() => setError('')} className="opacity-70 hover:opacity-100">
        ×
      </button>
    </div>
  );
}
