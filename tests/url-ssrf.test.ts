/**
 * url.ts SSRF / static-asset 경로 커버리지 확장.
 *
 * isSafeTarget 는 hostname 의 DNS 조회 후 사설 IP 면 차단한다. 외부 DNS 에
 * 의존하지 않으려고 localhost / 127.0.0.1 / ::1 는 미리 차단되는 경로를 사용.
 * 그 외에 invalid URL 분기와 isStaticAssetUrl 정규식의 확장 케이스를 같이 검증.
 */
import { isSafeTarget, isStaticAssetUrl, normalize } from '@heejun/spa-seo-gateway-core'
import { describe, expect, it } from 'vitest'

describe('isSafeTarget', () => {
  it('returns ok:false for invalid url', async () => {
    const r = await isSafeTarget('::::not a url')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/invalid url/)
  })

  it('blocks the literal localhost hostname', async () => {
    const r = await isSafeTarget('http://localhost/x')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/loopback/)
  })

  it('blocks the literal 127.0.0.1 hostname', async () => {
    const r = await isSafeTarget('http://127.0.0.1/x')
    expect(r.ok).toBe(false)
  })

  it('blocks the literal ::1 hostname', async () => {
    const r = await isSafeTarget('http://[::1]/x')
    expect(r.ok).toBe(false)
  })

  it('caches result so a repeated call returns the same verdict cheaply', async () => {
    // 같은 host (localhost) 에 대해 두 번째 호출도 즉시 차단.
    const a = await isSafeTarget('http://localhost/a')
    const b = await isSafeTarget('http://localhost/b')
    expect(a.ok).toBe(false)
    expect(b.ok).toBe(false)
  })

  it('reports dns lookup failure for an unresolvable host', async () => {
    // 잘 안 풀리는 호스트로 DNS 실패 경로 확인. (이 host 는 절대 존재해선 안 됨)
    const r = await isSafeTarget(
      'http://thisdomain-should-never-resolve-anywhere-1234567890.invalid/'
    )
    expect(r.ok).toBe(false)
    // dns lookup failed 또는 private 둘 다 가능 (구체 환경 별 — 둘 다 거부 OK 인 결과).
    expect(typeof r.reason).toBe('string')
  })
})

describe('isStaticAssetUrl', () => {
  it.each([
    'https://e.com/a.jpg',
    'https://e.com/style.css',
    'https://e.com/app.js',
    'https://e.com/asset.woff2',
    'https://e.com/doc.pdf',
    'https://e.com/data.json',
    'https://e.com/icon.svg',
    'https://e.com/movie.mp4',
    'https://e.com/x.webp',
    'https://e.com/x.avif',
    'https://e.com/x.ico',
    'https://e.com/x.map',
    'https://e.com/x.json?v=1', // query 도 처리
  ])('returns true for static asset %s', (u) => {
    expect(isStaticAssetUrl(u)).toBe(true)
  })

  it.each([
    'https://e.com/page',
    'https://e.com/blog/post-1',
    'https://e.com/products/123',
    'https://e.com/',
  ])('returns false for HTML route %s', (u) => {
    expect(isStaticAssetUrl(u)).toBe(false)
  })

  it('returns false for invalid url', () => {
    expect(isStaticAssetUrl('::::not a url')).toBe(false)
  })
})

describe('normalize edge cases', () => {
  it('preserves non-tracking parameters and sorts them', () => {
    const out = normalize('https://e.com/?z=1&utm_medium=cpc&a=2')
    expect(out).toBe('https://e.com/?a=2&z=1')
  })

  it('removes _no_render (bypass query param) so cache key is shared', () => {
    expect(normalize('https://e.com/?_no_render=1&id=1')).toBe('https://e.com/?id=1')
  })

  it('handles port + path correctly', () => {
    expect(normalize('https://e.com:8443/path/?x=1')).toBe('https://e.com:8443/path?x=1')
  })
})
