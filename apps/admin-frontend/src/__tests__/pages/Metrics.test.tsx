import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useStore } from '../../lib/store'
import { Metrics } from '../../pages/Metrics'
import { mockTextFetch, renderWithRouter, resetStore } from '../test-utils'

const PROM = `# HELP gateway_cache_events_total ...
gateway_cache_events_total{event="hit"} 90
gateway_cache_events_total{event="miss"} 10
gateway_inflight_renders 2
`

// 깨끗한 키 + +Inf 버킷이 finite 를 압도하는 오염 키 — '>30s' 분기와 Math.max 비오염 검증용
const PROM_HIST = `gateway_cache_events_total{event="hit"} 90
gateway_cache_events_total{event="miss"} 10
gateway_inflight_renders 0
gateway_render_duration_ms_bucket{outcome="ok",host="clean.com",le="100"} 5
gateway_render_duration_ms_bucket{outcome="ok",host="clean.com",le="500"} 18
gateway_render_duration_ms_bucket{outcome="ok",host="clean.com",le="2500"} 20
gateway_render_duration_ms_count{outcome="ok",host="clean.com"} 20
gateway_render_duration_ms_bucket{outcome="err",host="slow.com",le="100"} 0
gateway_render_duration_ms_bucket{outcome="err",host="slow.com",le="2500"} 0
gateway_render_duration_ms_bucket{outcome="err",host="slow.com",le="+Inf"} 10
gateway_render_duration_ms_count{outcome="err",host="slow.com"} 10
`

const originalFetch = globalThis.fetch

beforeEach(() => {
  resetStore()
  useStore.setState({ authed: true, adminEnabled: true })
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Metrics page', () => {
  it('parses /metrics text and shows cards', async () => {
    globalThis.fetch = mockTextFetch(PROM)
    renderWithRouter(<Metrics />)
    await waitFor(() => expect(screen.getByTestId('page-metrics')).toBeInTheDocument())
    expect(screen.getByText('90.0%')).toBeInTheDocument()
    // hit/miss counts are now the hit-ratio detail line, inflight stays a standalone figure
    expect(screen.getByText('hit 90 / miss 10')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('polls again after 5s and stops cleanly on unmount', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.fn(mockTextFetch(PROM))
    globalThis.fetch = fetchSpy
    const { unmount } = renderWithRouter(<Metrics />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0) // 초기 load 플러시 + 렌더 커밋
    })
    const afterInitial = fetchSpy.mock.calls.length
    expect(afterInitial).toBeGreaterThanOrEqual(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000) // 폴링 1회 추가
    })
    expect(fetchSpy.mock.calls.length).toBe(afterInitial + 1)

    unmount()
    const afterUnmount = fetchSpy.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000) // 언마운트 후 누수 없어야
    })
    expect(fetchSpy.mock.calls.length).toBe(afterUnmount)
  })

  it('stops polling when autoRefresh is turned off', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.fn(mockTextFetch(PROM))
    globalThis.fetch = fetchSpy
    renderWithRouter(<Metrics />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0) // 초기 load 플러시 + 렌더 커밋
    })
    fireEvent.click(screen.getByRole('checkbox')) // autoRefresh off
    const before = fetchSpy.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(fetchSpy.mock.calls.length).toBe(before)
  })

  it('surfaces a /metrics fetch error to the global banner', async () => {
    globalThis.fetch = mockTextFetch('boom', 500)
    renderWithRouter(<Metrics />)
    await waitFor(() => expect(useStore.getState().globalError).not.toBe(''))
  })

  it('renders >30s for non-finite buckets without poisoning the clean row', async () => {
    globalThis.fetch = mockTextFetch(PROM_HIST)
    renderWithRouter(<Metrics />)
    await waitFor(() => expect(screen.getByText('cache hit ratio')).toBeInTheDocument())
    // 오염 키(err/slow.com)는 '>30s' 로 표시
    await waitFor(() => expect(screen.getAllByText('>30s').length).toBeGreaterThan(0))
    // 깨끗한 키의 finite p95 막대는 여전히 ms — Math.max 가 +Inf/NaN 에 오염되지 않음
    expect(screen.getByText('2500ms')).toBeInTheDocument()
  })
})
