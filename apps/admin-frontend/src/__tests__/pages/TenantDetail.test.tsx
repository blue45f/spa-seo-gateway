import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DialogHost } from '../../components/DialogHost'
import { useDialogStore } from '../../lib/dialog'
import { useStore } from '../../lib/store'
import { TenantDetail } from '../../pages/TenantDetail'
import { resetStore, withQueryClient } from '../test-utils'

import type { Tenant } from '../../lib/types'

const TENANT: Tenant = {
  id: 'acme',
  name: 'ACME Corp',
  origin: 'https://www.acme.com',
  apiKey: 'tk_live_aaaaaaaaaaaaaaaaaaaa',
  routes: [{ pattern: '^/products/[0-9]+', ttlMs: 3600000 }],
  plan: 'pro',
  enabled: true,
}

const originalFetch = globalThis.fetch

beforeEach(() => {
  resetStore()
  useDialogStore.setState({ request: null })
  useStore.setState({ authed: true, adminEnabled: true })
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

function renderAt(path: string) {
  return render(
    withQueryClient(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/tenants/:id" element={<TenantDetail />} />
        </Routes>
        <DialogHost />
      </MemoryRouter>
    )
  )
}

describe('TenantDetail page', () => {
  it('shows metadata + apiKey + plan + routes', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, tenants: [TENANT] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    renderAt('/tenants/acme')
    await waitFor(() => expect(screen.getByTestId('page-tenant-detail')).toBeInTheDocument())
    expect(screen.getByDisplayValue('acme')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ACME Corp')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://www.acme.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue(TENANT.apiKey)).toBeInTheDocument()
    expect(screen.getByDisplayValue('pro')).toBeInTheDocument()
    expect(screen.getByDisplayValue('^/products/[0-9]+')).toBeInTheDocument()
  })

  it('rotate button issues a new apiKey after dialog confirm', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, tenants: [TENANT] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    renderAt('/tenants/acme')
    await waitFor(() => expect(screen.getByDisplayValue(TENANT.apiKey)).toBeInTheDocument())
    fireEvent.click(screen.getByText('API key 회전'))
    const dialog = await screen.findByTestId('app-dialog')
    expect(screen.getByText('API key 를 새로 발급할까요?')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByTestId('dialog-confirm'))
    await waitFor(() => {
      expect(screen.queryByDisplayValue(TENANT.apiKey)).not.toBeInTheDocument()
    })
    // 새 키는 tk_live_ 접두사 + 28자 이상
    const inputs = document.querySelectorAll('input')
    const apiKeyInput = Array.from(inputs).find((i) => i.value.startsWith('tk_live_'))
    expect(apiKeyInput).toBeDefined()
    expect((apiKeyInput as HTMLInputElement).value.length).toBeGreaterThanOrEqual(28)
    expect((apiKeyInput as HTMLInputElement).value).not.toBe(TENANT.apiKey)
  })

  it('shows not-found message for unknown id', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, tenants: [TENANT] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    renderAt('/tenants/missing')
    await waitFor(() => expect(screen.getByText(/존재하지 않는 테넌트/)).toBeInTheDocument())
  })

  it('save button POSTs full tenant with current routes', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, tenants: [TENANT] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, tenant: TENANT }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, tenants: [TENANT] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    globalThis.fetch = fetchMock
    renderAt('/tenants/acme')
    await waitFor(() => expect(screen.getByDisplayValue('acme')).toBeInTheDocument())

    fireEvent.click(screen.getByText('저장'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const postCall = fetchMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'POST'
    )
    expect(postCall).toBeDefined()
    const body = JSON.parse((postCall?.[1] as RequestInit).body as string)
    expect(body.id).toBe('acme')
    expect(body.plan).toBe('pro')
    expect(body.apiKey).toBe(TENANT.apiKey)
    expect(body.routes).toHaveLength(1)
    expect(body.routes[0].pattern).toBe('^/products/[0-9]+')
  })
})
