/**
 * SSRF 추가 강화 케이스 — url.ts 의 isSafeTarget 가 다음을 거부하는지 검증:
 *
 *   - 0.0.0.0 (Linux 에서 loopback 으로 라우팅됨)
 *   - IPv4-mapped IPv6 (`[::ffff:127.0.0.1]`, `[::ffff:7f00:1]`)
 *   - 대소문자 / wrapping 변형
 *
 * 그리고 isHostAllowed 가 invalid URL 입력에 throw 하지 않고 false 를 반환하는지.
 */
import { isHostAllowed, isSafeTarget } from '@heejun/spa-seo-gateway-core'
import { describe, expect, it } from 'vitest'

describe('isSafeTarget — additional loopback / IPv4-mapped IPv6 vectors', () => {
  it('blocks the literal 0.0.0.0 hostname (routes to loopback on Linux)', async () => {
    const r = await isSafeTarget('http://0.0.0.0/x')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/loopback|private/)
  })

  it('blocks the literal IPv4-mapped IPv6 [::ffff:127.0.0.1]', async () => {
    const r = await isSafeTarget('http://[::ffff:127.0.0.1]/x')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/loopback|private/)
  })

  it('blocks the literal IPv4-mapped IPv6 hex form [::ffff:7f00:1]', async () => {
    // 7f00:0001 == 127.0.0.1
    const r = await isSafeTarget('http://[::ffff:7f00:1]/x')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/loopback|private/)
  })

  it('blocks IPv4-mapped IPv6 to RFC1918 (e.g. ::ffff:10.0.0.1 → 10.0.0.1)', async () => {
    const r = await isSafeTarget('http://[::ffff:10.0.0.1]/x')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/private/)
  })

  it('blocks the literal "::" (unspecified) IPv6 address', async () => {
    const r = await isSafeTarget('http://[::]/x')
    expect(r.ok).toBe(false)
  })

  it('blocks uppercase variants — case insensitive matching', async () => {
    // hostname 도 .toLowerCase 처리되어야 함
    const r = await isSafeTarget('http://Localhost/x')
    expect(r.ok).toBe(false)
  })

  it('blocks a numeric IPv4 literal in RFC1918 (192.168.x.x) without DNS', async () => {
    // /^192\.168\./ regex 가 잡아야 함. DNS 의존 없이 즉시 거부.
    const r = await isSafeTarget('http://192.168.0.1/')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/private/)
  })

  it('blocks 169.254.169.254 (AWS/GCP metadata endpoint)', async () => {
    const r = await isSafeTarget('http://169.254.169.254/latest/meta-data/')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/private/)
  })

  it('blocks 172.16.0.1 (private range 172.16/12)', async () => {
    const r = await isSafeTarget('http://172.16.0.1/')
    expect(r.ok).toBe(false)
  })

  it('blocks ipv6 unique-local (fc00::/7)', async () => {
    const r = await isSafeTarget('http://[fc00::1]/')
    expect(r.ok).toBe(false)
  })

  it('blocks ipv6 link-local (fe80::/10)', async () => {
    const r = await isSafeTarget('http://[fe80::1]/')
    expect(r.ok).toBe(false)
  })
})

describe('isHostAllowed — defensive parsing', () => {
  it('returns false on totally invalid URL instead of throwing', () => {
    // 변경 전: new URL(...) throw. 변경 후: 안전한 false.
    expect(() => isHostAllowed('::::not a url')).not.toThrow()
    expect(isHostAllowed('::::not a url')).toBe(false)
  })

  it('returns boolean for empty string input', () => {
    expect(() => isHostAllowed('')).not.toThrow()
    expect(isHostAllowed('')).toBe(false)
  })
})
