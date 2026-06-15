import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { AuthGate } from '../components/AuthGate'
import { EmptyState } from '../components/EmptyState'
import { Field } from '../components/Field'
import { ListSummary } from '../components/ListSummary'
import { Modal } from '../components/Modal'
import { api, errorMessage } from '../lib/api'
import { useDialog } from '../lib/dialog'
import { useStore } from '../lib/store'

import type { Site } from '../lib/types'

export function Sites() {
  return (
    <AuthGate>
      <SitesBody />
    </AuthGate>
  )
}

const EMPTY_SITE: Site = {
  id: '',
  name: '',
  origin: '',
  routes: [],
  enabled: true,
  webhooks: undefined,
}

function SitesBody() {
  const t = useStore((s) => s.t)
  const setError = useStore((s) => s.setGlobalError)
  const pushToast = useStore((s) => s.pushToast)
  const { confirm, prompt } = useDialog()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Site | null>(null)
  // 행 단위 in-flight 액션 — 같은 행의 중복/동시 요청 차단 + 진행 표시 (전역 loading 재사용 금지)
  const [pending, setPending] = useState<{
    id: string
    action: 'warm' | 'remove' | 'invalidate'
  } | null>(null)
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
    data: sites = [],
    isFetching: loading,
    error,
    refetch,
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

  // 전역 에러 배너 동기화 — 성공 시 비우고, 실패 시 메시지 표면화(종전 setError 동작 보존).
  useEffect(() => {
    setError(error ? errorMessage(error) : '')
  }, [error, setError])

  // 클라이언트 측 필터(id/이름/origin) + at-a-glance 카운트. 원본 fetch 는 건드리지 않는다.
  const q = filter.trim().toLowerCase()
  const visible = useMemo(
    () =>
      q
        ? sites.filter((s) => [s.id, s.name, s.origin].some((f) => f.toLowerCase().includes(q)))
        : sites,
    [sites, q]
  )
  const counts = useMemo(() => {
    let enabled = 0
    let routes = 0
    for (const s of sites) {
      if (s.enabled) enabled += 1
      routes += s.routes.length
    }
    return { total: sites.length, enabled, routes }
  }, [sites])

  async function save(site: Site) {
    try {
      await api('POST', '/admin/api/sites', site)
      pushToast(`${t('toast.site.saved')}: ${site.id}`, 'success')
      setEditing(null)
      await queryClient.invalidateQueries({ queryKey: ['sites'] })
    } catch (e) {
      const msg = errorMessage(e)
      pushToast(msg, 'error')
    }
  }

  async function remove(id: string) {
    if (pending) return
    const ok = await confirm({
      title: t('sites.delete.confirm.title'),
      description: t('sites.delete.confirm.desc'),
      confirmLabel: t('sites.delete'),
      danger: true,
    })
    if (!ok) return
    setPending({ id, action: 'remove' })
    try {
      await api('DELETE', `/admin/api/sites/${encodeURIComponent(id)}`)
      pushToast(`${t('toast.site.deleted')}: ${id}`, 'success')
      await queryClient.invalidateQueries({ queryKey: ['sites'] })
    } catch (e) {
      const msg = errorMessage(e)
      pushToast(msg, 'error')
    } finally {
      setPending(null)
    }
  }

  async function invalidate(id: string) {
    if (pending) return
    const url = await prompt({
      title: t('sites.invalidate'),
      description: t('sites.invalidate.prompt'),
      placeholder: 'https://www.example.com/posts/1',
      confirmLabel: t('btn.invalidate'),
      validate: (v) => (v.trim() ? null : t('dialog.input.required')),
    })
    if (!url) return
    setPending({ id, action: 'invalidate' })
    try {
      await api('POST', `/admin/api/sites/${encodeURIComponent(id)}/cache/invalidate`, { url })
      pushToast(`${t('toast.url.invalidated')}: ${url}`, 'success')
    } catch (e) {
      const msg = errorMessage(e)
      pushToast(msg, 'error')
    } finally {
      setPending(null)
    }
  }

  async function warm(id: string) {
    if (pending) return
    setPending({ id, action: 'warm' })
    try {
      const r = await api<{ ok: true; report: { warmed: number; errors: number } }>(
        'POST',
        `/admin/api/sites/${encodeURIComponent(id)}/warm`,
        { max: 500 }
      )
      pushToast(
        `${t('toast.warm.done')}: ${r.report.warmed} OK / ${r.report.errors} fail`,
        'success'
      )
    } catch (e) {
      const msg = errorMessage(e)
      pushToast(msg, 'error')
    } finally {
      setPending(null)
    }
  }

  return (
    <section className="space-y-4" data-testid="page-sites">
      <div className="alert alert--info p-4">
        <h3 className="font-semibold text-ink mb-1">{t('sites.title')}</h3>
        <p className="text-ink-muted">{t('sites.intro')}</p>
      </div>

      {sites.length > 0 ? (
        <ListSummary
          stats={[
            { label: t('sites.summary.total'), value: counts.total, tone: 'accent' },
            { label: t('sites.summary.enabled'), value: counts.enabled, tone: 'ok' },
            { label: t('sites.summary.routes'), value: counts.routes, tone: 'neutral' },
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
        {sites.length > 0 ? (
          <input
            type="search"
            className="input min-w-48 flex-1 px-3 py-2 text-sm sm:max-w-xs"
            placeholder={t('sites.filter.placeholder')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label={t('sites.filter.placeholder')}
          />
        ) : null}
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
          <EmptyState
            title={t('sites.empty')}
            hint={t('sites.empty.hint')}
            action={
              <button
                type="button"
                className="btn-primary px-3 py-2 text-sm font-medium"
                onClick={() => setEditing({ ...EMPTY_SITE })}
              >
                {t('sites.empty.cta')}
              </button>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="panel">
          <EmptyState title={t('sites.filter.none')} />
        </div>
      ) : isMobile ? (
        /* Mobile Card View */
        <div className="space-y-4">
          {visible.map((s) => (
            <div key={s.id} className="panel p-4 space-y-3 bg-panel">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="font-mono text-xs font-semibold">
                  <Link to={`/sites/${encodeURIComponent(s.id)}`} className="link">
                    {s.id}
                  </Link>
                </span>
                <span className={`badge ${s.enabled ? 'badge--ok' : 'badge--neutral'}`}>
                  {s.enabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-ink-subtle">{t('sites.col.name')}</div>
                <div className="text-sm font-medium text-ink">{s.name}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-ink-subtle">{t('sites.col.origin')}</div>
                <div className="text-sm font-mono truncate">
                  <a href={s.origin} target="_blank" rel="noreferrer" className="link">
                    {s.origin}
                  </a>
                </div>
              </div>
              <div className="flex flex-col gap-2 border-t border-line pt-2 text-xs">
                <div>
                  <span className="text-ink-subtle">{t('sites.col.routes')}: </span>
                  <Link to={`/sites/${encodeURIComponent(s.id)}`} className="link font-mono">
                    {s.routes.length}
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    className="text-xs text-ink-muted hover:text-ink rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                    onClick={() => invalidate(s.id)}
                    disabled={pending?.id === s.id}
                  >
                    {t('sites.invalidate')}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-ink-muted hover:text-ink rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                    onClick={() => warm(s.id)}
                    disabled={pending?.id === s.id}
                    aria-busy={pending?.id === s.id && pending.action === 'warm'}
                  >
                    {pending?.id === s.id && pending.action === 'warm'
                      ? t('btn.running')
                      : t('sites.warm')}
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
                    className="text-xs text-err hover:text-err-fg rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                    onClick={() => remove(s.id)}
                    disabled={pending?.id === s.id}
                  >
                    {t('sites.delete')}
                  </button>
                </div>
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
                <th className="px-3 py-2 text-left">{t('sites.col.id')}</th>
                <th className="px-3 py-2 text-left">{t('sites.col.name')}</th>
                <th className="px-3 py-2 text-left">{t('sites.col.origin')}</th>
                <th className="px-3 py-2 text-right">{t('sites.col.routes')}</th>
                <th className="px-3 py-2 text-center">{t('sites.col.enabled')}</th>
                <th className="px-3 py-2 text-right">{t('sites.col.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((s) => (
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
                      className="text-xs text-ink-muted hover:text-ink rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                      onClick={() => invalidate(s.id)}
                      disabled={pending?.id === s.id}
                    >
                      {t('sites.invalidate')}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-ink-muted hover:text-ink rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                      onClick={() => warm(s.id)}
                      disabled={pending?.id === s.id}
                      aria-busy={pending?.id === s.id && pending.action === 'warm'}
                    >
                      {pending?.id === s.id && pending.action === 'warm'
                        ? t('btn.running')
                        : t('sites.warm')}
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
                      className="text-xs text-err hover:text-err-fg rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                      onClick={() => remove(s.id)}
                      disabled={pending?.id === s.id}
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
  )
}

function SiteForm({
  site,
  onCancel,
  onSave,
}: {
  site: Site
  onCancel(): void
  onSave(s: Site): Promise<void>
}) {
  const t = useStore((s) => s.t)
  const [draft, setDraft] = useState<Site>(site)
  const [submitting, setSubmitting] = useState(false)

  function update<K extends keyof Site>(key: K, value: Site[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function updateWebhook(key: 'onRender' | 'onError', value: string) {
    setDraft((d) => ({
      ...d,
      webhooks: { ...(d.webhooks ?? {}), [key]: value || undefined },
    }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return // 중복 제출 방지
    if (!/^[a-z0-9_-]+$/.test(draft.id)) return
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
            {submitting ? t('btn.running') : t('sites.form.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
