import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Layout } from '../../components/Layout'
import { mockJsonFetch, resetStore } from '../test-utils'

const originalFetch = globalThis.fetch

beforeEach(() => {
  resetStore()
  globalThis.fetch = mockJsonFetch({ ok: true, mode: 'render-only' })
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<div data-testid="child" />} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('Layout footer legal links', () => {
  it('routes terms/privacy to internal pages (no new tab)', () => {
    renderLayout()
    const legalNav = screen.getByRole('navigation', { name: '법적 고지 링크' })

    const terms = within(legalNav).getByRole('link', { name: '이용약관' })
    expect(terms).toHaveAttribute('href', '/terms')
    expect(terms).not.toHaveAttribute('target')

    const privacy = within(legalNav).getByRole('link', { name: '개인정보처리방침' })
    expect(privacy).toHaveAttribute('href', '/privacy')
    expect(privacy).not.toHaveAttribute('target')
  })

  it('keeps the support link external to TermsDesk', () => {
    renderLayout()
    const legalNav = screen.getByRole('navigation', { name: '법적 고지 링크' })
    const support = within(legalNav).getByRole('link', { name: '지원' })
    expect(support).toHaveAttribute('href', 'https://termsdesk.vercel.app/support/spa-seo-gateway')
    expect(support).toHaveAttribute('target', '_blank')
  })
})
