import { type ComponentType, lazy, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { CommandPalette } from './components/CommandPalette';
import { DialogHost } from './components/DialogHost';
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

const CHUNK_RETRY_KEY = 'seo-admin-chunk-retry';

/**
 * 동적 import 실패 시 1회 전체 새로고침 후 재시도 — 배포로 청크 해시가 바뀐 stale 탭 복구.
 * sessionStorage 가드가 새로고침 루프를 막고, 성공 로드 시 가드를 풀어 다음 배포에 대비한다.
 */
// sessionStorage 는 샌드박스 iframe / 엄격 프라이버시 모드에서 '접근 자체'가 SecurityError 를
// 던질 수 있다 — 가드를 못 읽으면 '이미 재시도함'으로 취급해 새로고침 루프를 원천 차단한다.
function hasRetryGuard(): boolean {
  try {
    return window.sessionStorage.getItem(CHUNK_RETRY_KEY) !== null;
  } catch {
    return true;
  }
}

function armRetryGuard(): boolean {
  try {
    window.sessionStorage.setItem(CHUNK_RETRY_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

function clearRetryGuard(): void {
  try {
    window.sessionStorage.removeItem(CHUNK_RETRY_KEY);
  } catch {
    // 스토리지 접근 불가 환경 — 가드 자체가 없으니 지울 것도 없다
  }
}

// biome-ignore lint/suspicious/noExplicitAny: mirrors React.lazy's own ComponentType<any> bound
function lazyRetry<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load()
      .then((module) => {
        clearRetryGuard();
        return module;
      })
      .catch((error: unknown) => {
        // 가드를 기록할 수 있을 때만 새로고침 — 기록 실패 시 reload 하면 무한 루프가 된다
        if (!hasRetryGuard() && armRetryGuard()) {
          window.location.reload();
          // 새로고침이 끼어들 때까지 Suspense fallback 유지
          return new Promise<{ default: T }>(() => {});
        }
        // 이미 한 번 새로고침한 세션 — 가드를 풀고 ErrorBoundary 로 전달
        clearRetryGuard();
        throw error;
      }),
  );
}

// Lazy: 보조/저빈도 페이지 — 초기 번들에서 분리.
const AiSchema = lazyRetry(() => import('./pages/AiSchema').then((m) => ({ default: m.AiSchema })));
const ApiExplorer = lazyRetry(() =>
  import('./pages/ApiExplorer').then((m) => ({ default: m.ApiExplorer })),
);
const AuditLog = lazyRetry(() => import('./pages/AuditLog').then((m) => ({ default: m.AuditLog })));
const Cache = lazyRetry(() => import('./pages/Cache').then((m) => ({ default: m.Cache })));
const Help = lazyRetry(() => import('./pages/Help').then((m) => ({ default: m.Help })));
const Library = lazyRetry(() => import('./pages/Library').then((m) => ({ default: m.Library })));
const Lighthouse = lazyRetry(() =>
  import('./pages/Lighthouse').then((m) => ({ default: m.Lighthouse })),
);
const Metrics = lazyRetry(() => import('./pages/Metrics').then((m) => ({ default: m.Metrics })));
const Policy = lazyRetry(() => import('./pages/Policy').then((m) => ({ default: m.Policy })));
const RenderTest = lazyRetry(() =>
  import('./pages/RenderTest').then((m) => ({ default: m.RenderTest })),
);
const SiteDetail = lazyRetry(() =>
  import('./pages/SiteDetail').then((m) => ({ default: m.SiteDetail })),
);
const Sites = lazyRetry(() => import('./pages/Sites').then((m) => ({ default: m.Sites })));
const TenantDetail = lazyRetry(() =>
  import('./pages/TenantDetail').then((m) => ({ default: m.TenantDetail })),
);
const Tenants = lazyRetry(() => import('./pages/Tenants').then((m) => ({ default: m.Tenants })));
const VisualDiff = lazyRetry(() =>
  import('./pages/VisualDiff').then((m) => ({ default: m.VisualDiff })),
);
const Warm = lazyRetry(() => import('./pages/Warm').then((m) => ({ default: m.Warm })));

export function App() {
  const setAuthed = useStore((s) => s.setAuthed);
  const setAdminEnabled = useStore((s) => s.setAdminEnabled);
  const theme = useStore((s) => s.theme);
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
        // 팔레트 열림 상태는 핸들러 내부에서 지연 조회 — 토글마다 리스너를 재구독하지 않기 위해
        if (useStore.getState().cmdPaletteOpen) closeCmd();
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
  }, [openCmd, closeCmd, openShortcuts, closeShortcuts]);

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
          <Route path="terms" element={<Policy slug="terms-of-service" />} />
          <Route path="privacy" element={<Policy slug="privacy-policy" />} />
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
        {/* useDialog() 의 confirm/prompt 요청을 네이티브 <dialog> 로 그리는 호스트 */}
        <DialogHost />
      </ErrorBoundary>
    </>
  );
}
