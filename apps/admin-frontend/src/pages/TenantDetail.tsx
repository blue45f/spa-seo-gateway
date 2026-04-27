import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthGate } from '../components/AuthGate';
import { RoutesEditor } from '../components/RoutesEditor';
import { api, ApiError } from '../lib/api';
import { useStore } from '../lib/store';
import type { ScopedRoute, Tenant, TenantPlan } from '../lib/types';
import { generateApiKey } from './Tenants';

const PLANS: TenantPlan[] = ['free', 'pro', 'enterprise'];

export function TenantDetail() {
  return (
    <AuthGate>
      <TenantDetailBody />
    </AuthGate>
  );
}

function TenantDetailBody() {
  const params = useParams();
  const id = params.id ?? '';
  const t = useStore((s) => s.t);
  const setError = useStore((s) => s.setGlobalError);
  const pushToast = useStore((s) => s.pushToast);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMissing(false);
    try {
      const r = await api<{ ok: true; tenants: Tenant[] }>('GET', '/admin/api/tenants');
      const found = (r.tenants ?? []).find((tn) => tn.id === id);
      if (!found) setMissing(true);
      else setTenant(found);
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
    if (!tenant) return;
    setSaving(true);
    try {
      const cleaned = {
        ...tenant,
        routes: tenant.routes
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
      await api('POST', '/admin/api/tenants', cleaned);
      pushToast(`테넌트 저장됨: ${tenant.id}`, 'success');
      await load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      pushToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  function rotateApiKey() {
    if (!tenant) return;
    if (!confirm(t('tenants.detail.rotate.confirm'))) return;
    setTenant({ ...tenant, apiKey: generateApiKey() });
    pushToast('API key 변경됨 — 저장 버튼을 눌러야 적용됩니다', 'warn');
  }

  async function copyKey() {
    if (!tenant) return;
    try {
      await navigator.clipboard?.writeText(tenant.apiKey);
      pushToast(t('tenants.copied'), 'success');
    } catch {
      pushToast('clipboard 접근 거부됨', 'warn');
    }
  }

  // ⌘/Ctrl + S
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (tenant && !saving) void save();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tenant, saving]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p className="text-sm text-slate-500">loading...</p>;
  if (missing) {
    return (
      <section className="space-y-4" data-testid="page-tenant-detail">
        <Link to="/tenants" className="text-sm text-indigo-600 hover:underline">
          {t('tenants.detail.back')}
        </Link>
        <p className="text-sm text-slate-500">{t('tenants.detail.notFound')}</p>
      </section>
    );
  }
  if (!tenant) return null;

  return (
    <section className="space-y-4" data-testid="page-tenant-detail">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link to="/tenants" className="text-sm text-indigo-600 hover:underline">
          {t('tenants.detail.back')}
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
            {saving ? t('btn.running') : t('tenants.form.save')}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5 space-y-3">
        <h3 className="font-semibold">{t('tenants.detail.metadata')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Field label={t('tenants.form.id')}>
            <input
              type="text"
              disabled
              value={tenant.id}
              className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs opacity-70"
            />
          </Field>
          <Field label={t('tenants.form.name')}>
            <input
              type="text"
              value={tenant.name}
              onChange={(e) => setTenant({ ...tenant, name: e.target.value })}
              className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            />
          </Field>
          <Field label={t('tenants.form.origin')}>
            <input
              type="url"
              value={tenant.origin}
              onChange={(e) => setTenant({ ...tenant, origin: e.target.value })}
              className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            />
          </Field>
          <Field label={t('tenants.form.plan')}>
            <select
              value={tenant.plan}
              onChange={(e) => setTenant({ ...tenant, plan: e.target.value as TenantPlan })}
              className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('tenants.form.apikey')}>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={tenant.apiKey}
                onChange={(e) => setTenant({ ...tenant, apiKey: e.target.value })}
                className="flex-1 min-w-0 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
              />
              <button
                type="button"
                className="px-3 py-2 rounded bg-slate-100 dark:bg-slate-800 text-sm"
                onClick={copyKey}
              >
                {t('tenants.copy')}
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-sm"
                onClick={rotateApiKey}
              >
                {t('tenants.detail.rotate')}
              </button>
            </div>
          </Field>
          <label className="flex items-center gap-2 mt-6 text-sm">
            <input
              type="checkbox"
              checked={tenant.enabled}
              onChange={(e) => setTenant({ ...tenant, enabled: e.target.checked })}
            />
            {t('tenants.form.enabled')}
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5 space-y-3">
        <h3 className="font-semibold">{t('tenants.detail.routes')}</h3>
        <RoutesEditor
          routes={tenant.routes}
          onChange={(routes: ScopedRoute[]) => setTenant({ ...tenant, routes })}
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
