import {
  cloneElement,
  type ReactElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthGate } from '../components/AuthGate';
import { EmptyState } from '../components/EmptyState';
import { RoutesEditor } from '../components/RoutesEditor';
import { DetailSkeleton } from '../components/Skeleton';
import { ApiError, api } from '../lib/api';
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

  const ctrlRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    // 이전 요청 취소 — /tenants/A → /tenants/B 네비게이션 시 A 응답이 B 를 덮어쓰지 않게.
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setLoading(true);
    setMissing(false);
    try {
      const r = await api<{ ok: true; tenants: Tenant[] }>('GET', '/admin/api/tenants', undefined, {
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      const found = (r.tenants ?? []).find((tn) => tn.id === id);
      if (!found) setMissing(true);
      else setTenant(found);
      setError('');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
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
      pushToast(`${t('toast.tenant.saved')}: ${tenant.id}`, 'success');
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
    pushToast(t('toast.apikey.changed'), 'warn');
  }

  async function copyKey() {
    if (!tenant) return;
    try {
      await navigator.clipboard?.writeText(tenant.apiKey);
      pushToast(t('tenants.copied'), 'success');
    } catch {
      pushToast(t('toast.clipboard.denied'), 'warn');
    }
  }

  // ⌘/Ctrl + S
  // biome-ignore lint/correctness/useExhaustiveDependencies: save is intentionally captured via the tenant/saving closure; re-binding on save would churn the global listener
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
  }, [tenant, saving]);

  if (loading) return <DetailSkeleton rows={5} />;
  if (missing) {
    return (
      <section className="space-y-4" data-testid="page-tenant-detail">
        <EmptyState
          title={t('tenants.detail.notFound')}
          hint={
            <Link to="/tenants" className="link">
              {t('tenants.detail.back')}
            </Link>
          }
        />
      </section>
    );
  }
  if (!tenant) return null;

  return (
    <section className="space-y-4" data-testid="page-tenant-detail">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link to="/tenants" className="link text-sm">
          {t('tenants.detail.back')}
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
            {saving ? t('btn.running') : t('tenants.form.save')}
          </button>
        </div>
      </div>

      <div className="panel p-5 space-y-3">
        <h3 className="font-semibold text-ink">{t('tenants.detail.metadata')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Field label={t('tenants.form.id')}>
            <input
              type="text"
              disabled
              value={tenant.id}
              className="input w-full px-3 py-2 font-mono text-xs opacity-70"
            />
          </Field>
          <Field label={t('tenants.form.name')}>
            <input
              type="text"
              value={tenant.name}
              onChange={(e) => setTenant({ ...tenant, name: e.target.value })}
              className="input w-full px-3 py-2"
            />
          </Field>
          <Field label={t('tenants.form.origin')}>
            <input
              type="url"
              value={tenant.origin}
              onChange={(e) => setTenant({ ...tenant, origin: e.target.value })}
              className="input w-full px-3 py-2"
            />
          </Field>
          <Field label={t('tenants.form.plan')}>
            <select
              value={tenant.plan}
              onChange={(e) => setTenant({ ...tenant, plan: e.target.value as TenantPlan })}
              className="input w-full px-3 py-2"
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
                className="input flex-1 min-w-0 px-3 py-2 font-mono text-xs"
              />
              <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={copyKey}>
                {t('tenants.copy')}
              </button>
              <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={rotateApiKey}>
                {t('tenants.detail.rotate')}
              </button>
            </div>
          </Field>
          <label className="flex items-center gap-2 mt-6 text-sm">
            <input
              type="checkbox"
              className="checkbox h-4 w-4"
              checked={tenant.enabled}
              onChange={(e) => setTenant({ ...tenant, enabled: e.target.checked })}
            />
            {t('tenants.form.enabled')}
          </label>
        </div>
      </div>

      <div className="panel p-5 space-y-3">
        <h3 className="font-semibold text-ink">{t('tenants.detail.routes')}</h3>
        <RoutesEditor
          routes={tenant.routes}
          onChange={(routes: ScopedRoute[]) => setTenant({ ...tenant, routes })}
        />
      </div>
    </section>
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
