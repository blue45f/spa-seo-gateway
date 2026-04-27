import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { Modal } from '../components/Modal';
import { api, ApiError } from '../lib/api';
import { useStore } from '../lib/store';
import type { Tenant, TenantPlan } from '../lib/types';

export function Tenants() {
  return (
    <AuthGate>
      <TenantsBody />
    </AuthGate>
  );
}

const EMPTY_TENANT: Tenant = {
  id: '',
  name: '',
  origin: '',
  apiKey: '',
  routes: [],
  plan: 'free',
  enabled: true,
};

const PLANS: TenantPlan[] = ['free', 'pro', 'enterprise'];

const PLAN_PILL: Record<TenantPlan, string> = {
  free: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  pro: 'bg-emerald-100 text-emerald-800',
  enterprise: 'bg-amber-100 text-amber-800',
};

/** secure-ish API key — 32 hex chars (128 bits). */
export function generateApiKey(): string {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const buf = new Uint8Array(20);
    globalThis.crypto.getRandomValues(buf);
    return `tk_live_${Array.from(buf)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`;
  }
  // 폴백 — 테스트 환경
  let s = 'tk_live_';
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

function TenantsBody() {
  const t = useStore((s) => s.t);
  const setError = useStore((s) => s.setGlobalError);
  const pushToast = useStore((s) => s.pushToast);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ ok: true; tenants: Tenant[] }>('GET', '/admin/api/tenants');
      setTenants(r.tenants ?? []);
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

  async function save(tenant: Tenant) {
    try {
      await api('POST', '/admin/api/tenants', tenant);
      pushToast(`테넌트 저장됨: ${tenant.id}`, 'success');
      setEditing(null);
      await load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      pushToast(msg, 'error');
    }
  }

  async function remove(id: string) {
    if (!confirm(t('tenants.delete.confirm'))) return;
    try {
      await api('DELETE', `/admin/api/tenants/${encodeURIComponent(id)}`);
      pushToast(`테넌트 삭제됨: ${id}`, 'success');
      await load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      pushToast(msg, 'error');
    }
  }

  async function copyKey(key: string) {
    try {
      await navigator.clipboard?.writeText(key);
      pushToast(t('tenants.copied'), 'success');
    } catch {
      pushToast('clipboard 접근 거부됨', 'warn');
    }
  }

  return (
    <section className="space-y-4" data-testid="page-tenants">
      <div className="bg-purple-50 dark:bg-purple-950 dark:border-purple-900 border border-purple-200 rounded-lg p-4 text-sm">
        <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-1">{t('tenants.title')}</h3>
        <p className="text-purple-800 dark:text-purple-300">{t('tenants.intro')}</p>
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
          onClick={() => setEditing({ ...EMPTY_TENANT, apiKey: generateApiKey() })}
        >
          {t('tenants.add')}
        </button>
      </div>

      {tenants.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">{t('tenants.empty')}</p>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">{t('tenants.col.id')}</th>
                <th className="px-3 py-2 text-left">{t('tenants.col.name')}</th>
                <th className="px-3 py-2 text-left">{t('tenants.col.origin')}</th>
                <th className="px-3 py-2 text-left">{t('tenants.col.plan')}</th>
                <th className="px-3 py-2 text-left">{t('tenants.col.apikey')}</th>
                <th className="px-3 py-2 text-center">{t('tenants.col.enabled')}</th>
                <th className="px-3 py-2 text-right">{t('tenants.col.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tenants.map((tn) => (
                <tr key={tn.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                  <td className="px-3 py-2 font-mono text-xs">{tn.id}</td>
                  <td className="px-3 py-2">{tn.name}</td>
                  <td className="px-3 py-2 truncate max-w-xs">
                    <a
                      href={tn.origin}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      {tn.origin}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${PLAN_PILL[tn.plan]}`}>
                      {tn.plan}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    <span aria-label="masked key">
                      {tn.apiKey.slice(0, 8)}…{tn.apiKey.slice(-4)}
                    </span>
                    <button
                      type="button"
                      className="ml-2 text-slate-600 hover:text-slate-800 dark:text-slate-300 underline"
                      onClick={() => copyKey(tn.apiKey)}
                    >
                      {t('tenants.copy')}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs ${tn.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}
                    >
                      {tn.enabled ? 'ON' : 'OFF'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                      onClick={() => setEditing({ ...tn })}
                    >
                      {t('tenants.edit')}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:text-red-800"
                      onClick={() => remove(tn.id)}
                    >
                      {t('tenants.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <TenantForm tenant={editing} onCancel={() => setEditing(null)} onSave={save} />
      ) : null}
    </section>
  );
}

function TenantForm({
  tenant,
  onCancel,
  onSave,
}: {
  tenant: Tenant;
  onCancel(): void;
  onSave(t: Tenant): void;
}) {
  const t = useStore((s) => s.t);
  const [draft, setDraft] = useState<Tenant>(tenant);

  function update<K extends keyof Tenant>(key: K, value: Tenant[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^[a-z0-9_-]+$/.test(draft.id)) return;
    if (draft.apiKey.length < 20) return;
    if (!draft.name || !draft.origin) return;
    onSave(draft);
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={tenant.id ? t('tenants.edit') : t('tenants.add')}
      size="xl"
    >
      <form onSubmit={submit} className="space-y-3 text-sm" data-testid="tenant-form">
        <Field label={t('tenants.form.id')}>
          <input
            type="text"
            required
            disabled={!!tenant.id}
            pattern="[a-z0-9_\-]+"
            className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            value={draft.id}
            onChange={(e) => update('id', e.target.value)}
          />
        </Field>
        <Field label={t('tenants.form.name')}>
          <input
            type="text"
            required
            className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            value={draft.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </Field>
        <Field label={t('tenants.form.origin')}>
          <input
            type="url"
            required
            className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            value={draft.origin}
            onChange={(e) => update('origin', e.target.value)}
          />
        </Field>
        <Field label={t('tenants.form.apikey')}>
          <div className="flex gap-2">
            <input
              type="text"
              required
              minLength={20}
              className="flex-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
              value={draft.apiKey}
              onChange={(e) => update('apiKey', e.target.value)}
            />
            <button
              type="button"
              className="px-3 py-2 rounded bg-slate-100 dark:bg-slate-800 text-sm"
              onClick={() => update('apiKey', generateApiKey())}
            >
              {t('tenants.form.apikey.gen')}
            </button>
          </div>
        </Field>
        <Field label={t('tenants.form.plan')}>
          <select
            className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            value={draft.plan}
            onChange={(e) => update('plan', e.target.value as TenantPlan)}
          >
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => update('enabled', e.target.checked)}
          />
          {t('tenants.form.enabled')}
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
            {t('tenants.form.save')}
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
