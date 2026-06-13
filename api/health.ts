/**
 * Vercel Serverless Function — /health proxy.
 *
 * Proxies the gateway /health endpoint for uptime monitoring.
 * Returns mock data when GATEWAY_URL is not configured.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

const GATEWAY_URL = process.env.GATEWAY_URL ?? ''

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isDeep = req.url?.includes('/deep') ?? false

  if (!GATEWAY_URL) {
    if (isDeep) {
      return res.status(200).json({
        ok: true,
        probe: 'https://example.com/',
        status: 200,
        durationMs: 5,
        bytes: 1250,
        _demo: true,
      })
    }
    return res.status(200).json({
      ok: true,
      uptime: process.uptime(),
      pool: { idle: 0, busy: 0, total: 0 },
      cache: { size: 0, ttlMs: 86_400_000, redisEnabled: false },
      breakers: {},
      _demo: true,
    })
  }

  try {
    const path = isDeep ? '/health/deep' : '/health'
    const upstream = await fetch(`${GATEWAY_URL.replace(/\/$/, '')}${path}`, {
      signal: AbortSignal.timeout(10_000),
    })
    const body = await upstream.text()
    res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
    return res.status(upstream.status).send(body)
  } catch (e) {
    return res.status(502).json({ ok: false, error: (e as Error).message })
  }
}
