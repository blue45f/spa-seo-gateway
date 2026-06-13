import { assessQuality, shortTtlForStatus } from '@heejun/spa-seo-gateway-core'
import { describe, expect, it } from 'vitest'

describe('assessQuality extra branches', () => {
  it('reports too-small for tiny body text', () => {
    const v = assessQuality('<html><body><p>hi</p></body></html>', { minTextLength: 50 })
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('too-small')
    expect(v.textLength).toBe(2)
  })

  it('reports empty when body is missing', () => {
    const v = assessQuality('<html></html>')
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('empty')
  })

  it('reports empty when body contains only scripts', () => {
    const v = assessQuality('<html><body><script>console.log(1)</script></body></html>')
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('empty')
  })

  it('detects Korean "페이지를 찾을 수 없" in title as soft-404', () => {
    const v = assessQuality(
      '<html><head><title>페이지를 찾을 수 없습니다</title></head><body>x</body></html>'
    )
    expect(v.reason).toBe('soft-404')
  })

  it('detects 500 / Internal Server Error in title as error-page', () => {
    const v = assessQuality(
      '<html><head><title>500 Internal Server Error</title></head><body>x</body></html>'
    )
    expect(v.reason).toBe('error-page')
  })

  it('passes for normal content above the minimum', () => {
    const v = assessQuality(
      '<html><body><p>This is a sentence that is long enough to pass the minimum text length threshold.</p></body></html>'
    )
    expect(v.ok).toBe(true)
    expect(v.reason).toBe('ok')
    expect(v.textLength).toBeGreaterThan(50)
  })
})

describe('shortTtlForStatus', () => {
  it.each([
    [500, 60_000],
    [502, 60_000],
    [503, 60_000],
    [404, 5 * 60_000],
    [410, 5 * 60_000],
    [400, 60_000],
    [403, 60_000],
  ])('status %d → %dms', (status, ttl) => {
    expect(shortTtlForStatus(status)).toBe(ttl)
  })

  it.each([200, 201, 301, 302])('returns null for OK/redirect status %d', (status) => {
    expect(shortTtlForStatus(status)).toBeNull()
  })
})
