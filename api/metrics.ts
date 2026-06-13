/**
 * Vercel Serverless Function — /metrics proxy.
 *
 * Proxies the gateway /metrics endpoint (Prometheus text format).
 * Returns empty metrics when GATEWAY_URL is not configured.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

const GATEWAY_URL = process.env.GATEWAY_URL ?? ''

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  if (!GATEWAY_URL) {
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    return res.status(200).send('# HELP No gateway connected (GATEWAY_URL not set)\n')
  }

  try {
    const upstream = await fetch(`${GATEWAY_URL.replace(/\/$/, '')}/metrics`, {
      signal: AbortSignal.timeout(10_000),
    })
    const body = await upstream.text()
    res.setHeader('content-type', upstream.headers.get('content-type') ?? 'text/plain')
    return res.status(upstream.status).send(body)
  } catch (e) {
    return res.status(502).send(`# ERROR: ${(e as Error).message}\n`)
  }
}
