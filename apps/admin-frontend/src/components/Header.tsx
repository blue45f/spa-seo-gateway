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
    <header className="bg-panel border-b border-line px-6 py-3 flex items-center justify-between gap-4 pl-16 md:pl-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink truncate">
          {item ? t(item.labelKey) : ''}
        </h1>
        <p className="text-xs text-ink-subtle truncate">{item ? t(item.subtitleKey) : ''}</p>
      </div>
      {showLogin ? <LoginForm /> : null}
      {authed ? (
        <button type="button" className="btn-ghost shrink-0 px-3 py-1.5 text-sm" onClick={logout}>
          {t('auth.logout')}
        </button>
      ) : null}
    </header>
  );
}
