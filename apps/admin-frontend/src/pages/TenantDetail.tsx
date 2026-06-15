import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AuthGate } from '../components/AuthGate'
import { EmptyState } from '../components/EmptyState'
import { Field } from '../components/Field'
import { RoutesEditor } from '../components/RoutesEditor'
import { DetailSkeleton } from '../components/Skeleton'
import { api, errorMessage } from '../lib/api'
import { generateApiKey } from '../lib/apikey'
import { useDialog } from '../lib/dialog'
import { cleanRoutes } from '../lib/routes'
import { useStore } from '../lib/store'

import type { ScopedRoute, Tenant, TenantPlan } from '../lib/types'

const PLANS: TenantPlan[] = ['free', 'pro', 'enterprise']

export function TenantDetail() {
  return (
    <AuthGate>
      <TenantDetailBody />
    </AuthGate>
  )
}

function TenantDetailBody() {
  const params = useParams()
  const id = params.id ?? ''
  const t = useStore((s) => s.t)
  const setError = useStore((s) => s.setGlobalError)
  const pushToast = useStore((s) => s.pushToast)
  const { confirm } = useDialog()
  const queryClient = useQueryClient()
  // fetch 한 tenant 는 폼으로 직접 편집되므로 로컬 draft 로 들고 있는다.
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [saving, setSaving] = useState(false)
  const [missing, setMissing] = useState(false)
  // 새 fetch 결과만 draft 에 재시드하기 위한 가드(편집 중 리렌더가 덮어쓰지 않게).
  const seededAtRef = useRef(0)

  const {
    data: tenants,
    isFetching,
    isLoading,
    error,
    refetch,
    dataUpdatedAt,
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

  // fetch 결과가 갱신될 때마다 id 로 찾아 draft·missing 을 재계산(종전 load 동작 재현).
  useEffect(() => {
    if (!tenants || dataUpdatedAt === seededAtRef.current) return
    seededAtRef.current = dataUpdatedAt
    const found = tenants.find((tn) => tn.id === id)
    if (!found) {
      setMissing(true)
    } else {
      setMissing(false)
      setTenant(found)
    }
  }, [tenants, dataUpdatedAt, id])

  // 전역 에러 배너 동기화 — 성공 시 비우고, 실패 시 메시지 표면화(종전 setError 동작 보존).
  useEffect(() => {
    setError(error ? errorMessage(error) : '')
  }, [error, setError])

  const save = useCallback(async () => {
    if (!tenant) return
    setSaving(true)
    try {
      const cleaned = { ...tenant, routes: cleanRoutes(tenant.routes) }
      await api('POST', '/admin/api/tenants', cleaned)
      pushToast(`${t('toast.tenant.saved')}: ${tenant.id}`, 'success')
      await queryClient.invalidateQueries({ queryKey: ['tenants'] })
    } catch (e) {
      const msg = errorMessage(e)
      pushToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }, [tenant, pushToast, t, queryClient])

  async function rotateApiKey() {
    if (!tenant) return
    const ok = await confirm({
      title: t('tenants.detail.rotate.confirm.title'),
      description: t('tenants.detail.rotate.confirm.desc'),
      confirmLabel: t('tenants.detail.rotate'),
      danger: true,
    })
    if (!ok) return
    setTenant({ ...tenant, apiKey: generateApiKey() })
    pushToast(t('toast.apikey.changed'), 'warn')
  }

  async function copyKey() {
    if (!tenant) return
    try {
      await navigator.clipboard?.writeText(tenant.apiKey)
      pushToast(t('tenants.copied'), 'success')
    } catch {
      pushToast(t('toast.clipboard.denied'), 'warn')
    }
  }

  // ⌘/Ctrl + S — save 가 useCallback 으로 안정화돼 deps 에 그대로 넣을 수 있다.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (tenant && !saving) void save()
      }
    }
    globalThis.addEventListener('keydown', handler)
    return () => globalThis.removeEventListener('keydown', handler)
  }, [tenant, saving, save])

  // 종전 loading 의미: 초기 로드 또는 (save 후) 재로드 중에는 스켈레톤.
  const loading = isFetching || (isLoading && !tenant && !missing)
  if (loading) return <DetailSkeleton rows={5} />
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
    )
  }
  if (!tenant) return null

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
  )
}
