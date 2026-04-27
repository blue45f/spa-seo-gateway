import { type FormEvent, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { api, ApiError } from '../lib/api';
import { useStore } from '../lib/store';

export function Cache() {
  return (
    <AuthGate>
      <CacheBody />
    </AuthGate>
  );
}

function CacheBody() {
  const t = useStore((s) => s.t);
  const pushToast = useStore((s) => s.pushToast);
  const setError = useStore((s) => s.setGlobalError);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState('');

  async function invalidate(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    try {
      const r = await api<{ ok: true; key: string }>('POST', '/admin/api/cache/invalidate', {
        url: url.trim(),
      });
      setLastResult(`삭제됨: key=${r.key}`);
      pushToast(`URL 무효화 완료`, 'success');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
      pushToast(msg, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (!confirm(t('cache.clear.confirm'))) return;
    setBusy(true);
    try {
      const r = await api<{ ok: true; cleared: number }>('POST', '/admin/api/cache/clear');
      setLastResult(`${t('cache.cleared')} (${r.cleared} entries)`);
      pushToast(t('cache.cleared'), 'success');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
      pushToast(msg, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4" data-testid="page-cache">
      <h2 className="font-semibold text-lg">{t('cache.title')}</h2>

      <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5 space-y-3">
        <h3 className="font-semibold">{t('cache.invalidate.label')}</h3>
        <form onSubmit={invalidate} className="flex flex-wrap gap-2">
          <input
            type="url"
            className="flex-1 min-w-64 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
            placeholder="https://www.example.com/posts/1"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="px-4 py-2 rounded bg-slate-900 dark:bg-indigo-600 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-60"
          >
            {t('btn.invalidate')}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5 space-y-3">
        <h3 className="font-semibold">{t('cache.clear.label')}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          배포 후 또는 대규모 데이터 변경 시 사용. 다음 요청부터는 cold render.
        </p>
        <button
          type="button"
          disabled={busy}
          className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-60"
          onClick={clearAll}
        >
          {t('btn.clear-all')}
        </button>
      </div>

      {lastResult ? (
        <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 rounded px-3 py-2 text-sm">
          {lastResult}
        </div>
      ) : null}
    </section>
  );
}
