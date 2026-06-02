import { lazy, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { CommandPalette } from './components/CommandPalette';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { ShortcutsModal } from './components/ShortcutsModal';
import { ToastContainer } from './components/ToastContainer';
import { Tour } from './components/Tour';
import { api } from './lib/api';
import { useStore } from './lib/store';
// Eager: 자주 들어오는 페이지 + 초기 진입점 (Welcome/Dashboard/Routes).
import { Dashboard } from './pages/Dashboard';
import { NotFound } from './pages/NotFound';
import { RoutesPage } from './pages/Routes';
import { Welcome } from './pages/Welcome';

// Lazy: 보조/저빈도 페이지 — 초기 번들에서 분리.
const AiSchema = lazy(() => import('./pages/AiSchema').then((m) => ({ default: m.AiSchema })));
const ApiExplorer = lazy(() =>
  import('./pages/ApiExplorer').then((m) => ({ default: m.ApiExplorer })),
);
const AuditLog = lazy(() => import('./pages/AuditLog').then((m) => ({ default: m.AuditLog })));
const Cache = lazy(() => import('./pages/Cache').then((m) => ({ default: m.Cache })));
const Help = lazy(() => import('./pages/Help').then((m) => ({ default: m.Help })));
const Library = lazy(() => import('./pages/Library').then((m) => ({ default: m.Library })));
const Lighthouse = lazy(() =>
  import('./pages/Lighthouse').then((m) => ({ default: m.Lighthouse })),
);
const Metrics = lazy(() => import('./pages/Metrics').then((m) => ({ default: m.Metrics })));
const RenderTest = lazy(() =>
  import('./pages/RenderTest').then((m) => ({ default: m.RenderTest })),
);
const SiteDetail = lazy(() =>
  import('./pages/SiteDetail').then((m) => ({ default: m.SiteDetail })),
);
const Sites = lazy(() => import('./pages/Sites').then((m) => ({ default: m.Sites })));
const TenantDetail = lazy(() =>
  import('./pages/TenantDetail').then((m) => ({ default: m.TenantDetail })),
);
const Tenants = lazy(() => import('./pages/Tenants').then((m) => ({ default: m.Tenants })));
const VisualDiff = lazy(() =>
  import('./pages/VisualDiff').then((m) => ({ default: m.VisualDiff })),
);
const Warm = lazy(() => import('./pages/Warm').then((m) => ({ default: m.Warm })));

export function App() {
  const setAuthed = useStore((s) => s.setAuthed);
  const setAdminEnabled = useStore((s) => s.setAdminEnabled);
  const theme = useStore((s) => s.theme);
  const cmdOpen = useStore((s) => s.cmdPaletteOpen);
  const openCmd = useStore((s) => s.openCmd);
  const closeCmd = useStore((s) => s.closeCmd);
  const closeShortcuts = useStore((s) => s.closeShortcuts);
  const openShortcuts = useStore((s) => s.openShortcuts);

  // initial auth check + theme sync
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    api<{ ok: true; authenticated: boolean; adminEnabled: boolean }>(
      'GET',
      '/admin/api/whoami',
      undefined,
      { publicEndpoint: true },
    )
      .then((r) => {
        if (cancelled) return;
        setAuthed(!!r.authenticated);
        setAdminEnabled(!!r.adminEnabled);
      })
      .catch(() => {
        if (!cancelled) setAuthed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setAuthed, setAdminEnabled]);

  // global keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeCmd();
        closeShortcuts();
        return;
      }
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (cmdOpen) closeCmd();
        else openCmd();
        return;
      }
      // '?' shortcut — help modal. shift+slash or just '?' depending on layout.
      if (e.key === '?' && !meta && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        openShortcuts();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cmdOpen, openCmd, closeCmd, openShortcuts, closeShortcuts]);

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Welcome />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="routes" element={<RoutesPage />} />
          <Route path="cache" element={<Cache />} />
          <Route path="warm" element={<Warm />} />
          <Route path="test" element={<RenderTest />} />
          <Route path="metrics" element={<Metrics />} />
          <Route path="lighthouse" element={<Lighthouse />} />
          <Route path="visual" element={<VisualDiff />} />
          <Route path="ai" element={<AiSchema />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="sites" element={<Sites />} />
          <Route path="sites/:id" element={<SiteDetail />} />
          <Route path="tenants" element={<Tenants />} />
          <Route path="tenants/:id" element={<TenantDetail />} />
          <Route path="api" element={<ApiExplorer />} />
          <Route path="library" element={<Library />} />
          <Route path="help" element={<Help />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      {/* 보조 chrome — 오버레이 렌더 throw 가 SPA 전체를 white-screen 하지 않게 격리.
          기본 alert fallback 은 본문 하단에 떠 거슬리므로, 보조 UI 는 조용히 사라지게(null) 두고
          크래시는 componentDidCatch 가 콘솔에 남긴다. 새로고침하면 복구. */}
      <ErrorBoundary fallback={() => null}>
        <CommandPalette />
        <ShortcutsModal />
        <Tour />
        <ToastContainer />
      </ErrorBoundary>
    </>
  );
}
