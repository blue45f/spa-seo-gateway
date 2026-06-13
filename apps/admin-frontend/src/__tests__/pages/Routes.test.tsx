import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useStore } from '../../lib/store'
import { RoutesPage } from '../../pages/Routes'
import { renderWithRouter, resetStore } from '../test-utils'

const originalFetch = globalThis.fetch
const ROUTES = [
  { pattern: '^/blog/', ttlMs: 3600000, waitUntil: 'networkidle2', ignore: false },
  { pattern: '^/products/', waitSelector: '[data-loaded]' },
]

beforeEach(() => {
  resetStore()
  useStore.setState({ authed: true, adminEnabled: true })
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('Routes page', () => {
  it('lists existing routes from API', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, routes: ROUTES }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    renderWithRouter(<RoutesPage />)
    await waitFor(() => expect(screen.getByDisplayValue('^/blog/')).toBeInTheDocument())
    expect(screen.getByDisplayValue('^/products/')).toBeInTheDocument()
    expect(screen.getByDisplayValue('[data-loaded]')).toBeInTheDocument()
  })

  it('add button appends a new empty row', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, routes: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    renderWithRouter(<RoutesPage />)
    await waitFor(() => expect(screen.getByText(/정의된 라우트가 없습니다/)).toBeInTheDocument())
    fireEvent.click(screen.getByText('+ 추가'))
    await waitFor(() => {
      const inputs = screen.getAllByPlaceholderText('^/products/[0-9]+')
      expect(inputs.length).toBeGreaterThan(0)
    })
  })

  it('save button posts cleaned payload', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, routes: ROUTES }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, routes: ROUTES }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    globalThis.fetch = fetchMock
    renderWithRouter(<RoutesPage />)
    await waitFor(() => expect(screen.getByDisplayValue('^/blog/')).toBeInTheDocument())

    const user = userEvent.setup()
    await user.click(screen.getByText('저장 (메모리)'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const putCall = fetchMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PUT'
    )
    expect(putCall).toBeDefined()
    const body = JSON.parse((putCall?.[1] as RequestInit).body as string)
    expect(body.persist).toBe(false)
    expect(body.routes[0].pattern).toBe('^/blog/')
  })

  it('Cmd/Ctrl+S saves to memory (preventDefault + persist:false) and cleans up on unmount', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, routes: ROUTES }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    globalThis.fetch = fetchMock
    const { unmount } = renderWithRouter(<RoutesPage />)
    await waitFor(() => expect(screen.getByDisplayValue('^/blog/')).toBeInTheDocument())

    // preventDefault 가 호출되면 fireEvent 가 false 를 반환 — 브라우저 기본 저장 다이얼로그 차단 검증
    const notPrevented = fireEvent.keyDown(window, { key: 's', metaKey: true })
    expect(notPrevented).toBe(false)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const putCall = fetchMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PUT'
    )
    expect(JSON.parse((putCall?.[1] as RequestInit).body as string).persist).toBe(false)

    // 언마운트 후 리스너 누수 없음 — 단축키가 더 이상 fetch 를 트리거하지 않아야
    unmount()
    const after = fetchMock.mock.calls.length
    fireEvent.keyDown(window, { key: 's', metaKey: true })
    expect(fetchMock.mock.calls.length).toBe(after)
  })
})
