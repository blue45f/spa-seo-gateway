import { type FormEvent, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useStore } from '../lib/store';

export function LoginForm() {
  const t = useStore((s) => s.t);
  const setAuthed = useStore((s) => s.setAuthed);
  const pushToast = useStore((s) => s.pushToast);
  const setGlobalError = useStore((s) => s.setGlobalError);
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await api('POST', '/admin/api/login', { token: trimmed }, { publicEndpoint: true });
      setAuthed(true);
      setGlobalError('');
      setToken('');
      pushToast(t('auth.authenticated', 'authenticated'), 'success');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setGlobalError(msg);
      pushToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2" data-testid="login-form">
      <input
        type="password"
        placeholder={t('auth.token-placeholder')}
        className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm w-72"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        aria-label="admin token"
      />
      <button
        type="submit"
        disabled={submitting || !token.trim()}
        className="px-3 py-1.5 rounded bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-60"
      >
        {t('auth.login')}
      </button>
    </form>
  );
}
