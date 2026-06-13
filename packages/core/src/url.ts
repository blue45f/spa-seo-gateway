import { createHash } from 'node:crypto'
import { lookup } from 'node:dns/promises'

import normalizeUrlImport from 'normalize-url'

import { config } from './config.js'

const TRACKING_PARAMS: ReadonlyArray<string | RegExp> = [
  /^utm_/i,
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  '_ga',
  'igshid',
]

export function normalize(input: string): string {
  return normalizeUrlImport(input, {
    removeTrailingSlash: true,
    sortQueryParameters: true,
    stripHash: true,
    removeQueryParameters: [...TRACKING_PARAMS, config.bot.bypassQueryParam],
  })
}

export function cacheKey(url: string, locale = 'default', namespace = ''): string {
  return createHash('sha1')
    .update(`${namespace}|${normalize(url)}|${locale}`)
    .digest('hex')
    .slice(0, 16)
}

export function isHostAllowed(targetUrl: string): boolean {
  let u: URL
  try {
    u = new URL(targetUrl)
  } catch {
    return false
  }
  if (config.allowedHosts.length === 0 && config.originUrl) {
    try {
      return u.host === new URL(config.originUrl).host
    } catch {
      return false
    }
  }
  if (config.allowedHosts.length === 0) return true
  return config.allowedHosts.includes(u.host)
}

const PRIVATE_V4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^198\.1[89]\./,
  /^203\.0\.113\./,
  /^224\./,
  /^240\./,
  /^255\.255\.255\.255$/,
]
const PRIVATE_V6 = [/^::1$/, /^::$/, /^fc/i, /^fd/i, /^fe[89ab]/i]
// IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1, ::ffff:7f00:1) — extract embedded
// IPv4 and re-test against PRIVATE_V4. Stops `http://[::ffff:127.0.0.1]/` bypass.
const V4_MAPPED_RE = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i
const V4_MAPPED_HEX_RE = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i

function isPrivateIp(addr: string): boolean {
  if (addr.includes('.') && !addr.includes(':')) {
    return PRIVATE_V4.some((re) => re.test(addr))
  }
  // IPv4-mapped IPv6 with dotted form
  const mapped = addr.match(V4_MAPPED_RE)
  if (mapped) return PRIVATE_V4.some((re) => re.test(mapped[1]!))
  // IPv4-mapped IPv6 with hex form (::ffff:7f00:1 → 127.0.0.1)
  const hex = addr.match(V4_MAPPED_HEX_RE)
  if (hex) {
    const a = Number.parseInt(hex[1]!, 16)
    const b = Number.parseInt(hex[2]!, 16)
    const dotted = `${(a >> 8) & 0xff}.${a & 0xff}.${(b >> 8) & 0xff}.${b & 0xff}`
    return PRIVATE_V4.some((re) => re.test(dotted))
  }
  return PRIVATE_V6.some((re) => re.test(addr))
}

const SAFE_TTL_MS = 5 * 60_000
const SAFE_CACHE_MAX = 1_024
const safeCache = new Map<string, { ok: boolean; reason?: string; expiresAt: number }>()

// Hostname strings we always reject before any DNS lookup. Belt-and-suspenders:
// the DNS lookup result still goes through isPrivateIp(), but blocking the
// literal first avoids leaking a DNS query for these. 0.0.0.0 routes to
// loopback on Linux; the IPv4-mapped IPv6 forms route to 127.0.0.1.
const ALWAYS_BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '::',
  '::ffff:127.0.0.1',
  '::ffff:0.0.0.0',
  '::ffff:7f00:1',
])

export async function isSafeTarget(targetUrl: string): Promise<{ ok: boolean; reason?: string }> {
  let host: string
  try {
    host = new URL(targetUrl).hostname
  } catch {
    return { ok: false, reason: 'invalid url' }
  }
  // URL parser strips [] around IPv6 literals from .hostname, but normalize for safety.
  const normHost = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
  const lower = normHost.toLowerCase()
  if (ALWAYS_BLOCKED_HOSTS.has(lower)) {
    return { ok: false, reason: `loopback host: ${normHost}` }
  }
  // Pure-numeric IP literal — skip DNS and validate directly. Avoids the case
  // where someone tries 2130706433 (== 127.0.0.1 as a 32-bit int) and the
  // resolver decodes it differently than our PRIVATE_V4 regex expects.
  if (/^[\d.]+$/.test(lower) || lower.includes(':')) {
    if (isPrivateIp(lower)) {
      return { ok: false, reason: `private address literal: ${lower}` }
    }
  }
  const cached = safeCache.get(lower)
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: cached.ok, reason: cached.reason }
  }
  try {
    const { address } = await lookup(lower)
    const verdict = isPrivateIp(address)
      ? { ok: false, reason: `private address resolved: ${address}` }
      : { ok: true as const }
    // Bounded LRU-ish: evict oldest on overflow.
    if (safeCache.size >= SAFE_CACHE_MAX) {
      const first = safeCache.keys().next().value
      if (first !== undefined) safeCache.delete(first)
    }
    safeCache.set(lower, { ...verdict, expiresAt: Date.now() + SAFE_TTL_MS })
    return verdict
  } catch (e) {
    return { ok: false, reason: `dns lookup failed: ${(e as Error).message}` }
  }
}

const STATIC_ASSET_RE =
  /\.(jpg|jpeg|png|gif|webp|avif|svg|ico|bmp|tiff|woff|woff2|ttf|otf|eot|css|js|mjs|map|mp3|mp4|webm|ogg|wav|pdf|zip|gz|tar|rar|7z|xml|txt|json|csv|xlsx|docx|pptx)(\?|$)/i

export function isStaticAssetUrl(targetUrl: string): boolean {
  try {
    return STATIC_ASSET_RE.test(new URL(targetUrl).pathname)
  } catch {
    return false
  }
}

export function buildTargetUrl(req: {
  url: string
  headers: Record<string, string | string[] | undefined>
}): string {
  const explicit = req.headers['x-render-url'] as string | undefined
  if (explicit) return explicit
  if (config.originUrl) return new URL(req.url, config.originUrl).toString()
  const host = (req.headers['x-forwarded-host'] ?? req.headers.host) as string | undefined
  if (!host) throw new Error('cannot infer target URL: missing host header and originUrl')
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https'
  return `${proto}://${host}${req.url}`
}
