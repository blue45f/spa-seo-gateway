import type { FastifyInstance } from 'fastify'

/**
 * Baseline security response headers applied to every reply.
 *
 * The gateway serves prerendered HTML to bots/CDNs and exposes an admin API, so
 * a few conservative, framework-agnostic headers harden it without changing the
 * rendered payload itself. These are intentionally MINIMAL and additive:
 *
 *   - X-Content-Type-Options: nosniff        — stop MIME sniffing of responses
 *   - Referrer-Policy: strict-origin-when-cross-origin — don't leak full URLs
 *   - X-Frame-Options: SAMEORIGIN            — clickjacking guard for the admin UI
 *   - X-DNS-Prefetch-Control: off            — no speculative DNS from our HTML
 *   - Cross-Origin-Resource-Policy: same-origin (admin UI + API only)
 *
 * We deliberately do NOT set a Content-Security-Policy here: prerendered output
 * mirrors arbitrary origin SPAs whose CSP we can't know, so a blanket CSP would
 * break rendered pages. Operators who terminate TLS at a CDN/proxy should add
 * HSTS there (see docs/DEPLOYMENT.md).
 */
export function registerSecurityHeaders(app: FastifyInstance): void {
  app.addHook('onSend', async (req, reply, payload) => {
    // Never clobber the Prometheus exposition content-type or sniffing behavior
    // on /metrics, and leave /health JSON untouched beyond the safe defaults.
    if (!reply.hasHeader('x-content-type-options')) {
      reply.header('x-content-type-options', 'nosniff')
    }
    if (!reply.hasHeader('referrer-policy')) {
      reply.header('referrer-policy', 'strict-origin-when-cross-origin')
    }
    if (!reply.hasHeader('x-dns-prefetch-control')) {
      reply.header('x-dns-prefetch-control', 'off')
    }

    // Frame/CORP protections are most relevant for the admin UI + API surface.
    // Rendered SPA HTML is consumed server-side by crawlers, not framed, so the
    // same defaults are safe there too.
    if (req.url.startsWith('/admin')) {
      if (!reply.hasHeader('x-frame-options')) {
        reply.header('x-frame-options', 'SAMEORIGIN')
      }
      if (!reply.hasHeader('cross-origin-resource-policy')) {
        reply.header('cross-origin-resource-policy', 'same-origin')
      }
    }

    return payload
  })
}
