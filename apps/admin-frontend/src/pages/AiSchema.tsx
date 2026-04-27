import { type FormEvent, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { api, ApiError } from '../lib/api';
import { useStore } from '../lib/store';
import type { SchemaSuggestion } from '../lib/types';

export function AiSchema() {
  return (
    <AuthGate>
      <AiSchemaBody />
    </AuthGate>
  );
}

function AiSchemaBody() {
  const t = useStore((s) => s.t);
  const pushToast = useStore((s) => s.pushToast);
  const setError = useStore((s) => s.setGlobalError);
  const [url, setUrl] = useState('');
  const [running, setRunning] = useState(false);
  const [suggestions, setSuggestions] = useState<SchemaSuggestion[]>([]);

  async function run(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() || running) return;
    setRunning(true);
    setSuggestions([]);
    try {
      const r = await api<{ ok: true; suggestions: SchemaSuggestion[] }>(
        'POST',
        '/admin/api/ai/schema',
        { url: url.trim() },
      );
      setSuggestions(r.suggestions ?? []);
      if ((r.suggestions ?? []).length === 0) pushToast(t('ai.empty'), 'warn');
      else pushToast(`${r.suggestions.length}개 schema 제안`, 'success');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
      pushToast('AI schema 실패 — 어댑터 설정 확인', 'error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-4" data-testid="page-ai">
      <div className="bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-900 border border-emerald-200 rounded-lg p-4 text-sm">
        <h3 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">{t('ai.title')}</h3>
        <p className="text-emerald-800 dark:text-emerald-300">{t('ai.desc')}</p>
      </div>

      <form
        onSubmit={run}
        className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5 space-y-3"
      >
        <label className="block">
          <span className="text-sm font-medium">URL</span>
          <input
            type="url"
            className="mt-1 w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
            placeholder="https://www.example.com/blog/post"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={running || !url.trim()}
          className="px-4 py-2 rounded bg-slate-900 dark:bg-indigo-600 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-60"
        >
          {running ? t('ai.running') : t('ai.run')}
        </button>
      </form>

      {suggestions.map((s, i) => (
        <div
          key={`${s.type}-${i}`}
          className="border border-slate-200 dark:border-slate-700 rounded p-3 text-sm"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-medium">
              {s.type}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">confidence:</span>
            <span className="font-mono text-xs">{(s.confidence * 100).toFixed(0)}%</span>
          </div>
          {s.rationale ? (
            <div className="text-xs text-slate-600 dark:text-slate-300 italic mb-2">
              {s.rationale}
            </div>
          ) : null}
          <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-2 rounded overflow-auto">
            {JSON.stringify(s.jsonLd, null, 2)}
          </pre>
        </div>
      ))}

      <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5 text-sm space-y-3">
        <h3 className="font-semibold mb-2">{t('ai.setup')}</h3>
        <div>
          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Anthropic Claude
          </div>
          <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded overflow-auto">{`npm install @heejun/spa-seo-gateway-anthropic @anthropic-ai/sdk

import { setAiSchemaAdapter } from '@heejun/spa-seo-gateway-core';
import { createAnthropicSchemaAdapter } from '@heejun/spa-seo-gateway-anthropic';

setAiSchemaAdapter(createAnthropicSchemaAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-opus-4-7',
}));`}</pre>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            OpenAI / Groq / Ollama (호환 엔드포인트)
          </div>
          <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded overflow-auto">{`npm install @heejun/spa-seo-gateway-openai

import { createOpenAiSchemaAdapter } from '@heejun/spa-seo-gateway-openai';

setAiSchemaAdapter(createOpenAiSchemaAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
}));

// 또는 Ollama 로컬 (apiKey 불필요)
setAiSchemaAdapter(createOpenAiSchemaAdapter({
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama3.2',
}));`}</pre>
        </div>
      </div>
    </section>
  );
}
