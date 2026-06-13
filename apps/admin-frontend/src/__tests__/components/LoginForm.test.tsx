import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LoginForm } from '../../components/LoginForm'
import { useStore } from '../../lib/store'
import { mockJsonFetch, renderWithRouter, resetStore } from '../test-utils'

const originalFetch = globalThis.fetch

beforeEach(() => {
  resetStore()
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('LoginForm', () => {
  it('renders a labelled password input and a submit button', () => {
    renderWithRouter(<LoginForm />)
    const input = screen.getByLabelText('admin token') as HTMLInputElement
    expect(input.type).toBe('password')
    expect(input.autocomplete).toBe('current-password')
  })

  it('submit button is disabled when empty', () => {
    renderWithRouter(<LoginForm />)
    const buttons = screen
      .getAllByRole('button')
      .filter((b) => (b as HTMLButtonElement).type === 'submit')
    expect(buttons[0]).toBeDisabled()
  })

  it('successful submit sets authed=true and pushes a success toast', async () => {
    globalThis.fetch = mockJsonFetch({ ok: true })
    renderWithRouter(<LoginForm />)
    fireEvent.change(screen.getByLabelText('admin token'), { target: { value: 'sekret' } })
    const submitBtns = screen
      .getAllByRole('button')
      .filter((b) => (b as HTMLButtonElement).type === 'submit')
    fireEvent.click(submitBtns[0]!)
    await waitFor(() => expect(useStore.getState().authed).toBe(true))
    const toasts = useStore.getState().toasts
    expect(toasts.length).toBeGreaterThan(0)
    expect(toasts[0]!.kind).toBe('success')
  })

  it('failed submit sets a global error and an error toast', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'bad token' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    )
    renderWithRouter(<LoginForm />)
    fireEvent.change(screen.getByLabelText('admin token'), { target: { value: 'wrong' } })
    const submitBtns = screen
      .getAllByRole('button')
      .filter((b) => (b as HTMLButtonElement).type === 'submit')
    fireEvent.click(submitBtns[0]!)
    await waitFor(() => expect(useStore.getState().globalError).toBe('bad token'))
    expect(useStore.getState().authed).toBe(false)
    const toasts = useStore.getState().toasts
    expect(toasts.some((t) => t.kind === 'error' && t.message === 'bad token')).toBe(true)
  })

  it('ignores submit when the token is only whitespace', () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    renderWithRouter(<LoginForm />)
    fireEvent.change(screen.getByLabelText('admin token'), { target: { value: '   ' } })
    const submitBtns = screen
      .getAllByRole('button')
      .filter((b) => (b as HTMLButtonElement).type === 'submit')
    // Button stays disabled (trim()).
    expect(submitBtns[0]).toBeDisabled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
