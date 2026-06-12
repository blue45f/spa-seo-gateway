import { type FormEvent, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { api, errorMessage } from '../lib/api';
import { useDialog } from '../lib/dialog';
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
  const { confirm } = useDialog();
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
      const msg = errorMessage(e);
      setError(msg);
      pushToast(msg, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    const ok = await confirm({
      title: t('cache.clear.confirm.title'),
      description: t('cache.clear.confirm.desc'),
      confirmLabel: t('btn.clear-all'),
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api<{ ok: true; cleared: number }>('POST', '/admin/api/cache/clear');
      setLastResult(`${t('cache.cleared')} (${r.cleared} entries)`);
      pushToast(t('cache.cleared'), 'success');
    } catch (e) {
      const msg = errorMessage(e);
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
            className="btn-primary px-4 py-2 text-sm font-medium"
          >
            {t('btn.invalidate')}
          </button>
        </form>
      </div>

      <div className="panel p-5 space-y-3">
        <h3 className="font-semibold text-ink">{t('cache.clear.label')}</h3>
        <p className="text-sm text-ink-muted">{t('cache.clear.desc')}</p>
        <button
          type="button"
          disabled={busy}
          className="btn-danger px-4 py-2 text-sm font-medium"
          onClick={clearAll}
        >
          {t('btn.clear-all')}
        </button>
      </div>

      {/* 마지막 작업 결과 — 명시적 액션 1회에만 갱신되는 polite 라이브 영역(자동 폴링 없음).
          라벨 + tabular-nums 로 키/카운트가 계기처럼 읽힌다.
          (즉시성 높은 성공/실패 알림은 토스트가 assertive/polite 로 별도 운반) */}
      <div role="status" aria-live="polite" aria-atomic="true">
        {lastResult ? (
          <div className="alert alert--ok flex items-baseline gap-2">
            <span className="text-[11px] uppercase tracking-[0.12em] opacity-70 shrink-0">
              {t('cache.lastResult')}
            </span>
            <span className="text-sm break-all" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {lastResult}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
