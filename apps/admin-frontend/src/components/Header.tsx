import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { findNavItemByPath, requiresAuth } from '../lib/nav';
import { useStore } from '../lib/store';
import { LoginForm } from './LoginForm';

export function Header() {
  const location = useLocation();
  const t = useStore((s) => s.t);
  const authed = useStore((s) => s.authed);
  const setAuthed = useStore((s) => s.setAuthed);
  const pushToast = useStore((s) => s.pushToast);

  const item = findNavItemByPath(location.pathname);
  const tabId = item?.id ?? 'welcome';
  const needsAuth = requiresAuth(tabId);
  const showLogin = !authed && needsAuth;

  async function logout() {
    try {
      await api('POST', '/admin/api/logout', undefined, { publicEndpoint: true });
    } catch {
      // ignore
    }
    setAuthed(false);
    pushToast('logged out', 'info');
  }

  return (
    <header className="bg-white dark:bg-slate-900 dark:border-slate-800 border-b border-slate-200 px-6 py-3 flex items-center justify-between pl-16 md:pl-6">
      <div>
        <h1 className="font-semibold">{item ? t(item.labelKey) : ''}</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {item ? t(item.subtitleKey) : ''}
        </p>
      </div>
      {showLogin ? <LoginForm /> : null}
      {authed ? (
        <button
          type="button"
          className="px-3 py-1.5 text-sm rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
          onClick={logout}
        >
          {t('auth.logout')}
        </button>
      ) : null}
    </header>
  );
}
