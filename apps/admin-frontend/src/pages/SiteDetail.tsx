import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthGate } from '../components/AuthGate';
import { EmptyState } from '../components/EmptyState';
import { Field } from '../components/Field';
import { RoutesEditor } from '../components/RoutesEditor';
import { DetailSkeleton } from '../components/Skeleton';
import { api, errorMessage } from '../lib/api';
import { cleanRoutes } from '../lib/routes';
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

  const ctrlRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    // 이전 요청 취소 — /sites/A → /sites/B 네비게이션 시 A 응답이 B 를 덮어쓰지 않게.
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setLoading(true);
    setMissing(false);
    try {
      const r = await api<{ ok: true; sites: Site[] }>('GET', '/admin/api/sites', undefined, {
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      const found = (r.sites ?? []).find((s) => s.id === id);
      if (!found) setMissing(true);
      else setSite(found);
      setError('');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      const msg = errorMessage(e);
      setError(msg);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [id, setError]);

  useEffect(() => {
    void load();
    return () => ctrlRef.current?.abort();
  }, [load]);

  async function save() {
    if (!site) return;
    setSaving(true);
    try {
      const cleaned = { ...site, routes: cleanRoutes(site.routes) };
      await api('POST', '/admin/api/sites', cleaned);
      pushToast(`${t('toast.site.saved')}: ${site.id}`, 'success');
      await load();
    } catch (e) {
      const msg = errorMessage(e);
      pushToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  // ⌘/Ctrl + S 저장
  // save 는 site 의 클로저에 의존 — site/saving 변할 때마다 핸들러 갱신
  // biome-ignore lint/correctness/useExhaustiveDependencies: save is intentionally captured via the site/saving closure; re-binding on save would churn the global listener
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
  }, [site, saving]);

  if (loading) return <DetailSkeleton rows={5} />;
  if (missing) {
    return (
      <section className="space-y-4" data-testid="page-site-detail">
        <EmptyState
          title={t('sites.detail.notFound')}
          hint={
            <Link to="/sites" className="link">
              {t('sites.detail.back')}
            </Link>
          }
        />
      </section>
    );
  }
  if (!site) return null;

  return (
    <section className="space-y-4" data-testid="page-site-detail">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link to="/sites" className="link text-sm">
          {t('sites.detail.back')}
        </Link>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={load}>
            {t('btn.refresh')}
          </button>
          <button
            type="button"
            className="btn-primary px-3 py-2 text-sm font-medium"
            onClick={save}
            disabled={saving}
          >
            {saving ? t('btn.running') : t('sites.form.save')}
          </button>
        </div>
      </div>

      <div className="panel p-5 space-y-3">
        <h3 className="font-semibold text-ink">{t('sites.detail.metadata')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Field label={t('sites.form.id')}>
            <input
              type="text"
              disabled
              value={site.id}
              className="input w-full px-3 py-2 font-mono text-xs opacity-70"
            />
          </Field>
          <Field label={t('sites.form.name')}>
            <input
              type="text"
              value={site.name}
              onChange={(e) => setSite({ ...site, name: e.target.value })}
              className="input w-full px-3 py-2"
            />
          </Field>
          <Field label={t('sites.form.origin')}>
            <input
              type="url"
              value={site.origin}
              onChange={(e) => setSite({ ...site, origin: e.target.value })}
              className="input w-full px-3 py-2"
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
              className="input w-full px-3 py-2"
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
              className="input w-full px-3 py-2"
            />
          </Field>
          <label className="flex items-center gap-2 mt-6 text-sm">
            <input
              type="checkbox"
              className="checkbox h-4 w-4"
              checked={site.enabled}
              onChange={(e) => setSite({ ...site, enabled: e.target.checked })}
            />
            {t('sites.form.enabled')}
          </label>
        </div>
      </div>

      <div className="panel p-5 space-y-3">
        <h3 className="font-semibold text-ink">{t('sites.detail.routes')}</h3>
        <RoutesEditor
          routes={site.routes}
          onChange={(routes: ScopedRoute[]) => setSite({ ...site, routes })}
        />
      </div>
    </section>
  );
}
