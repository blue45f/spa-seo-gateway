import { fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '../App'
import { useStore } from '../lib/store'

import { resetStore } from './test-utils'

const originalFetch = globalThis.fetch

/** whoami / public-info 를 JSON 으로, 그 외는 ok 로 응답하는 fetch 목. */
function mockFetch(whoami: Record<string, unknown> = { authenticated: true, adminEnabled: true }) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    const json = (body: unknown) =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    if (url.includes('/whoami')) return json({ ok: true, ...whoami })
    if (url.includes('/public/info')) return json({ mode: 'open' })
    return json({ ok: true })
  }) as unknown as typeof fetch
}

beforeEach(() => {
  resetStore()
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('App global shortcuts', () => {
  it('Cmd/Ctrl+K toggles the command palette', async () => {
    globalThis.fetch = mockFetch()
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )
    await waitFor(() => expect(useStore.getState().authed).toBe(true)) // settle whoami

    expect(useStore.getState().cmdPaletteOpen).toBe(false)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(useStore.getState().cmdPaletteOpen).toBe(true)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(useStore.getState().cmdPaletteOpen).toBe(false)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(useStore.getState().cmdPaletteOpen).toBe(true)
  })

  it('Escape clears both palette and shortcuts modal', async () => {
    globalThis.fetch = mockFetch()
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )
    await waitFor(() => expect(useStore.getState().authed).toBe(true))

    useStore.setState({ cmdPaletteOpen: true, shortcutsOpen: true })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useStore.getState().cmdPaletteOpen).toBe(false)
    expect(useStore.getState().shortcutsOpen).toBe(false)
  })

  it('"?" opens shortcuts, but not while an input is focused', async () => {
    globalThis.fetch = mockFetch()
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )
    await waitFor(() => expect(useStore.getState().authed).toBe(true))

    fireEvent.keyDown(window, { key: '?' })
    expect(useStore.getState().shortcutsOpen).toBe(true)

    useStore.setState({ shortcutsOpen: false })
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    fireEvent.keyDown(input, { key: '?' })
    expect(useStore.getState().shortcutsOpen).toBe(false)
    input.remove()
  })
})

describe('App whoami bootstrap', () => {
  it('authenticates from a successful whoami', async () => {
    globalThis.fetch = mockFetch({ authenticated: true, adminEnabled: true })
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )
    await waitFor(() => expect(useStore.getState().authed).toBe(true))
    expect(useStore.getState().adminEnabled).toBe(true)
  })

  it('falls back to unauthenticated when whoami rejects', async () => {
    useStore.setState({ authed: true }) // 시작을 true 로 두어 catch 경로가 false 로 되돌리는지 검증
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('network'))) as unknown as typeof fetch
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )
    await waitFor(() => expect(useStore.getState().authed).toBe(false))
  })
})
