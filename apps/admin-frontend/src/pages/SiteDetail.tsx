import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AuthGate } from '../components/AuthGate'
import { EmptyState } from '../components/EmptyState'
import { Field } from '../components/Field'
import { RoutesEditor } from '../components/RoutesEditor'
import { DetailSkeleton } from '../components/Skeleton'
import { api, errorMessage } from '../lib/api'
import { cleanRoutes } from '../lib/routes'
import { useStore } from '../lib/store'

import type { ScopedRoute, Site } from '../lib/types'

export function SiteDetail() {
  return (
    <AuthGate>
      <SiteDetailBody />
    </AuthGate>
  )
}

function SiteDetailBody() {
  const params = useParams()
  const id = params.id ?? ''
  const t = useStore((s) => s.t)
  const setError = useStore((s) => s.setGlobalError)
  const pushToast = useStore((s) => s.pushToast)
  const queryClient = useQueryClient()
  // fetch 한 site 는 폼으로 직접 편집되므로 로컬 draft 로 들고 있는다.
  const [site, setSite] = useState<Site | null>(null)
  const [saving, setSaving] = useState(false)
  const [missing, setMissing] = useState(false)
  // 새 fetch 결과만 draft 에 재시드하기 위한 가드(편집 중 리렌더가 덮어쓰지 않게).
  const seededAtRef = useRef(0)

  const {
    data: sites,
    isFetching,
    isLoading,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['sites'],
    queryFn: async ({ signal }) => {
      const r = await api<{ ok: true; sites: Site[] }>('GET', '/admin/api/sites', undefined, {
        signal,
      })
      return r.sites ?? []
    },
  })

  const load = () => {
    void refetch()
  }

  // fetch 결과가 갱신될 때마다 id 로 찾아 draft·missing 을 재계산(종전 load 동작 재현).
  useEffect(() => {
    if (!sites || dataUpdatedAt === seededAtRef.current) return
    seededAtRef.current = dataUpdatedAt
    const found = sites.find((s) => s.id === id)
    if (!found) {
      setMissing(true)
    } else {
      setMissing(false)
      setSite(found)
    }
  }, [sites, dataUpdatedAt, id])

  // 전역 에러 배너 동기화 — 성공 시 비우고, 실패 시 메시지 표면화(종전 setError 동작 보존).
  useEffect(() => {
    setError(error ? errorMessage(error) : '')
  }, [error, setError])

  const save = useCallback(async () => {
    if (!site) return
    setSaving(true)
    try {
      const cleaned = { ...site, routes: cleanRoutes(site.routes) }
      await api('POST', '/admin/api/sites', cleaned)
      pushToast(`${t('toast.site.saved')}: ${site.id}`, 'success')
      await queryClient.invalidateQueries({ queryKey: ['sites'] })
    } catch (e) {
      const msg = errorMessage(e)
      pushToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }, [site, pushToast, t, queryClient])

  // ⌘/Ctrl + S 저장 — save 가 useCallback 으로 안정화돼 deps 에 그대로 넣을 수 있다.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (site && !saving) void save()
      }
    }
    globalThis.addEventListener('keydown', handler)
    return () => globalThis.removeEventListener('keydown', handler)
  }, [site, saving, save])

  // 종전 loading 의미: 초기 로드 또는 (save 후) 재로드 중에는 스켈레톤.
  // 단, 아직 site/missing 이 한 번도 정해지지 않은 초기 상태에서는 항상 스켈레톤.
  const loading = isFetching || (isLoading && !site && !missing)
  if (loading) return <DetailSkeleton rows={5} />
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
    )
  }
  if (!site) return null

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
  )
}
