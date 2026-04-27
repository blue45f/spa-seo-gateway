import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { type NavItem, navItemsForLang } from '../lib/nav';
import { useStore } from '../lib/store';

type SidebarProps = {
  publicMode?: string;
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

  const items: Array<NavItem & { label: string; subtitle: string }> = navItemsForLang(lang);
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
      data-testid="sidebar"
      className={`w-60 bg-slate-900 dark:bg-black text-slate-200 flex flex-col fixed md:static md:translate-x-0 inset-y-0 left-0 z-40 ${sidebarOpen ? '' : 'collapsed'}`}
    >
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="font-bold text-white text-lg">spa-seo-gateway</div>
        <div className="text-xs text-slate-400 mt-0.5">admin console</div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5 text-sm overflow-y-auto">
        {items.map((item) => (
          <Link
            key={item.id}
            to={item.path}
            className={`nav-item w-full text-left px-3 py-2 rounded flex items-center gap-2 hover:bg-slate-800 ${isActive(item.path) ? 'active' : ''}`}
          >
            <span className="w-5 text-center">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.public ? (
              <span className="text-[10px] uppercase tracking-wider text-emerald-400">public</span>
            ) : null}
          </Link>
        ))}
      </nav>
      <div className="px-3 py-3 border-t border-slate-800 text-xs space-y-2">
        {publicMode ? (
          <div>
            <div className="text-slate-500 dark:text-slate-400">{t('mode')}</div>
            <div className="font-mono text-slate-300">{publicMode}</div>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${authed ? 'bg-emerald-400' : 'bg-slate-500'}`}
          />
          <span>{authed ? t('auth.authenticated') : t('auth.unauthenticated')}</span>
          {authed ? (
            <button
              type="button"
              className="ml-auto text-slate-500 dark:text-slate-400 hover:text-slate-300"
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
          className="text-slate-500 dark:text-slate-400 hover:text-slate-300 block"
        >
          ↗ GitHub
        </a>
        <button
          type="button"
          className="w-full text-left text-slate-500 dark:text-slate-400 hover:text-slate-300 flex items-center gap-2"
          onClick={toggleTheme}
        >
          <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span>{theme === 'dark' ? t('theme.light') : t('theme.dark')}</span>
        </button>
        <button
          type="button"
          className="w-full text-left text-slate-500 dark:text-slate-400 hover:text-slate-300 flex items-center gap-2"
          onClick={toggleLang}
          title={lang === 'ko' ? 'Switch to English' : '한국어로 전환'}
        >
          <span>🌐</span>
          <span>{lang === 'ko' ? 'English' : '한국어'}</span>
        </button>
      </div>
    </aside>
  );
}
