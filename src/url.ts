import { createHash } from 'node:crypto';
import normalizeUrlImport from 'normalize-url';
import { config } from './config.js';

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
];

export function normalize(input: string): string {
  return normalizeUrlImport(input, {
    removeTrailingSlash: true,
    sortQueryParameters: true,
    stripHash: true,
    removeQueryParameters: [...TRACKING_PARAMS, config.bot.bypassQueryParam],
  });
}

export function cacheKey(url: string, locale = 'default'): string {
  return createHash('sha1')
    .update(`${normalize(url)}|${locale}`)
    .digest('hex')
    .slice(0, 16);
}

export function isHostAllowed(targetUrl: string): boolean {
  const u = new URL(targetUrl);
  if (config.allowedHosts.length === 0 && config.originUrl) {
    return u.host === new URL(config.originUrl).host;
  }
  if (config.allowedHosts.length === 0) return true;
  return config.allowedHosts.includes(u.host);
}

export function buildTargetUrl(req: {
  url: string;
  headers: Record<string, string | string[] | undefined>;
}): string {
  const explicit = req.headers['x-render-url'] as string | undefined;
  if (explicit) return explicit;
  if (config.originUrl) return new URL(req.url, config.originUrl).toString();
  const host = (req.headers['x-forwarded-host'] ?? req.headers.host) as string | undefined;
  if (!host) throw new Error('cannot infer target URL: missing host header and originUrl');
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https';
  return `${proto}://${host}${req.url}`;
}
