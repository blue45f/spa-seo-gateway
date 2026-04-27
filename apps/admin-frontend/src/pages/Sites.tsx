import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthGate } from '../components/AuthGate';
import { Modal } from '../components/Modal';
import { api, ApiError } from '../lib/api';
import { useStore } from '../lib/store';
import type { Site } from '../lib/types';

export function Sites() {
  return (
    <AuthGate>
      <SitesBody />
    </AuthGate>
  );
}

const EMPTY_SITE: Site = {
  id: '',
  name: '',
  origin: '',
  routes: [],
  enabled: true,
  webhooks: undefined,
};

function SitesBody() {
  const t = useStore((s) => s.t);
  const setError = useStore((s) => s.setGlobalError);
  const pushToast = useStore((s) => s.pushToast);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ ok: true; sites: Site[] }>('GET', '/admin/api/sites');
      setSites(r.sites ?? []);
      setError('');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(site: Site) {
    try {
      await api('POST', '/admin/api/sites', site);
      pushToast(`사이트 저장됨: ${site.id}`, 'success');
      setEditing(null);
      await load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      pushToast(msg, 'error');
    }
  }

  async function remove(id: string) {
    if (!confirm(t('sites.delete.confirm'))) return;
    try {
      await api('DELETE', `/admin/api/sites/${encodeURIComponent(id)}`);
      pushToast(`사이트 삭제됨: ${id}`, 'success');
      await load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      pushToast(msg, 'error');
    }
  }

  async function invalidate(id: string) {
    const url = prompt(t('sites.invalidate.prompt'));
    if (!url) return;
    try {
      await api('POST', `/admin/api/sites/${encodeURIComponent(id)}/cache/invalidate`, { url });
      pushToast(`URL 무효화 완료: ${url}`, 'success');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      pushToast(msg, 'error');
    }
  }

  async function warm(id: string) {
    try {
      const r = await api<{ ok: true; report: { warmed: number; errors: number } }>(
        'POST',
        `/admin/api/sites/${encodeURIComponent(id)}/warm`,
        { max: 500 },
      );
      pushToast(`워밍 완료: ${r.report.warmed} OK / ${r.report.errors} fail`, 'success');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      pushToast(msg, 'error');
    }
  }

  return (
    <section className="space-y-4" data-testid="page-sites">
      <div className="bg-blue-50 dark:bg-indigo-950 dark:border-indigo-900 border border-blue-200 rounded-lg p-4 text-sm">
        <h3 className="font-semibold text-blue-900 dark:text-indigo-200 mb-1">{t('sites.title')}</h3>
        <p className="text-blue-800 dark:text-indigo-300">{t('sites.intro')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="px-3 py-2 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm"
          onClick={load}
          disabled={loading}
        >
          {t('btn.refresh')}
        </button>
        <button
          type="button"
          className="ml-auto px-3 py-2 rounded bg-slate-900 dark:bg-indigo-600 text-white text-sm font-medium hover:bg-slate-700"
          onClick={() => setEditing({ ...EMPTY_SITE })}
        >
          {t('sites.add')}
        </button>
      </div>

      {sites.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">{t('sites.empty')}</p>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">{t('sites.col.id')}</th>
                <th className="px-3 py-2 text-left">{t('sites.col.name')}</th>
                <th className="px-3 py-2 text-left">{t('sites.col.origin')}</th>
                <th className="px-3 py-2 text-right">{t('sites.col.routes')}</th>
                <th className="px-3 py-2 text-center">{t('sites.col.enabled')}</th>
                <th className="px-3 py-2 text-right">{t('sites.col.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sites.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link
                      to={`/sites/${encodeURIComponent(s.id)}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {s.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2 truncate max-w-xs">
                    <a
                      href={s.origin}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      {s.origin}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    <Link
                      to={`/sites/${encodeURIComponent(s.id)}`}
                      className="text-indigo-600 hover:underline"
                      title={t('sites.detail.routes')}
                    >
                      {s.routes.length}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs ${s.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}
                    >
                      {s.enabled ? 'ON' : 'OFF'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="text-xs text-slate-600 hover:text-slate-800 dark:text-slate-300"
                      onClick={() => invalidate(s.id)}
                    >
                      {t('sites.invalidate')}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-slate-600 hover:text-slate-800 dark:text-slate-300"
                      onClick={() => warm(s.id)}
                    >
                      {t('sites.warm')}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                      onClick={() => setEditing({ ...s })}
                    >
                      {t('sites.edit')}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:text-red-800"
                      onClick={() => remove(s.id)}
                    >
                      {t('sites.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <SiteForm site={editing} onCancel={() => setEditing(null)} onSave={save} />
      ) : null}
    </section>
  );
}

function SiteForm({
  site,
  onCancel,
  onSave,
}: {
  site: Site;
  onCancel(): void;
  onSave(s: Site): void;
}) {
  const t = useStore((s) => s.t);
  const [draft, setDraft] = useState<Site>(site);

  function update<K extends keyof Site>(key: K, value: Site[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function updateWebhook(key: 'onRender' | 'onError', value: string) {
    setDraft((d) => ({
      ...d,
      webhooks: { ...(d.webhooks ?? {}), [key]: value || undefined },
    }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^[a-z0-9_-]+$/.test(draft.id)) return;
    if (!draft.name || !draft.origin) return;
    onSave(draft);
  }

  return (
    <Modal open onClose={onCancel} title={site.id ? t('sites.edit') : t('sites.add')} size="xl">
      <form onSubmit={submit} className="space-y-3 text-sm" data-testid="site-form">
        <Field label={t('sites.form.id')}>
          <input
            type="text"
            required
            disabled={!!site.id}
            pattern="[a-z0-9_\-]+"
            className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            value={draft.id}
            onChange={(e) => update('id', e.target.value)}
          />
        </Field>
        <Field label={t('sites.form.name')}>
          <input
            type="text"
            required
            className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            value={draft.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </Field>
        <Field label={t('sites.form.origin')}>
          <input
            type="url"
            required
            className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            value={draft.origin}
            onChange={(e) => update('origin', e.target.value)}
          />
        </Field>
        <Field label={t('sites.form.webhookRender')}>
          <input
            type="url"
            className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            value={draft.webhooks?.onRender ?? ''}
            onChange={(e) => updateWebhook('onRender', e.target.value)}
          />
        </Field>
        <Field label={t('sites.form.webhookError')}>
          <input
            type="url"
            className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            value={draft.webhooks?.onError ?? ''}
            onChange={(e) => updateWebhook('onError', e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => update('enabled', e.target.checked)}
          />
          {t('sites.form.enabled')}
        </label>
        <div className="flex gap-2 justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            className="px-3 py-2 rounded bg-slate-100 dark:bg-slate-800 text-sm"
            onClick={onCancel}
          >
            {t('btn.cancel')}
          </button>
          <button
            type="submit"
            className="px-3 py-2 rounded bg-slate-900 dark:bg-indigo-600 text-white text-sm font-medium"
          >
            {t('sites.form.save')}
          </button>
        </div>
      </form>
    </Modal>
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
