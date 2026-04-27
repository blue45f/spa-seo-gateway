import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthGate } from '../components/AuthGate';
import { RoutesEditor } from '../components/RoutesEditor';
import { api, ApiError } from '../lib/api';
import { useStore } from '../lib/store';
import type { ScopedRoute, Site } from '../lib/types';

export function SiteDetail() {
  return (
    <AuthGate>
      <SiteDetailBody />
    </AuthGate>
  );
}

function SiteDetailBody() {
  const params = useParams();
  const id = params.id ?? '';
  const t = useStore((s) => s.t);
  const setError = useStore((s) => s.setGlobalError);
  const pushToast = useStore((s) => s.pushToast);
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMissing(false);
    try {
      const r = await api<{ ok: true; sites: Site[] }>('GET', '/admin/api/sites');
      const found = (r.sites ?? []).find((s) => s.id === id);
      if (!found) setMissing(true);
      else setSite(found);
      setError('');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id, setError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!site) return;
    setSaving(true);
    try {
      const cleaned = {
        ...site,
        routes: site.routes
          .filter((r) => r.pattern)
          .map((r) => ({
            pattern: r.pattern,
            ...(r.ttlMs ? { ttlMs: Number(r.ttlMs) } : {}),
            ...(r.waitUntil ? { waitUntil: r.waitUntil } : {}),
            ...(r.waitSelector ? { waitSelector: r.waitSelector } : {}),
            ...(r.waitMs ? { waitMs: Number(r.waitMs) } : {}),
            ...(r.ignore ? { ignore: true } : {}),
          })),
      };
      await api('POST', '/admin/api/sites', cleaned);
      pushToast(`사이트 저장됨: ${site.id}`, 'success');
      await load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      pushToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  // ⌘/Ctrl + S 저장
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (site && !saving) void save();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // save 는 site 의 클로저에 의존 — site/saving 변할 때마다 핸들러 갱신
  }, [site, saving]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p className="text-sm text-slate-500">loading...</p>;
  if (missing) {
    return (
      <section className="space-y-4" data-testid="page-site-detail">
        <Link to="/sites" className="text-sm text-indigo-600 hover:underline">
          {t('sites.detail.back')}
        </Link>
        <p className="text-sm text-slate-500">{t('sites.detail.notFound')}</p>
      </section>
    );
  }
  if (!site) return null;

  return (
    <section className="space-y-4" data-testid="page-site-detail">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link to="/sites" className="text-sm text-indigo-600 hover:underline">
          {t('sites.detail.back')}
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm"
            onClick={load}
          >
            {t('btn.refresh')}
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium disabled:opacity-60"
            onClick={save}
            disabled={saving}
          >
            {saving ? t('btn.running') : t('sites.form.save')}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5 space-y-3">
        <h3 className="font-semibold">{t('sites.detail.metadata')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Field label={t('sites.form.id')}>
            <input
              type="text"
              disabled
              value={site.id}
              className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs opacity-70"
            />
          </Field>
          <Field label={t('sites.form.name')}>
            <input
              type="text"
              value={site.name}
              onChange={(e) => setSite({ ...site, name: e.target.value })}
              className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            />
          </Field>
          <Field label={t('sites.form.origin')}>
            <input
              type="url"
              value={site.origin}
              onChange={(e) => setSite({ ...site, origin: e.target.value })}
              className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            />
          </Field>
          <Field label={t('sites.form.webhookRender')}>
            <input
              type="url"
              value={site.webhooks?.onRender ?? ''}
              onChange={(e) =>
                setSite({
                  ...site,
                  webhooks: { ...(site.webhooks ?? {}), onRender: e.target.value || undefined },
                })
              }
              className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            />
          </Field>
          <Field label={t('sites.form.webhookError')}>
            <input
              type="url"
              value={site.webhooks?.onError ?? ''}
              onChange={(e) =>
                setSite({
                  ...site,
                  webhooks: { ...(site.webhooks ?? {}), onError: e.target.value || undefined },
                })
              }
              className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            />
          </Field>
          <label className="flex items-center gap-2 mt-6 text-sm">
            <input
              type="checkbox"
              checked={site.enabled}
              onChange={(e) => setSite({ ...site, enabled: e.target.checked })}
            />
            {t('sites.form.enabled')}
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5 space-y-3">
        <h3 className="font-semibold">{t('sites.detail.routes')}</h3>
        <RoutesEditor
          routes={site.routes}
          onChange={(routes: ScopedRoute[]) => setSite({ ...site, routes })}
        />
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
