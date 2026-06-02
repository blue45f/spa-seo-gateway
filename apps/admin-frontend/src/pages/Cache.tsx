import { type FormEvent, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { ApiError, api } from '../lib/api';
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
      pushToast(t('toast.url.invalidated'), 'success');
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
      <h2 className="text-lg font-semibold tracking-tight text-ink">{t('cache.title')}</h2>

      <div className="panel p-5 space-y-3">
        <h3 className="font-semibold text-ink">{t('cache.invalidate.label')}</h3>
        <form onSubmit={invalidate} className="flex flex-wrap gap-2">
          <input
            type="url"
            className="input flex-1 min-w-64 px-3 py-2 text-sm"
            placeholder="https://www.example.com/posts/1"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="btn-primary px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {t('btn.invalidate')}
          </button>
        </form>
      </div>

      <div className="panel p-5 space-y-3">
        <h3 className="font-semibold text-ink">{t('cache.clear.label')}</h3>
        <p className="text-sm text-ink-muted">
          배포 후 또는 대규모 데이터 변경 시 사용. 다음 요청부터는 cold render.
        </p>
        <button
          type="button"
          disabled={busy}
          className="btn-danger px-4 py-2 text-sm font-medium disabled:opacity-60"
          onClick={clearAll}
        >
          {t('btn.clear-all')}
        </button>
      </div>

      {lastResult ? <div className="alert alert--ok">{lastResult}</div> : null}
    </section>
  );
}
