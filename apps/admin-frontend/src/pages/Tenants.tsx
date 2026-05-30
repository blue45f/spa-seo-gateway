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
  free: 'badge badge--neutral',
  pro: 'badge badge--ok',
  enterprise: 'badge badge--warn',
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
      <div className="alert alert--info p-4">
        <h3 className="font-semibold text-ink mb-1">{t('tenants.title')}</h3>
        <p className="text-ink-muted">{t('tenants.intro')}</p>
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
          onClick={() => setEditing({ ...EMPTY_TENANT, apiKey: generateApiKey() })}
        >
          {t('tenants.add')}
        </button>
      </div>

      {tenants.length === 0 ? (
        <div className="panel">
          <EmptyState
            title={t('tenants.empty')}
            hint="테넌트를 추가하면 apiKey · host 로 식별되는 고객별 origin · routes 설정을 관리할 수 있습니다."
          />
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel-2 text-xs uppercase text-ink-muted">
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
            <tbody className="divide-y divide-line">
              {tenants.map((tn) => (
                <tr key={tn.id} className="hover:bg-panel-2">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link to={`/tenants/${encodeURIComponent(tn.id)}`} className="link">
                      {tn.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{tn.name}</td>
                  <td className="px-3 py-2 truncate max-w-xs">
                    <a href={tn.origin} target="_blank" rel="noreferrer" className="link">
                      {tn.origin}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <span className={PLAN_PILL[tn.plan]}>{tn.plan}</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-ink-subtle whitespace-nowrap">
                    <span title="masked key">
                      {tn.apiKey.slice(0, 8)}…{tn.apiKey.slice(-4)}
                    </span>
                    <button
                      type="button"
                      className="ml-2 text-ink-muted hover:text-ink underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      onClick={() => copyKey(tn.apiKey)}
                    >
                      {t('tenants.copy')}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`badge ${tn.enabled ? 'badge--ok' : 'badge--neutral'}`}>
                      {tn.enabled ? 'ON' : 'OFF'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="link text-xs"
                      onClick={() => setEditing({ ...tn })}
                    >
                      {t('tenants.edit')}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-err hover:text-err-fg rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
            className="input w-full px-3 py-2"
            value={draft.id}
            onChange={(e) => update('id', e.target.value)}
          />
        </Field>
        <Field label={t('tenants.form.name')}>
          <input
            type="text"
            required
            className="input w-full px-3 py-2"
            value={draft.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </Field>
        <Field label={t('tenants.form.origin')}>
          <input
            type="url"
            required
            className="input w-full px-3 py-2"
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
              className="input flex-1 px-3 py-2 font-mono text-xs"
              value={draft.apiKey}
              onChange={(e) => update('apiKey', e.target.value)}
            />
            <button
              type="button"
              className="btn-ghost px-3 py-2 text-sm"
              onClick={() => update('apiKey', generateApiKey())}
            >
              {t('tenants.form.apikey.gen')}
            </button>
          </div>
        </Field>
        <Field label={t('tenants.form.plan')}>
          <select
            className="input w-full px-3 py-2"
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
        <div className="flex gap-2 justify-end pt-3 border-t border-line">
          <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={onCancel}>
            {t('btn.cancel')}
          </button>
          <button type="submit" className="btn-primary px-3 py-2 text-sm font-medium">
            {t('tenants.form.save')}
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
