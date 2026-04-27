import { type FormEvent, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { api, ApiError } from '../lib/api';
import { lighthouseScoreColor } from '../lib/format';
import { useStore } from '../lib/store';
import type { LighthouseResult, LighthouseScores } from '../lib/types';

export function Lighthouse() {
  return (
    <AuthGate>
      <LighthouseBody />
    </AuthGate>
  );
}

function LighthouseBody() {
  const t = useStore((s) => s.t);
  const setError = useStore((s) => s.setGlobalError);
  const [url, setUrl] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<LighthouseResult | null>(null);

  async function run(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() || running) return;
    setRunning(true);
    setResult(null);
    try {
      const r = await api<LighthouseResult>('POST', '/admin/api/lighthouse', { url: url.trim() });
      setResult(r);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
    } finally {
      setRunning(false);
    }
  }

  const labels: Array<{ key: keyof LighthouseScores; label: string }> = [
    { key: 'performance', label: t('lighthouse.scores.performance') },
    { key: 'accessibility', label: t('lighthouse.scores.accessibility') },
    { key: 'seo', label: t('lighthouse.scores.seo') },
    { key: 'bestPractices', label: t('lighthouse.scores.bestPractices') },
  ];

  return (
    <section className="space-y-4" data-testid="page-lighthouse">
      <h2 className="font-semibold text-lg">{t('lighthouse.title')}</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        peer-installed <code>lighthouse</code> + <code>chrome-launcher</code> 가 필요합니다.
      </p>

      <form
        onSubmit={run}
        className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5 space-y-3"
      >
        <label className="block">
          <span className="text-sm font-medium">{t('lighthouse.url.label')}</span>
          <input
            type="url"
            className="mt-1 w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
            placeholder="https://www.example.com/"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={running || !url.trim()}
          className="px-4 py-2 rounded bg-slate-900 dark:bg-indigo-600 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-60"
        >
          {running ? t('btn.running') : t('lighthouse.run')}
        </button>
      </form>

      {result ? (
        <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <code className="text-sm">{result.url}</code>
              {result.cached ? (
                <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
                  {t('lighthouse.cached')}
                </span>
              ) : null}
            </div>
            <span className="text-xs text-slate-500">{result.durationMs}ms</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {labels.map((l) => (
              <div
                key={l.key}
                className="bg-slate-50 dark:bg-slate-800 rounded p-4 text-center"
              >
                <div className="text-xs text-slate-500 dark:text-slate-400">{l.label}</div>
                <div
                  className={`mt-2 text-3xl font-bold ${lighthouseScoreColor(result.scores[l.key])}`}
                >
                  {Math.round(result.scores[l.key])}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
