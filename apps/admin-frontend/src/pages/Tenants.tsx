import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { AuthGate } from '../components/AuthGate'
import { EmptyState } from '../components/EmptyState'
import { Field } from '../components/Field'
import { ListSummary } from '../components/ListSummary'
import { Modal } from '../components/Modal'
import { api, errorMessage } from '../lib/api'
import { generateApiKey } from '../lib/apikey'
import { useDialog } from '../lib/dialog'
import { useStore } from '../lib/store'

import type { Tenant, TenantPlan } from '../lib/types'

export function Tenants() {
  return (
    <AuthGate>
      <TenantsBody />
    </AuthGate>
  )
}

const EMPTY_TENANT: Tenant = {
  id: '',
  name: '',
  origin: '',
  apiKey: '',
  routes: [],
  plan: 'free',
  enabled: true,
}

const PLANS: TenantPlan[] = ['free', 'pro', 'enterprise']

const PLAN_PILL: Record<TenantPlan, string> = {
  free: 'badge badge--neutral',
  pro: 'badge badge--ok',
  enterprise: 'badge badge--warn',
}

function TenantsBody() {
  const t = useStore((s) => s.t)
  const setError = useStore((s) => s.setGlobalError)
  const pushToast = useStore((s) => s.pushToast)
  const { confirm } = useDialog()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Tenant | null>(null)
  // 삭제 in-flight 인 행 id — 중복 클릭/동시 DELETE 차단 (전역 loading 재사용 금지)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const check = () => setIsMobile(globalThis.innerWidth < 768)
    check()
    globalThis.addEventListener('resize', check)
    return () => globalThis.removeEventListener('resize', check)
  }, [])

  const {
    data: tenants = [],
    isFetching: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['tenants'],
    queryFn: async ({ signal }) => {
      const r = await api<{ ok: true; tenants: Tenant[] }>('GET', '/admin/api/tenants', undefined, {
        signal,
      })
      return r.tenants ?? []
    },
  })

  const load = () => {
    void refetch()
  }

  // 전역 에러 배너 동기화 — 성공 시 비우고, 실패 시 메시지 표면화(종전 setError 동작 보존).
  useEffect(() => {
    setError(error ? errorMessage(error) : '')
  }, [error, setError])

  // 클라이언트 측 필터(id/이름/origin) + at-a-glance 카운트. 목록이 채워진 데모에서
  // 빠르게 좁히고 plan 분포를 한눈에 보여준다. 원본 fetch 는 건드리지 않는다.
  const q = filter.trim().toLowerCase()
  const visible = useMemo(
    () =>
      q
        ? tenants.filter((tn) =>
            [tn.id, tn.name, tn.origin].some((f) => f.toLowerCase().includes(q))
          )
        : tenants,
    [tenants, q]
  )
  const counts = useMemo(() => {
    const byPlan: Record<TenantPlan, number> = { free: 0, pro: 0, enterprise: 0 }
    let enabled = 0
    for (const tn of tenants) {
      byPlan[tn.plan] += 1
      if (tn.enabled) enabled += 1
    }
    return { total: tenants.length, enabled, byPlan }
  }, [tenants])

  async function save(tenant: Tenant) {
    try {
      await api('POST', '/admin/api/tenants', tenant)
      pushToast(`${t('toast.tenant.saved')}: ${tenant.id}`, 'success')
      setEditing(null)
      await queryClient.invalidateQueries({ queryKey: ['tenants'] })
    } catch (e) {
      const msg = errorMessage(e)
      pushToast(msg, 'error')
    }
  }

  async function remove(id: string) {
    if (removingId) return
    const ok = await confirm({
      title: t('tenants.delete.confirm.title'),
      description: t('tenants.delete.confirm.desc'),
      confirmLabel: t('tenants.delete'),
      danger: true,
    })
    if (!ok) return
    setRemovingId(id)
    try {
      await api('DELETE', `/admin/api/tenants/${encodeURIComponent(id)}`)
      pushToast(`${t('toast.tenant.deleted')}: ${id}`, 'success')
      await queryClient.invalidateQueries({ queryKey: ['tenants'] })
    } catch (e) {
      const msg = errorMessage(e)
      pushToast(msg, 'error')
    } finally {
      setRemovingId(null)
    }
  }

  async function copyKey(key: string) {
    try {
      await navigator.clipboard?.writeText(key)
      pushToast(t('tenants.copied'), 'success')
    } catch {
      pushToast(t('toast.clipboard.denied'), 'warn')
    }
  }

  return (
    <section className="space-y-4" data-testid="page-tenants">
      <div className="alert alert--info p-4">
        <h3 className="font-semibold text-ink mb-1">{t('tenants.title')}</h3>
        <p className="text-ink-muted">{t('tenants.intro')}</p>
      </div>

      {tenants.length > 0 ? (
        <ListSummary
          stats={[
            { label: t('tenants.summary.total'), value: counts.total, tone: 'accent' },
            { label: t('tenants.summary.enabled'), value: counts.enabled, tone: 'ok' },
            { label: 'free', value: counts.byPlan.free, tone: 'neutral' },
            { label: 'pro', value: counts.byPlan.pro, tone: 'ok' },
            { label: 'enterprise', value: counts.byPlan.enterprise, tone: 'warn' },
          ]}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-ghost px-3 py-2 text-sm"
          onClick={load}
          disabled={loading}
        >
          {t('btn.refresh')}
        </button>
        {tenants.length > 0 ? (
          <input
            type="search"
            className="input min-w-48 flex-1 px-3 py-2 text-sm sm:max-w-xs"
            placeholder={t('tenants.filter.placeholder')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label={t('tenants.filter.placeholder')}
          />
        ) : null}
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
            hint={t('tenants.empty.hint')}
            action={
              <button
                type="button"
                className="btn-primary px-3 py-2 text-sm font-medium"
                onClick={() => setEditing({ ...EMPTY_TENANT, apiKey: generateApiKey() })}
              >
                {t('tenants.empty.cta')}
              </button>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="panel">
          <EmptyState title={t('tenants.filter.none')} />
        </div>
      ) : isMobile ? (
        /* Mobile Card View */
        <div className="space-y-4">
          {visible.map((tn) => (
            <div key={tn.id} className="panel p-4 space-y-3 bg-panel">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="font-mono text-xs font-semibold">
                  <Link to={`/tenants/${encodeURIComponent(tn.id)}`} className="link">
                    {tn.id}
                  </Link>
                </span>
                <span className={`badge ${tn.enabled ? 'badge--ok' : 'badge--neutral'}`}>
                  {tn.enabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-ink-subtle">{t('tenants.col.name')}</div>
                  <div className="text-sm font-medium text-ink">{tn.name}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-ink-subtle">{t('tenants.col.plan')}</div>
                  <div>
                    <span className={PLAN_PILL[tn.plan]}>{tn.plan}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-ink-subtle">{t('tenants.col.origin')}</div>
                <div className="text-sm font-mono truncate">
                  <a href={tn.origin} target="_blank" rel="noreferrer" className="link">
                    {tn.origin}
                  </a>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-ink-subtle">{t('tenants.col.apikey')}</div>
                <div className="text-xs font-mono text-ink-subtle flex items-center gap-2">
                  <span>
                    {tn.apiKey.slice(0, 8)}…{tn.apiKey.slice(-4)}
                  </span>
                  <button
                    type="button"
                    className="text-ink-muted hover:text-ink underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    onClick={() => copyKey(tn.apiKey)}
                  >
                    {t('tenants.copy')}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-line pt-2 text-xs">
                <button
                  type="button"
                  className="link text-xs"
                  onClick={() => setEditing({ ...tn })}
                >
                  {t('tenants.edit')}
                </button>
                <button
                  type="button"
                  className="text-xs text-err hover:text-err-fg rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                  onClick={() => remove(tn.id)}
                  disabled={removingId === tn.id}
                >
                  {removingId === tn.id ? t('btn.running') : t('tenants.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Desktop Table View */
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
              {visible.map((tn) => (
                <tr key={tn.id} className="hover:bg-panel-2">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link to={`/tenants/${encodeURIComponent(tn.id)}`} className="link">
                      {tn.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{tn.name}</td>
                  <td className="px-3 py-2 truncate max-w-xs font-mono text-xs">
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
                      className="text-xs text-err hover:text-err-fg rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                      onClick={() => remove(tn.id)}
                      disabled={removingId === tn.id}
                    >
                      {removingId === tn.id ? t('btn.running') : t('tenants.delete')}
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
  )
}

function TenantForm({
  tenant,
  onCancel,
  onSave,
}: {
  tenant: Tenant
  onCancel(): void
  onSave(t: Tenant): Promise<void>
}) {
  const t = useStore((s) => s.t)
  const [draft, setDraft] = useState<Tenant>(tenant)
  const [submitting, setSubmitting] = useState(false)

  function update<K extends keyof Tenant>(key: K, value: Tenant[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return // 중복 제출 방지
    if (!/^[a-z0-9_-]+$/.test(draft.id)) return
    if (draft.apiKey.length < 20) return
    if (!draft.name || !draft.origin) return
    setSubmitting(true)
    try {
      await onSave(draft)
    } finally {
      // save 는 실패 시 모달을 열어두므로(재시도) 항상 버튼을 되살린다
      setSubmitting(false)
    }
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
            className="checkbox h-4 w-4"
            checked={draft.enabled}
            onChange={(e) => update('enabled', e.target.checked)}
          />
          {t('tenants.form.enabled')}
        </label>
        <div className="flex gap-2 justify-end pt-3 border-t border-line">
          <button
            type="button"
            className="btn-ghost px-3 py-2 text-sm"
            onClick={onCancel}
            disabled={submitting}
          >
            {t('btn.cancel')}
          </button>
          <button
            type="submit"
            className="btn-primary px-3 py-2 text-sm font-medium"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? t('btn.running') : t('tenants.form.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
