import { type FormEvent, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { EmptyState } from '../components/EmptyState';
import { DetailSkeleton } from '../components/Skeleton';
import { ApiError, api } from '../lib/api';
import { confidenceColor } from '../lib/format';
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
  const [hasRun, setHasRun] = useState(false);

  async function run(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() || running) return;
    setRunning(true);
    setHasRun(true);
    setSuggestions([]);
    try {
      const r = await api<{ ok: true; suggestions: SchemaSuggestion[] }>(
        'POST',
        '/admin/api/ai/schema',
        { url: url.trim() },
      );
      setSuggestions(r.suggestions ?? []);
      if ((r.suggestions ?? []).length === 0) pushToast(t('ai.empty'), 'warn');
      else pushToast(`${r.suggestions.length} ${t('toast.ai.suggestions')}`, 'success');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
      pushToast(t('toast.ai.failed'), 'error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-4" data-testid="page-ai">
      <div className="alert alert--ok">
        <h3 className="font-semibold mb-1">{t('ai.title')}</h3>
        <p>{t('ai.desc')}</p>
      </div>

      <form onSubmit={run} className="panel p-5 space-y-3">
        <label className="block">
          <span className="text-sm font-medium">URL</span>
          <input
            type="url"
            className="input mt-1 w-full px-3 py-2 text-sm"
            placeholder="https://www.example.com/blog/post"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={running || !url.trim()}
          className="btn-primary px-4 py-2 text-sm font-medium"
        >
          {running ? t('ai.running') : t('ai.run')}
        </button>
      </form>

      {running ? (
        <DetailSkeleton rows={3} />
      ) : hasRun && suggestions.length === 0 ? (
        <EmptyState data-testid="ai-empty" title={t('ai.empty')} hint={t('ai.empty.hint')} />
      ) : (
        suggestions.map((s, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: AI suggestions are append-only and never reorder within a session
            key={`${s.type}-${i}`}
            className="panel p-3 text-sm"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="badge badge--neutral">{s.type}</span>
              <span className="text-xs text-ink-subtle">confidence:</span>
              <span className={`font-mono text-xs ${confidenceColor(s.confidence)}`}>
                {(s.confidence * 100).toFixed(0)}%
              </span>
            </div>
            {s.rationale ? (
              <div className="text-xs text-ink-muted italic mb-2">{s.rationale}</div>
            ) : null}
            <pre className="panel-inset text-xs p-2 overflow-auto">
              {JSON.stringify(s.jsonLd, null, 2)}
            </pre>
          </div>
        ))
      )}

      <div className="panel p-5 text-sm space-y-3">
        <h3 className="font-semibold mb-2 text-ink">{t('ai.setup')}</h3>
        <div>
          <div className="text-xs font-medium text-ink-muted mb-1">Anthropic Claude</div>
          <pre className="panel-inset text-xs p-3 overflow-auto">{`npm install @heejun/spa-seo-gateway-anthropic @anthropic-ai/sdk

import { setAiSchemaAdapter } from '@heejun/spa-seo-gateway-core';
import { createAnthropicSchemaAdapter } from '@heejun/spa-seo-gateway-anthropic';

setAiSchemaAdapter(createAnthropicSchemaAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-opus-4-7',
}));`}</pre>
        </div>
        <div>
          <div className="text-xs font-medium text-ink-muted mb-1">{t('ai.providers')}</div>
          <pre className="panel-inset text-xs p-3 overflow-auto">{`npm install @heejun/spa-seo-gateway-openai

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
