/**
 * Vercel Serverless Function — /admin/api/public/info proxy.
 *
 * When GATEWAY_URL is set, proxies to the real gateway's /admin/api/public/info.
 * Otherwise, returns a mock response for the admin UI Welcome card.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

const GATEWAY_URL = process.env.GATEWAY_URL ?? ''

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  if (!GATEWAY_URL) {
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
      _note:
        'GATEWAY_URL not configured. Set it in Vercel Environment Variables to connect to a live gateway.',
    })
  }

  try {
    const upstream = await fetch(`${GATEWAY_URL.replace(/\/$/, '')}/admin/api/public/info`, {
      signal: AbortSignal.timeout(10_000),
    })
    const body = await upstream.text()
    res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
    return res.status(upstream.status).send(body)
  } catch (e) {
    return res.status(502).json({ ok: false, error: (e as Error).message })
  }
}
