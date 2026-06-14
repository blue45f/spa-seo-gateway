import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { policyApiUrl } from '../../lib/policy'
import { Policy } from '../../pages/Policy'
import { renderWithRouter, resetStore } from '../test-utils'

const originalFetch = globalThis.fetch

beforeEach(() => {
  resetStore()
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

const TERMS_PAYLOAD = {
  orgName: 'SPA SEO Gateway',
  policySlug: 'terms-of-service',
  name: '이용약관',
  type: 'terms',
  locale: 'ko',
  versionId: 'spa-seo-gateway:terms-of-service:v1',
  versionLabel: 'v1',
  contentHash: 'fde75b8817f680600e3089f61e096877717ed21232788537a368038b3f19a2e6',
  body: '제1조 (목적)\n이 이용약관은 서비스 이용 조건을 정합니다.\n\n제2조 (서비스 범위)\n- 렌더링\n- 캐시',
  effectiveAt: '2026-06-08T00:00:00.000Z',
  publishedAt: '2026-06-08T00:00:00.000Z',
  changeSummary: 'TermsDesk 중앙 게시본으로 이전',
  availableVersions: ['v1'],
  unresolvedVars: [],
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('Policy page', () => {
  it('renders the TermsDesk document with the trust surface', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(TERMS_PAYLOAD)))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    renderWithRouter(<Policy slug="terms-of-service" />)

    // 본문 — 조문 표제는 페이지 표제(h2) 아래 h3 로 렌더
    expect(
      await screen.findByRole('heading', { level: 3, name: '제1조 (목적)' })
    ).toBeInTheDocument()
    expect(screen.getByText('렌더링')).toBeInTheDocument()

    // 신뢰 표면 — versionLabel · 시행일 · hash 12자 · 원문 링크
    expect(screen.getByText('v1')).toBeInTheDocument()
    expect(screen.getByText('2026년 6월 8일')).toBeInTheDocument()
    const hash = screen.getByText('fde75b8817f6')
    expect(hash).toBeInTheDocument()
    expect(hash).toHaveAttribute('title', TERMS_PAYLOAD.contentHash)
    expect(screen.getByRole('link', { name: /TermsDesk 원문/ })).toHaveAttribute(
      'href',
      'https://termsdesk.vercel.app/p/spa-seo-gateway/terms-of-service'
    )

    expect(fetchMock).toHaveBeenCalledWith(policyApiUrl('terms-of-service'), expect.anything())
  })

  it('fetches the privacy slug on /privacy and links its original', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          ...TERMS_PAYLOAD,
          policySlug: 'privacy-policy',
          name: '개인정보처리방침',
          type: 'privacy',
        })
      )
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch
    renderWithRouter(<Policy slug="privacy-policy" />, { initialEntries: ['/privacy'] })

    expect(
      await screen.findByRole('heading', { level: 2, name: '개인정보처리방침' })
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(policyApiUrl('privacy-policy'), expect.anything())
    // 문서 로드가 끝나면 신뢰 표면(원문 링크)이 footer 에 렌더된다.
    expect(await screen.findByRole('link', { name: /TermsDesk 원문/ })).toHaveAttribute(
      'href',
      'https://termsdesk.vercel.app/p/spa-seo-gateway/privacy-policy'
    )
  })

  it('shows a loading skeleton while the document is in flight', () => {
    globalThis.fetch = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch
    renderWithRouter(<Policy slug="terms-of-service" />)
    expect(screen.getByTestId('policy-loading')).toBeInTheDocument()
  })

  it('falls back to an error surface with retry + original link on HTTP failure', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(jsonResponse({ error: 'down' }, 503))
    ) as unknown as typeof fetch
    const user = userEvent.setup()
    renderWithRouter(<Policy slug="terms-of-service" />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('문서를 불러오지 못했습니다.')
    expect(screen.getByRole('link', { name: /TermsDesk 원문/ })).toHaveAttribute(
      'href',
      'https://termsdesk.vercel.app/p/spa-seo-gateway/terms-of-service'
    )

    // 재시도 — 성공 응답으로 교체 후 본문이 렌더되는지
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(jsonResponse(TERMS_PAYLOAD))
    ) as unknown as typeof fetch
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(
      await screen.findByRole('heading', { level: 3, name: '제1조 (목적)' })
    ).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('treats schema-guard failures as errors instead of rendering garbage', async () => {
    const { contentHash: _omitted, ...invalid } = TERMS_PAYLOAD
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(jsonResponse(invalid))
    ) as unknown as typeof fetch
    renderWithRouter(<Policy slug="terms-of-service" />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('v1')).not.toBeInTheDocument()
  })
})
