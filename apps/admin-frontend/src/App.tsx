import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { CommandPalette } from './components/CommandPalette';
import { Layout } from './components/Layout';
import { ShortcutsModal } from './components/ShortcutsModal';
import { ToastContainer } from './components/ToastContainer';
import { Tour } from './components/Tour';
import { api } from './lib/api';
import { useStore } from './lib/store';
import { AiSchema } from './pages/AiSchema';
import { ApiExplorer } from './pages/ApiExplorer';
import { AuditLog } from './pages/AuditLog';
import { Cache } from './pages/Cache';
import { Dashboard } from './pages/Dashboard';
import { Help } from './pages/Help';
import { Library } from './pages/Library';
import { Lighthouse } from './pages/Lighthouse';
import { Metrics } from './pages/Metrics';
import { RenderTest } from './pages/RenderTest';
import { RoutesPage } from './pages/Routes';
import { SiteDetail } from './pages/SiteDetail';
import { Sites } from './pages/Sites';
import { TenantDetail } from './pages/TenantDetail';
import { Tenants } from './pages/Tenants';
import { VisualDiff } from './pages/VisualDiff';
import { Warm } from './pages/Warm';
import { Welcome } from './pages/Welcome';

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
          <Route path="*" element={<Welcome />} />
        </Route>
      </Routes>
      <CommandPalette />
      <ShortcutsModal />
      <Tour />
      <ToastContainer />
    </>
  );
}
