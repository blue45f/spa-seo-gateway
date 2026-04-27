import { type FormEvent, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { api, ApiError } from '../lib/api';
import { bytesToHuman } from '../lib/format';
import { useStore } from '../lib/store';
import type { RenderTestResult } from '../lib/types';

const BOT_UAS = [
  {
    name: 'Googlebot (데스크톱)',
    value: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  },
  {
    name: 'Googlebot (모바일)',
    value:
      'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  },
  { name: 'Bingbot', value: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' },
  { name: 'Naver Yeti', value: 'Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)' },
  { name: 'Twitterbot', value: 'Twitterbot/1.0' },
  { name: 'facebookexternalhit', value: 'facebookexternalhit/1.1' },
  { name: 'Slackbot', value: 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)' },
  { name: 'KakaoTalk', value: 'kakaotalk-scrap/1.0' },
];

export function RenderTest() {
  return (
    <AuthGate>
      <RenderTestBody />
    </AuthGate>
  );
}

function RenderTestBody() {
  const t = useStore((s) => s.t);
  const pushToast = useStore((s) => s.pushToast);
  const setError = useStore((s) => s.setGlobalError);
  const [url, setUrl] = useState('');
  const [ua, setUa] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RenderTestResult | null>(null);

  async function run(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() || running) return;
    setRunning(true);
    setResult(null);
    try {
      const r = await api<RenderTestResult>('POST', '/admin/api/render-test', {
        url: url.trim(),
        ua: ua.trim() || undefined,
      });
      setResult(r);
      pushToast(`${r.status} · ${r.durationMs}ms · ${bytesToHuman(r.bytes)}`, 'success');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
      pushToast(msg, 'error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-4" data-testid="page-test">
      <h2 className="font-semibold text-lg">{t('test.title')}</h2>

      <form
        onSubmit={run}
        className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5 space-y-3"
      >
        <label className="block">
          <span className="text-sm font-medium">{t('test.url.label')}</span>
          <input
            type="url"
            className="mt-1 w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
            placeholder="https://www.example.com/blog/post"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t('test.ua.label')}</span>
          <input
            type="text"
            className="mt-1 w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm font-mono text-xs"
            value={ua}
            onChange={(e) => setUa(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {BOT_UAS.map((b) => (
            <button
              key={b.name}
              type="button"
              className="px-2 py-1 rounded text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
              onClick={() => setUa(b.value)}
            >
              {b.name}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={running || !url.trim()}
          className="px-4 py-2 rounded bg-slate-900 dark:bg-indigo-600 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-60"
        >
          {running ? t('btn.running') : t('test.run')}
        </button>
      </form>

      {result ? (
        <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="bg-slate-50 dark:bg-slate-800 rounded p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">status</div>
              <div className="font-mono text-lg">{result.status}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">duration</div>
              <div className="font-mono text-lg">{result.durationMs}ms</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">bytes</div>
              <div className="font-mono text-lg">{bytesToHuman(result.bytes)}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">x-cache</div>
              <div className="font-mono text-lg">{result.headers['x-cache'] ?? '-'}</div>
            </div>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold">응답 헤더</summary>
            <pre className="mt-2 text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded overflow-auto">
              {JSON.stringify(result.headers, null, 2)}
            </pre>
          </details>
          <details className="text-sm" open>
            <summary className="cursor-pointer font-semibold">{t('test.preview')}</summary>
            <pre className="mt-2 text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded overflow-auto max-h-96">
              {result.bodyPreview}
            </pre>
          </details>
        </div>
      ) : null}
    </section>
  );
}
