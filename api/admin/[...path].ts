/**
 * Vercel Serverless Function — catch-all proxy for /admin/api/*.
 *
 * Proxies every /admin/api/* request to the real gateway backend
 * configured via the GATEWAY_URL environment variable (e.g. https://spa-seo-gateway.fly.dev).
 *
 * When GATEWAY_URL is not set, falls back to a minimal mock response
 * so the admin UI can still render its Welcome page in degraded mode.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  api: {
    bodyParser: false,
  },
}

const GATEWAY_URL = process.env.GATEWAY_URL ?? ''
const PROXY_TIMEOUT_MS = 30_000

/** Headers that must NOT be forwarded to upstream. */
const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'proxy-authorization',
  'proxy-authenticate',
])

/** Headers that must NOT be forwarded back to the client. */
const STRIP_RESPONSE = new Set([
  'transfer-encoding',
  'connection',
  'keep-alive',
  'content-encoding',
  'content-length',
])

function filterHeaders(
  headers: Record<string, string | string[] | undefined>,
  blocklist: Set<string>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (blocklist.has(key.toLowerCase())) continue
    if (value === undefined) continue
    out[key] = Array.isArray(value) ? value.join(', ') : value
  }
  return out
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // /api/admin/[...path] is matched by Vercel file-system routing.
  // We reconstruct the original gateway path: /admin/api/<rest>
  const pathSegments = req.query.path
  const subPath = Array.isArray(pathSegments) ? pathSegments.join('/') : (pathSegments ?? '')
  const upstreamPath = `/admin/api/${subPath}`

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path' || value == null) continue
    for (const item of Array.isArray(value) ? value : [value]) {
      search.append(key, String(item))
    }
  }
  const queryStr = search.toString()

  if (!GATEWAY_URL) {
    return serveMock(upstreamPath, res)
  }

  const upstreamUrl = `${GATEWAY_URL.replace(/\/$/, '')}${upstreamPath}${queryStr ? `?${queryStr}` : ''}`

  const forwardHeaders = filterHeaders(
    req.headers as Record<string, string | string[] | undefined>,
    HOP_BY_HOP
  )
  // Tell the gateway who the original host was (for cookie domain decisions).
  forwardHeaders['x-forwarded-host'] = req.headers.host ?? ''
  forwardHeaders['x-forwarded-proto'] = 'https'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method ?? 'GET',
      headers: forwardHeaders,
      body:
        req.method !== 'GET' && req.method !== 'HEAD' ? (req as unknown as BodyInit) : undefined,
      signal: controller.signal,
      redirect: 'manual',
    })

    const responseHeaders = filterHeaders(
      Object.fromEntries(upstream.headers.entries()),
      STRIP_RESPONSE
    )
    for (const [key, value] of Object.entries(responseHeaders)) {
      res.setHeader(key, value)
    }

    // Always add CORS-safe headers so the browser doesn't complain.
    res.setHeader('x-proxy', 'vercel-gateway')

    const body = await upstream.text()
    return res.status(upstream.status).send(body)
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return res.status(504).json({ ok: false, error: 'gateway timeout' })
    }
    return res
      .status(502)
      .json({ ok: false, error: `gateway unreachable: ${(e as Error).message}` })
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fallback mock responses when GATEWAY_URL is not configured.
 * Only the minimum set for the Welcome page to render.
 */
function serveMock(path: string, res: VercelResponse) {
  if (path === '/admin/api/public/info') {
    return res.status(200).json({
      ok: true,
      mode: 'demo',
      origin: null,
      multiContext: false,
      cache: { ttlMs: 86_400_000, swrMs: 3_600_000, redisEnabled: false },
      site: { origin: null, mode: 'demo', routes: 0 },
      nodeVersion: process.version,
      uptimeSec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      _demo: true,
    })
  }

  if (path === '/admin/api/whoami') {
    return res.status(200).json({ ok: true, authenticated: false, adminEnabled: false })
  }

  return res.status(501).json({
    ok: false,
    error:
      'GATEWAY_URL not configured — set it in Vercel Environment Variables to enable live mode.',
  })
}
