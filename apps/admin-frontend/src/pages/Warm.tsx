import { type FormEvent, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { api, ApiError } from '../lib/api';
import { useStore } from '../lib/store';
import type { WarmReport } from '../lib/types';

export function Warm() {
  return (
    <AuthGate>
      <WarmBody />
    </AuthGate>
  );
}

function WarmBody() {
  const t = useStore((s) => s.t);
  const pushToast = useStore((s) => s.pushToast);
  const setError = useStore((s) => s.setGlobalError);
  const [sitemap, setSitemap] = useState('');
  const [max, setMax] = useState(1000);
  const [concurrency, setConcurrency] = useState(4);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<WarmReport | null>(null);

  async function run(e: FormEvent) {
    e.preventDefault();
    if (!sitemap.trim() || running) return;
    setRunning(true);
    setReport(null);
    try {
      const r = await api<{ ok: true; report: WarmReport }>('POST', '/admin/api/warm', {
        sitemap: sitemap.trim(),
        max,
        concurrency,
      });
      setReport(r.report);
      pushToast(`워밍 완료: ${r.report.warmed} OK / ${r.report.errors} fail`, 'success');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
      pushToast(msg, 'error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-4" data-testid="page-warm">
      <h2 className="font-semibold text-lg">{t('warm.title')}</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        sitemap.xml URL 입력 → 재귀 sitemap-index 파싱 + 동시 N개 워밍. cold start 제거에 효과적.
      </p>

      <form
        onSubmit={run}
        className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5 space-y-3"
      >
        <label className="block">
          <span className="text-sm font-medium">{t('warm.sitemap.label')}</span>
          <input
            type="url"
            className="mt-1 w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
            placeholder="https://www.example.com/sitemap.xml"
            value={sitemap}
            onChange={(e) => setSitemap(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">{t('warm.max.label')}</span>
            <input
              type="number"
              min={1}
              className="mt-1 w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
              value={max}
              onChange={(e) => setMax(Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t('warm.concurrency.label')}</span>
            <input
              type="number"
              min={1}
              max={32}
              className="mt-1 w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={running || !sitemap.trim()}
          className="px-4 py-2 rounded bg-slate-900 dark:bg-indigo-600 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-60"
        >
          {running ? t('btn.running') : t('warm.run')}
        </button>
      </form>

      {report ? (
        <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5 text-sm">
          <h3 className="font-semibold mb-3">결과</h3>
          <dl className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat k="found" v={String(report.found)} />
            <Stat k="warmed" v={String(report.warmed)} />
            <Stat k="skipped" v={String(report.skipped)} />
            <Stat k="errors" v={String(report.errors)} />
            <Stat k="durationMs" v={String(report.durationMs)} />
          </dl>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-3 truncate">
            sitemap: <code>{report.sitemap}</code>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded p-3">
      <div className="text-xs text-slate-500 dark:text-slate-400">{k}</div>
      <div className="font-mono text-lg">{v}</div>
    </div>
  );
}
