import { useQuery } from '@tanstack/react-query'
import { CircleCheck, CircleX } from 'lucide-react'
import { useEffect, useState } from 'react'

import { AuthGate } from '../components/AuthGate'
import { EmptyState } from '../components/EmptyState'
import { api, errorMessage } from '../lib/api'
import { useStore } from '../lib/store'

import type { AuditEvent } from '../lib/types'

export function AuditLog() {
  return (
    <AuthGate>
      <AuditLogBody />
    </AuthGate>
  )
}

function AuditLogBody() {
  const t = useStore((s) => s.t)
  const pushToast = useStore((s) => s.pushToast)
  const setError = useStore((s) => s.setGlobalError)
  const [verified, setVerified] = useState<boolean | null>(null)
  const [brokenAt, setBrokenAt] = useState<number | null>(null)
  // verify 진행 표시 — 읽기 fetch 의 isFetching 과 합쳐 종전 busy 동작을 재현.
  const [verifying, setVerifying] = useState(false)

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const check = () => setIsMobile(globalThis.innerWidth < 768)
    check()
    globalThis.addEventListener('resize', check)
    return () => globalThis.removeEventListener('resize', check)
  }, [])

  const {
    data: events = [],
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['audit'],
    queryFn: async ({ signal }) => {
      const r = await api<{ ok: true; events: AuditEvent[] }>(
        'GET',
        '/admin/api/audit',
        undefined,
        {
          signal,
        }
      )
      return r.events ?? []
    },
  })

  // 종전 busy: 읽기 로드 중 + verify 중 둘 다 버튼 비활성.
  const busy = isFetching || verifying

  const load = () => {
    void refetch()
  }

  // 전역 에러 배너 동기화 — 성공 시 비우고, 실패 시 메시지 표면화(종전 setError 동작 보존).
  useEffect(() => {
    setError(error ? errorMessage(error) : '')
  }, [error, setError])

  async function verify() {
    setVerifying(true)
    try {
      const r = await api<{ ok: true; verified: boolean; brokenAt: number | null }>(
        'GET',
        '/admin/api/audit/verify'
      )
      setVerified(r.verified)
      setBrokenAt(r.brokenAt)
      pushToast(
        r.verified ? t('audit.ok') : `${t('audit.broken')} (idx ${r.brokenAt})`,
        r.verified ? 'success' : 'error'
      )
    } catch (e) {
      const msg = errorMessage(e)
      setError(msg)
    } finally {
      setVerifying(false)
    }
  }

  return (
    <section className="space-y-4" data-testid="page-audit">
      <div className="alert alert--warn">
        <h3 className="font-semibold mb-1">{t('audit.title')}</h3>
        <p>{t('audit.desc')}</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          className="btn-primary px-3 py-1.5 text-sm font-medium"
          onClick={load}
          disabled={busy}
        >
          {t('audit.refresh')}
        </button>
        <button
          type="button"
          className="btn-ghost px-3 py-1.5 text-sm font-medium"
          onClick={verify}
          disabled={busy}
        >
          {t('audit.verify')}
        </button>
        {verified !== null ? (
          <span
            className={`ml-auto inline-flex items-center gap-1.5 text-sm ${verified ? 'text-ok-fg' : 'text-err-fg'}`}
          >
            {verified ? (
              <CircleCheck className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <CircleX className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            )}
            {verified ? t('audit.ok') : `${t('audit.broken')} brokenAt=${brokenAt}`}
          </span>
        ) : null}
      </div>

      {events.length === 0 ? (
        <div className="panel">
          <EmptyState title={t('audit.empty')} hint={t('audit.empty.hint')} />
        </div>
      ) : isMobile ? (
        /* Mobile Timeline view */
        <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-3.5 before:w-0.5 before:bg-line">
          {events.map((e, i) => (
            <div key={`${e.ts}-${i}`} className="relative pl-8">
              <span
                className={`absolute left-[9px] top-4 w-[10px] h-[10px] rounded-full border-2 border-surface ${e.outcome === 'ok' ? 'bg-ok' : 'bg-err'}`}
              />
              <div className="panel p-3 bg-panel space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-ink-muted">{e.ts?.slice(11, 19) ?? '-'}</span>
                  <span className="font-mono bg-panel-2 px-1.5 py-0.5 rounded text-[10px] text-ink-subtle">
                    {e.hash?.slice(0, 12) ?? '-'}
                    {e.hash ? '...' : ''}
                  </span>
                </div>
                <div className="text-sm text-ink font-semibold">
                  {e.actor} <span className="font-normal text-ink-muted">action:</span>{' '}
                  <code className="text-xs px-1 bg-panel-2 rounded">{e.action}</code>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <span>outcome:</span>
                  <span className={`badge ${e.outcome === 'ok' ? 'badge--ok' : 'badge--err'}`}>
                    {e.outcome}
                  </span>
                </div>
                {e.target && (
                  <div className="text-xs font-mono bg-panel-2 p-1.5 rounded truncate text-ink-muted max-w-full">
                    {e.target}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Desktop Table view */
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel-2 text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">timestamp</th>
                <th className="px-3 py-2 text-left">actor</th>
                <th className="px-3 py-2 text-left">action</th>
                <th className="px-3 py-2 text-left">target</th>
                <th className="px-3 py-2 text-left">outcome</th>
                <th className="px-3 py-2 text-left">hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {events.map((e, i) => (
                <tr key={`${e.ts}-${i}`} className="hover:bg-panel-2">
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                    {e.ts?.slice(11, 19) ?? '-'}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{e.actor}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                  <td className="px-3 py-2 font-mono text-xs truncate max-w-xs">
                    {e.target ?? '-'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`badge ${e.outcome === 'ok' ? 'badge--ok' : 'badge--err'}`}>
                      {e.outcome}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-ink-subtle">
                    {e.hash?.slice(0, 12) ?? '-'}
                    {e.hash ? '...' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
