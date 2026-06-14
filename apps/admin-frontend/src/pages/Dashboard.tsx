import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { AuthGate } from '../components/AuthGate'
import { EmptyState } from '../components/EmptyState'
import { Figure } from '../components/Figure'
import { CardGridSkeleton } from '../components/Skeleton'
import { Sparkline } from '../components/Sparkline'
import { api, errorMessage } from '../lib/api'
import { useStore } from '../lib/store'

import type { SiteInfo } from '../lib/types'

/** 추세선이 의미를 갖도록 최근 갱신 N회의 표본만 보관. */
const TREND_CAP = 24
const intFmt = (n: number) => String(Math.round(n))

export function Dashboard() {
  return (
    <AuthGate>
      <DashboardBody />
    </AuthGate>
  )
}

function DashboardBody() {
  const t = useStore((s) => s.t)
  const setError = useStore((s) => s.setGlobalError)
  // 갱신마다 누적 실패 합계를 적재해 추세선을 만든다(최근 TREND_CAP 회).
  const [failTrend, setFailTrend] = useState<number[]>([])
  const trendRef = useRef<number[]>([])

  const {
    data: info = null,
    isFetching: loading,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['site'],
    queryFn: ({ signal }) => api<SiteInfo>('GET', '/admin/api/site', undefined, { signal }),
  })

  const load = () => {
    void refetch()
  }

  // 성공 응답마다 실패 합계를 추세선에 적재 — dataUpdatedAt 이 바뀔 때만(=새 fetch 결과)
  // 1회 실행해 종전 load() 의 누적 동작을 그대로 재현한다.
  useEffect(() => {
    if (!info) return
    const totalFails = info.breakers
      ? Object.values(info.breakers).reduce((sum, b) => sum + (b.failures ?? 0), 0)
      : 0
    trendRef.current = [...trendRef.current, totalFails].slice(-TREND_CAP)
    setFailTrend(trendRef.current)
  }, [info, dataUpdatedAt])

  // 전역 에러 배너 동기화 — 성공 시 비우고, 실패 시 메시지를 표면화(종전 setError 동작 보존).
  useEffect(() => {
    setError(error ? errorMessage(error) : '')
  }, [error, setError])

  if (!info) {
    if (loading) {
      return (
        <section className="space-y-4" data-testid="page-dashboard-loading">
          <CardGridSkeleton count={3} />
        </section>
      )
    }
    return <EmptyState title={t('dashboard.empty')} hint={t('dashboard.empty.hint')} />
  }

  const ttlMin = Math.floor((info.cache?.ttlMs ?? 0) / 60_000)
  const swrMin = info.cache?.swrMs ? Math.floor(info.cache.swrMs / 60_000) : 0
  const breakerHosts = info.breakers ? Object.entries(info.breakers) : []

  return (
    <section className="space-y-5" data-testid="page-dashboard">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-ink">{t('dashboard.title')}</h2>
        <button
          type="button"
          className="btn-ghost px-3 py-1.5 text-sm"
          onClick={load}
          disabled={loading}
        >
          {t('btn.refresh')}
        </button>
      </div>

      {/* vitals — 동일 카드 3개 그리드가 아닌, 내부 위계가 있는 단일 패널 */}
      <div className="panel divide-y divide-line sm:flex sm:divide-y-0 sm:divide-x">
        <div className="flex-1 p-5 min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-ink-subtle">
            <span className="w-1.5 h-1.5 rounded-full bg-ok" aria-hidden="true" />
            mode
          </div>
          <div className="font-mono text-2xl text-ink mt-2">{info.mode}</div>
          <div className="text-xs text-ink-muted mt-1.5 font-mono truncate">
            {info.origin || t('dashboard.origin.unset')}
          </div>
        </div>
        <div className="flex-1 p-5">
          <div className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">routes</div>
          <div className="font-mono text-2xl text-ink mt-2">
            <Figure value={info.site?.routes ?? 0} format={intFmt} />
          </div>
          <div className="text-xs text-ink-muted mt-1.5">{t('dashboard.routes.detail')}</div>
        </div>
        <div className="flex-1 p-5">
          <div className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">cache</div>
          <div className="font-mono text-2xl text-ink mt-2">
            <Figure value={ttlMin} format={intFmt} />m TTL
          </div>
          <div className="text-xs text-ink-muted mt-2 flex items-center gap-2 flex-wrap">
            <span className="font-mono">{swrMin}m SWR</span>
            <span className={`badge ${info.cache?.redisEnabled ? 'badge--ok' : 'badge--neutral'}`}>
              redis {info.cache?.redisEnabled ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-semibold tracking-tight text-ink">{t('dashboard.breakers.title')}</h3>
          {breakerHosts.length > 0 && failTrend.length > 1 ? (
            <div className="flex items-center gap-1.5 text-ink-subtle shrink-0">
              <span className="sr-only">{t('dashboard.breakers.failTrend')}</span>
              <Sparkline values={failTrend} />
            </div>
          ) : null}
        </div>
        {breakerHosts.length > 0 ? (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-ink-subtle">
                <tr className="border-b border-line">
                  <th className="text-left font-medium py-2">host</th>
                  <th className="text-left font-medium py-2">state</th>
                  <th className="text-right font-medium py-2">failures</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {breakerHosts.map(([host, b]) => (
                  <tr key={host}>
                    <td className="py-2.5 font-mono text-xs text-ink">{host}</td>
                    <td className="py-2.5">
                      <span
                        className={`badge ${b.state === 'open' ? 'badge--err' : b.state === 'half-open' ? 'badge--warn' : 'badge--ok'}`}
                      >
                        {b.state}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-xs text-right text-ink-muted">
                      {b.failures}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={t('dashboard.breakers.empty.title')}
            hint={t('dashboard.breakers.empty.hint')}
          />
        )}
      </div>
    </section>
  )
}
