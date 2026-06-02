import {
  cloneElement,
  type FormEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useId,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { AuthGate } from '../components/AuthGate';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { ApiError, api } from '../lib/api';
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
      pushToast(`${t('toast.site.saved')}: ${site.id}`, 'success');
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
      pushToast(`${t('toast.site.deleted')}: ${id}`, 'success');
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
      pushToast(`${t('toast.url.invalidated')}: ${url}`, 'success');
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
      pushToast(
        `${t('toast.warm.done')}: ${r.report.warmed} OK / ${r.report.errors} fail`,
        'success',
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      pushToast(msg, 'error');
    }
  }

  return (
    <section className="space-y-4" data-testid="page-sites">
      <div className="alert alert--info p-4">
        <h3 className="font-semibold text-ink mb-1">{t('sites.title')}</h3>
        <p className="text-ink-muted">{t('sites.intro')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost px-3 py-2 text-sm"
          onClick={load}
          disabled={loading}
        >
          {t('btn.refresh')}
        </button>
        <button
          type="button"
          className="btn-primary ml-auto px-3 py-2 text-sm font-medium"
          onClick={() => setEditing({ ...EMPTY_SITE })}
        >
          {t('sites.add')}
        </button>
      </div>

      {sites.length === 0 ? (
        <div className="panel">
          <EmptyState title={t('sites.empty')} hint={t('sites.empty.hint')} />
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel-2 text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">{t('sites.col.id')}</th>
                <th className="px-3 py-2 text-left">{t('sites.col.name')}</th>
                <th className="px-3 py-2 text-left">{t('sites.col.origin')}</th>
                <th className="px-3 py-2 text-right">{t('sites.col.routes')}</th>
                <th className="px-3 py-2 text-center">{t('sites.col.enabled')}</th>
                <th className="px-3 py-2 text-right">{t('sites.col.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sites.map((s) => (
                <tr key={s.id} className="hover:bg-panel-2">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link to={`/sites/${encodeURIComponent(s.id)}`} className="link">
                      {s.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2 truncate max-w-xs font-mono text-xs">
                    <a href={s.origin} target="_blank" rel="noreferrer" className="link">
                      {s.origin}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    <Link
                      to={`/sites/${encodeURIComponent(s.id)}`}
                      className="link"
                      title={t('sites.detail.routes')}
                    >
                      {s.routes.length}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`badge ${s.enabled ? 'badge--ok' : 'badge--neutral'}`}>
                      {s.enabled ? 'ON' : 'OFF'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="text-xs text-ink-muted hover:text-ink rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      onClick={() => invalidate(s.id)}
                    >
                      {t('sites.invalidate')}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-ink-muted hover:text-ink rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      onClick={() => warm(s.id)}
                    >
                      {t('sites.warm')}
                    </button>
                    <button
                      type="button"
                      className="link text-xs"
                      onClick={() => setEditing({ ...s })}
                    >
                      {t('sites.edit')}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-err hover:text-err-fg rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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

      {editing ? <SiteForm site={editing} onCancel={() => setEditing(null)} onSave={save} /> : null}
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
            className="input w-full px-3 py-2"
            value={draft.id}
            onChange={(e) => update('id', e.target.value)}
          />
        </Field>
        <Field label={t('sites.form.name')}>
          <input
            type="text"
            required
            className="input w-full px-3 py-2"
            value={draft.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </Field>
        <Field label={t('sites.form.origin')}>
          <input
            type="url"
            required
            className="input w-full px-3 py-2"
            value={draft.origin}
            onChange={(e) => update('origin', e.target.value)}
          />
        </Field>
        <Field label={t('sites.form.webhookRender')}>
          <input
            type="url"
            className="input w-full px-3 py-2"
            value={draft.webhooks?.onRender ?? ''}
            onChange={(e) => updateWebhook('onRender', e.target.value)}
          />
        </Field>
        <Field label={t('sites.form.webhookError')}>
          <input
            type="url"
            className="input w-full px-3 py-2"
            value={draft.webhooks?.onError ?? ''}
            onChange={(e) => updateWebhook('onError', e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="checkbox h-4 w-4"
            checked={draft.enabled}
            onChange={(e) => update('enabled', e.target.checked)}
          />
          {t('sites.form.enabled')}
        </label>
        <div className="flex gap-2 justify-end pt-3 border-t border-line">
          <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={onCancel}>
            {t('btn.cancel')}
          </button>
          <button type="submit" className="btn-primary px-3 py-2 text-sm font-medium">
            {t('sites.form.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  return (
    <div className="block">
      <label htmlFor={id} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      <div className="mt-1">{cloneElement(children, { id })}</div>
    </div>
  );
}
