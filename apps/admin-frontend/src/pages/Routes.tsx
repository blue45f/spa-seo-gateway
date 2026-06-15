import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { AuthGate } from '../components/AuthGate'
import { RoutesEditor } from '../components/RoutesEditor'
import { api, errorMessage } from '../lib/api'
import { cleanRoutes } from '../lib/routes'
import { useStore } from '../lib/store'

import type { ScopedRoute } from '../lib/types'

export function RoutesPage() {
  return (
    <AuthGate>
      <RoutesBody />
    </AuthGate>
  )
}

function RoutesBody() {
  const t = useStore((s) => s.t)
  const setError = useStore((s) => s.setGlobalError)
  const pushToast = useStore((s) => s.pushToast)
  // 서버에서 받은 routes 는 RoutesEditor 로 직접 편집되므로 로컬 draft 로 들고 있는다.
  // useQuery 는 fetch/loading/error 만 담당하고, 성공 시 draft 를 시드한다.
  const [routes, setRoutes] = useState<ScopedRoute[]>([])
  const [saving, setSaving] = useState(false)
  // 마지막으로 draft 에 반영한 fetch 타임스탬프 — 같은 fetch 결과로 편집분을 덮어쓰지 않게.
  const seededAtRef = useRef(0)
  // 사용자가 draft 를 건드렸는지 — 초기 로드가 사용자의 (로드 전) 편집을 덮어쓰지 않게 한다.
  // 명시적 새로고침(load)은 이 플래그를 무시하고 강제 재시드한다(종전 동작: 새로고침 = 편집 폐기).
  const dirtyRef = useRef(false)
  const forceReseedRef = useRef(false)

  // RoutesEditor 의 변경은 사용자 편집 — dirty 표시 후 draft 갱신.
  const editRoutes = (next: ScopedRoute[]) => {
    dirtyRef.current = true
    setRoutes(next)
  }

  const {
    data,
    isFetching: loading,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['routes'],
    queryFn: async ({ signal }) => {
      const r = await api<{ ok: true; routes: ScopedRoute[] }>(
        'GET',
        '/admin/api/routes',
        undefined,
        {
          signal,
        }
      )
      return (r.routes ?? []).map((x) => ({
        pattern: x.pattern || '',
        ttlMs: x.ttlMs ?? undefined,
        waitUntil: x.waitUntil ?? undefined,
        waitSelector: x.waitSelector ?? undefined,
        waitMs: x.waitMs ?? undefined,
        ignore: x.ignore ?? false,
      }))
    },
  })

  const load = () => {
    // 명시적 새로고침은 편집분을 버리고 서버 값으로 강제 재시드(종전 load() 동작).
    forceReseedRef.current = true
    void refetch()
  }

  // 새 fetch 결과가 올 때(=dataUpdatedAt 증가) 편집 draft 를 서버 값으로 재시드.
  // 초기 로드는 사용자가 (로드 전) 편집하지 않았을 때만 시드해 편집분을 보존하고,
  // 명시적 새로고침(forceReseed)은 dirty 와 무관하게 서버 값으로 덮어쓴다.
  useEffect(() => {
    if (!data || dataUpdatedAt === seededAtRef.current) return
    if (dirtyRef.current && !forceReseedRef.current) {
      // 사용자가 먼저 편집한 상태의 초기 로드 — 편집 보존, 시드만 소비 처리.
      seededAtRef.current = dataUpdatedAt
      return
    }
    seededAtRef.current = dataUpdatedAt
    forceReseedRef.current = false
    dirtyRef.current = false
    setRoutes(data)
  }, [data, dataUpdatedAt])

  // 전역 에러 배너 동기화 — 성공 시 비우고, 실패 시 메시지 표면화(종전 setError 동작 보존).
  useEffect(() => {
    setError(error ? errorMessage(error) : '')
  }, [error, setError])

  const save = useCallback(
    async (persist: boolean) => {
      if (saving) return // 버튼/⌘S 동시 호출로 인한 중복 PUT 방지
      setSaving(true)
      try {
        const cleaned = cleanRoutes(routes)
        await api('PUT', '/admin/api/routes', { routes: cleaned, persist })
        pushToast(persist ? t('btn.save-disk') : t('btn.save-memory'), 'success')
      } catch (e) {
        const msg = errorMessage(e)
        setError(msg)
        pushToast(msg, 'error')
      } finally {
        setSaving(false)
      }
    },
    [routes, pushToast, setError, t, saving]
  )

  // ⌘/Ctrl + S 단축키
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save(false)
      }
    }
    globalThis.addEventListener('keydown', handler)
    return () => globalThis.removeEventListener('keydown', handler)
  }, [save])

  return (
    <section className="space-y-4" data-testid="page-routes">
      <div className="alert alert--info p-4 text-sm">
        <h3 className="font-semibold text-ink mb-1">{t('routes.title')}</h3>
        <p className="text-ink-muted">{t('routes.intro')}</p>
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
          className="btn-primary ml-auto px-3 py-2 text-sm"
          onClick={() => save(false)}
          disabled={saving}
        >
          {t('btn.save-memory')}
        </button>
        <button
          type="button"
          className="btn-primary px-3 py-2 text-sm"
          onClick={() => save(true)}
          title={t('routes.persist.title')}
          disabled={saving}
        >
          {t('btn.save-disk')}
        </button>
      </div>

      <RoutesEditor routes={routes} onChange={editRoutes} />
    </section>
  )
}
