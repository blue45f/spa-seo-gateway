import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../lib/api'
import {
  fetchPolicyDocument,
  formatPolicyDate,
  parsePolicyBody,
  parsePolicyDocument,
  policyApiUrl,
  policyPublicUrl,
} from '../../lib/policy'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

/** TermsDesk 라이브 응답 모양 (여분 메타 포함). */
const VALID_PAYLOAD = {
  orgName: 'SPA SEO Gateway',
  policySlug: 'terms-of-service',
  name: '이용약관',
  type: 'terms',
  locale: 'ko',
  versionId: 'spa-seo-gateway:terms-of-service:v1',
  versionLabel: 'v1',
  contentHash: 'fde75b8817f680600e3089f61e096877717ed21232788537a368038b3f19a2e6',
  body: '제1조 (목적)\n본문.',
  effectiveAt: '2026-06-08T00:00:00.000Z',
  publishedAt: '2026-06-08T00:00:00.000Z',
  changeSummary: 'TermsDesk 중앙 게시본으로 이전',
  availableVersions: ['v1'],
  unresolvedVars: [],
}

describe('policy URLs', () => {
  it('builds the public API URL per slug', () => {
    expect(policyApiUrl('terms-of-service')).toBe(
      'https://desk-platform.vercel.app/termsdesk/api/public/spa-seo-gateway/policies/terms-of-service'
    )
    expect(policyApiUrl('privacy-policy')).toBe(
      'https://desk-platform.vercel.app/termsdesk/api/public/spa-seo-gateway/policies/privacy-policy'
    )
  })

  it('builds the rendered fallback page URL per slug', () => {
    expect(policyPublicUrl('privacy-policy')).toBe(
      'https://desk-platform.vercel.app/termsdesk/p/spa-seo-gateway/privacy-policy'
    )
  })
})

describe('parsePolicyDocument (schema guard)', () => {
  it('accepts a live-shaped payload and keeps only known fields', () => {
    const doc = parsePolicyDocument(VALID_PAYLOAD)
    expect(doc).not.toBeNull()
    expect(doc?.versionLabel).toBe('v1')
    expect(doc?.contentHash).toBe(VALID_PAYLOAD.contentHash)
    expect(doc && 'orgName' in doc).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(parsePolicyDocument(null)).toBeNull()
    expect(parsePolicyDocument('html error page')).toBeNull()
    expect(parsePolicyDocument([VALID_PAYLOAD])).toBeNull()
  })

  it('rejects missing or empty required fields', () => {
    const { contentHash: _omitted, ...withoutHash } = VALID_PAYLOAD
    expect(parsePolicyDocument(withoutHash)).toBeNull()
    expect(parsePolicyDocument({ ...VALID_PAYLOAD, body: '' })).toBeNull()
    expect(parsePolicyDocument({ ...VALID_PAYLOAD, versionLabel: 1 })).toBeNull()
  })

  it('tolerates null/absent optional meta but rejects wrong types', () => {
    const doc = parsePolicyDocument({ ...VALID_PAYLOAD, effectiveAt: null, changeSummary: null })
    expect(doc?.effectiveAt).toBeNull()
    const { effectiveAt: _omitted, ...withoutEffective } = VALID_PAYLOAD
    expect(parsePolicyDocument(withoutEffective)?.effectiveAt).toBeNull()
    expect(parsePolicyDocument({ ...VALID_PAYLOAD, effectiveAt: 123 })).toBeNull()
  })
})

describe('fetchPolicyDocument', () => {
  it('surfaces HTTP failures as ApiError', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response('{}', { status: 404, statusText: 'Not Found' }))
    ) as unknown as typeof fetch
    await expect(fetchPolicyDocument('terms-of-service')).rejects.toMatchObject({ status: 404 })
    await expect(fetchPolicyDocument('terms-of-service')).rejects.toBeInstanceOf(ApiError)
  })

  it('rejects payloads that fail the schema guard', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    ) as unknown as typeof fetch
    await expect(fetchPolicyDocument('terms-of-service')).rejects.toThrow(/validation/)
  })

  it('requests the API URL with a JSON accept header', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(VALID_PAYLOAD), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const doc = await fetchPolicyDocument('privacy-policy')
    expect(doc.name).toBe('이용약관')
    expect(fetchMock).toHaveBeenCalledWith(
      policyApiUrl('privacy-policy'),
      expect.objectContaining({ headers: { accept: 'application/json' } })
    )
  })
})

describe('formatPolicyDate', () => {
  it('formats in the requested language, pinned to UTC', () => {
    expect(formatPolicyDate('2026-06-08T00:00:00.000Z', 'ko')).toBe('2026년 6월 8일')
    expect(formatPolicyDate('2026-06-08T00:00:00.000Z', 'en')).toBe('June 8, 2026')
  })

  it('returns the raw value when unparsable', () => {
    expect(formatPolicyDate('not-a-date', 'ko')).toBe('not-a-date')
  })
})

describe('parsePolicyBody (minimal article parser)', () => {
  it('promotes standalone 조문 표제 lines to headings', () => {
    const blocks = parsePolicyBody('제1조 (목적)\n첫 줄\n둘째 줄\n\n제2조\n내용')
    expect(blocks).toEqual([
      { kind: 'heading', level: 2, text: '제1조 (목적)' },
      { kind: 'paragraph', text: '첫 줄\n둘째 줄' },
      { kind: 'heading', level: 2, text: '제2조' },
      { kind: 'paragraph', text: '내용' },
    ])
  })

  it('keeps 제N조 references inside a paragraph as plain text', () => {
    const blocks = parsePolicyBody('이 약관은\n제3조 (인용)\n을 따른다')
    expect(blocks).toEqual([{ kind: 'paragraph', text: '이 약관은\n제3조 (인용)\n을 따른다' }])
  })

  it('demotes markdown headings one level below the page title', () => {
    const blocks = parsePolicyBody('# 제목\n\n## 소제목\n\n###### 깊은 제목')
    expect(blocks).toEqual([
      { kind: 'heading', level: 2, text: '제목' },
      { kind: 'heading', level: 3, text: '소제목' },
      { kind: 'heading', level: 6, text: '깊은 제목' },
    ])
  })

  it('collects bullet and ordered lists separately', () => {
    const blocks = parsePolicyBody('- a\n- b\n1. one\n2) two')
    expect(blocks).toEqual([
      { kind: 'list', ordered: false, items: ['a', 'b'] },
      { kind: 'list', ordered: true, items: ['one', 'two'] },
    ])
  })

  it('emits dividers and flushes surrounding paragraphs', () => {
    const blocks = parsePolicyBody('문단\n---\n다음 문단')
    expect(blocks).toEqual([
      { kind: 'paragraph', text: '문단' },
      { kind: 'divider' },
      { kind: 'paragraph', text: '다음 문단' },
    ])
  })
})
