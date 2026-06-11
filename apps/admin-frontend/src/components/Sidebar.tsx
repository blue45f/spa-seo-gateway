import { ExternalLink, Languages, Monitor, Moon, Rows3, Rows4, Sun, X } from 'lucide-react';
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
  const themeMode = useStore((s) => s.themeMode);
  const setThemeMode = useStore((s) => s.setThemeMode);
  const density = useStore((s) => s.density);
  const toggleDensity = useStore((s) => s.toggleDensity);
  const authed = useStore((s) => s.authed);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const toggleLang = useStore((s) => s.toggleLang);
  const t = useStore((s) => s.t);
  const setAuthed = useStore((s) => s.setAuthed);
  const pushToast = useStore((s) => s.pushToast);

  const ThemeIcon = themeMode === 'system' ? Monitor : themeMode === 'dark' ? Moon : Sun;
  const DensityIcon = density === 'compact' ? Rows4 : Rows3;

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
      className={`w-60 bg-rail text-rail-ink-muted flex flex-col fixed lg:static lg:translate-x-0 inset-y-0 left-0 z-40 ${sidebarOpen ? '' : 'collapsed'}`}
    >
      <div className="px-5 py-4 border-b border-rail-line flex items-center justify-between">
        <div>
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
        <button
          type="button"
          className="lg:hidden p-1 rounded-md text-rail-ink-muted hover:text-rail-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5 text-sm overflow-y-auto" aria-label="Primary">
        {items.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.id}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={`nav-item w-full text-left px-3 py-2 min-h-[44px] lg:min-h-0 rounded-md flex items-center gap-2.5 hover:bg-rail-elev hover:text-rail-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${active ? 'active' : ''}`}
            >
              <span className="flex w-5 justify-center opacity-90" aria-hidden="true">
                <NavIcon id={item.id} className="h-[18px] w-[18px]" />
              </span>
              <span className="flex-1">{item.label}</span>
              {item.public ? (
                <span className="text-[10px] uppercase tracking-wider text-ok-rail">public</span>
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
              className="nav-item ml-auto min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 rounded text-rail-ink-muted hover:text-rail-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
          className="nav-item flex items-center gap-1.5 min-h-[44px] lg:min-h-0 rounded text-rail-ink-muted hover:text-rail-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          GitHub
        </a>
        <button
          type="button"
          className="nav-item w-full text-left text-rail-ink-muted hover:text-rail-ink flex items-center gap-2 min-h-[44px] lg:min-h-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={() =>
            setThemeMode(themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'system' : 'light')
          }
          aria-label={`Theme: ${themeMode}, click to change`}
        >
          <ThemeIcon aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          <span>{t(`theme.${themeMode}`)}</span>
        </button>
        <button
          type="button"
          className="nav-item w-full text-left text-rail-ink-muted hover:text-rail-ink flex items-center gap-2 min-h-[44px] lg:min-h-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={toggleDensity}
          aria-label={`Density: ${density}, click to toggle`}
        >
          <DensityIcon aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          <span>{density === 'compact' ? t('density.compact') : t('density.comfortable')}</span>
        </button>
        <button
          type="button"
          className="nav-item w-full text-left text-rail-ink-muted hover:text-rail-ink flex items-center gap-2 min-h-[44px] lg:min-h-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
