import { type FormEvent, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { api, ApiError } from '../lib/api';
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
      const r = await api<{ ok: true; result: VisualDiffResult }>('POST', '/admin/api/visual-diff', {
        url: url.trim(),
        mode,
        threshold,
        fullPage,
      });
      setResult(r.result);
      pushToast(
        r.result.baselineCreated
          ? 'baseline 저장됨'
          : `diff ${r.result.diffPercent.toFixed(2)}%`,
        'success',
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
      pushToast('시각 회귀 실패', 'error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-4" data-testid="page-visual">
      <div className="bg-purple-50 dark:bg-purple-950 dark:border-purple-900 border border-purple-200 rounded-lg p-4 text-sm">
        <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-1">{t('visual.title')}</h3>
        <p className="text-purple-800 dark:text-purple-300">{t('visual.desc')}</p>
      </div>

      <form
        onSubmit={run}
        className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5 space-y-3"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">{t('visual.url')}</span>
            <input
              type="url"
              className="mt-1 w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
              placeholder="https://www.example.com/"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t('visual.mode')}</span>
            <select
              className="mt-1 w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
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
              className="mt-1 w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </label>
          <div className="block">
            <span className="text-sm font-medium">{t('visual.fullPage')}</span>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
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
          className="px-4 py-2 rounded bg-slate-900 dark:bg-indigo-600 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-60"
        >
          {running ? t('visual.running') : t('visual.run')}
        </button>
      </form>

      {result ? (
        <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5 space-y-3 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-slate-50 dark:bg-slate-800 rounded p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('visual.diff')}</div>
              <div className="font-mono text-lg">{result.diffPercent.toFixed(3)}%</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('visual.diffPx')}</div>
              <div className="font-mono text-lg">{result.diffPixels}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('visual.size')}</div>
              <div className="font-mono">
                {result.width}×{result.height}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('visual.duration')}</div>
              <div className="font-mono">{result.durationMs}ms</div>
            </div>
          </div>
          {result.baselineCreated ? (
            <div className="text-xs text-emerald-600 dark:text-emerald-400">{t('visual.created')}</div>
          ) : null}
          <div className="text-xs text-slate-500 dark:text-slate-400">
            baseline path: <code>{result.baselinePath}</code>
          </div>
          {result.diffPath ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              diff path: <code>{result.diffPath}</code>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
