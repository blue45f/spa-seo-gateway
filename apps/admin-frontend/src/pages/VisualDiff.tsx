import { CircleCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { ApiError, api } from '../lib/api';
import { useStore } from '../lib/store';
import type { VisualDiffResult } from '../lib/types';

export function VisualDiff() {
  return (
    <AuthGate>
      <VisualDiffBody />
    </AuthGate>
  );
}

type Mode = 'auto' | 'create' | 'compare';

function VisualDiffBody() {
  const t = useStore((s) => s.t);
  const pushToast = useStore((s) => s.pushToast);
  const setError = useStore((s) => s.setGlobalError);
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<Mode>('auto');
  const [threshold, setThreshold] = useState(0.1);
  const [fullPage, setFullPage] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<VisualDiffResult | null>(null);

  async function run(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() || running) return;
    setRunning(true);
    setResult(null);
    try {
      const r = await api<{ ok: true; result: VisualDiffResult }>(
        'POST',
        '/admin/api/visual-diff',
        {
          url: url.trim(),
          mode,
          threshold,
          fullPage,
        },
      );
      setResult(r.result);
      pushToast(
        r.result.baselineCreated ? t('visual.created') : `diff ${r.result.diffPercent.toFixed(2)}%`,
        'success',
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
      pushToast(t('toast.visual.failed'), 'error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-4" data-testid="page-visual">
      <div className="alert alert--info">
        <h3 className="font-semibold text-ink mb-1">{t('visual.title')}</h3>
        <p className="text-ink-muted">{t('visual.desc')}</p>
      </div>

      <form onSubmit={run} className="panel p-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">{t('visual.url')}</span>
            <input
              type="url"
              className="input mt-1 w-full px-3 py-2 text-sm"
              placeholder="https://www.example.com/"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t('visual.mode')}</span>
            <select
              className="input mt-1 w-full px-3 py-2 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
            >
              <option value="auto">{t('visual.mode.auto')}</option>
              <option value="create">{t('visual.mode.create')}</option>
              <option value="compare">{t('visual.mode.compare')}</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t('visual.threshold')}</span>
            <input
              type="number"
              step={0.01}
              min={0}
              max={1}
              className="input mt-1 w-full px-3 py-2 text-sm"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </label>
          <div className="block">
            <span className="text-sm font-medium">{t('visual.fullPage')}</span>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="checkbox h-4 w-4"
                aria-label="fullPage"
                checked={fullPage}
                onChange={(e) => setFullPage(e.target.checked)}
              />{' '}
              fullPage
            </label>
          </div>
        </div>
        <button
          type="submit"
          disabled={running || !url.trim()}
          className="btn-primary px-4 py-2 text-sm font-medium"
        >
          {running ? t('visual.running') : t('visual.run')}
        </button>
      </form>

      {result ? (
        <div className="panel p-5 space-y-3 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="panel-inset p-3">
              <div className="text-xs text-ink-subtle">{t('visual.diff')}</div>
              <div className="font-mono text-lg">{result.diffPercent.toFixed(3)}%</div>
            </div>
            <div className="panel-inset p-3">
              <div className="text-xs text-ink-subtle">{t('visual.diffPx')}</div>
              <div className="font-mono text-lg">{result.diffPixels}</div>
            </div>
            <div className="panel-inset p-3">
              <div className="text-xs text-ink-subtle">{t('visual.size')}</div>
              <div className="font-mono">
                {result.width}×{result.height}
              </div>
            </div>
            <div className="panel-inset p-3">
              <div className="text-xs text-ink-subtle">{t('visual.duration')}</div>
              <div className="font-mono">{result.durationMs}ms</div>
            </div>
          </div>
          {result.baselineCreated ? (
            <div className="inline-flex items-center gap-1.5 text-xs text-ok-fg">
              <CircleCheck className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              {t('visual.created')}
            </div>
          ) : null}
          <div className="text-xs text-ink-subtle">
            baseline path: <code>{result.baselinePath}</code>
          </div>
          {result.diffPath ? (
            <div className="text-xs text-ink-subtle">
              diff path: <code>{result.diffPath}</code>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
