import { Languages, Moon, Sun } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { type GatewayMode, type NavItem, navItemsForLang } from '../lib/nav';
import { useStore } from '../lib/store';
import { NavIcon } from './NavIcon';

type SidebarProps = {
  publicMode?: GatewayMode;
};

export function Sidebar({ publicMode }: SidebarProps) {
  const lang = useStore((s) => s.lang);
  const theme = useStore((s) => s.theme);
  const authed = useStore((s) => s.authed);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const toggleLang = useStore((s) => s.toggleLang);
  const t = useStore((s) => s.t);
  const setAuthed = useStore((s) => s.setAuthed);
  const pushToast = useStore((s) => s.pushToast);

  const items: Array<NavItem & { label: string; subtitle: string }> = navItemsForLang(
    lang,
    publicMode,
  );
  const location = useLocation();

  function isActive(path: string) {
    if (path === '/') return location.pathname === '/' || location.pathname === '';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }

  async function logout() {
    try {
      await api('POST', '/admin/api/logout', undefined, { publicEndpoint: true });
    } catch {
      // ignore — best effort
    }
    setAuthed(false);
    pushToast(t('auth.logout', 'logged out'), 'info');
  }

  return (
    <aside
      id="primary-sidebar"
      data-testid="sidebar"
      className={`w-60 bg-rail text-rail-ink-muted flex flex-col fixed md:static md:translate-x-0 inset-y-0 left-0 z-40 ${sidebarOpen ? '' : 'collapsed'}`}
    >
      <div className="px-5 py-4 border-b border-rail-line">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="h-4 w-1 rounded-full bg-accent" />
          <span className="font-semibold tracking-tight text-rail-ink text-[15px]">
            spa-seo-gateway
          </span>
        </div>
        <div className="text-[11px] uppercase tracking-[0.16em] text-rail-ink-muted mt-1 pl-3">
          admin console
        </div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5 text-sm overflow-y-auto" aria-label="Primary">
        {items.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.id}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={`nav-item w-full text-left px-3 py-2 rounded-md flex items-center gap-2.5 hover:bg-rail-elev hover:text-rail-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${active ? 'active' : ''}`}
            >
              <span className="flex w-5 justify-center opacity-90" aria-hidden="true">
                <NavIcon id={item.id} className="h-[18px] w-[18px]" />
              </span>
              <span className="flex-1">{item.label}</span>
              {item.public ? (
                <span className="text-[10px] uppercase tracking-wider text-ok">public</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-3 border-t border-rail-line text-xs space-y-2.5">
        {publicMode ? (
          <div className="flex items-baseline justify-between">
            <span className="uppercase tracking-[0.12em] text-[10px] text-rail-ink-muted">
              {t('mode')}
            </span>
            <span className="font-mono text-rail-ink">{publicMode}</span>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${authed ? 'bg-ok shadow-[0_0_0_3px_var(--color-ok-bg)]' : 'bg-rail-ink-muted'}`}
          />
          <span>{authed ? t('auth.authenticated') : t('auth.unauthenticated')}</span>
          {authed ? (
            <button
              type="button"
              className="ml-auto rounded text-rail-ink-muted hover:text-rail-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={logout}
            >
              {t('auth.logout')}
            </button>
          ) : null}
        </div>
        <a
          href="https://github.com/blue45f/spa-seo-gateway"
          target="_blank"
          rel="noreferrer"
          className="block rounded text-rail-ink-muted hover:text-rail-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          ↗ GitHub
        </a>
        <button
          type="button"
          className="w-full text-left text-rail-ink-muted hover:text-rail-ink flex items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? (
            <Sun aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <Moon aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          )}
          <span>{theme === 'dark' ? t('theme.light') : t('theme.dark')}</span>
        </button>
        <button
          type="button"
          className="w-full text-left text-rail-ink-muted hover:text-rail-ink flex items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={toggleLang}
          title={lang === 'ko' ? 'Switch to English' : '한국어로 전환'}
          aria-label={lang === 'ko' ? 'Switch to English' : 'Switch to Korean'}
        >
          <Languages aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          <span>{lang === 'ko' ? 'English' : '한국어'}</span>
        </button>
      </div>
    </aside>
  );
}
