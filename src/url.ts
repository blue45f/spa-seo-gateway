import { createHash } from 'node:crypto';
import { config } from './config.js';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  '_ga',
  'igshid',
]);

export function normalizeUrl(input: string): string {
  const u = new URL(input);
  u.hash = '';
  u.host = u.host.toLowerCase();

  const params = [...u.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAMS.has(k.toLowerCase()) && k !== config.bot.bypassQueryParam)
    .sort(([a], [b]) => a.localeCompare(b));

  u.search = '';
  for (const [k, v] of params) u.searchParams.append(k, v);

  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.replace(/\/+$/, '');
  }
  return u.toString();
}

export function cacheKey(url: string, locale = 'default'): string {
  const norm = normalizeUrl(url);
  const hash = createHash('sha1').update(`${norm}|${locale}`).digest('hex').slice(0, 16);
  return `${hash}`;
}

export function isHostAllowed(targetUrl: string): boolean {
  const u = new URL(targetUrl);
  const allow = config.allowedHosts;
  if (allow.length === 0 && config.originUrl) {
    const origin = new URL(config.originUrl);
    return u.host === origin.host;
  }
  if (allow.length === 0) return true;
  return allow.some((h) => h === u.host);
}

export function buildTargetUrl(req: {
  url: string;
  headers: Record<string, string | string[] | undefined>;
}): string {
  const explicit = (req.headers['x-render-url'] as string | undefined) ?? null;
  if (explicit) return explicit;
  if (config.originUrl) {
    const u = new URL(req.url, config.originUrl);
    return u.toString();
  }
  const host = (req.headers['x-forwarded-host'] ?? req.headers.host) as string | undefined;
  if (!host) throw new Error('cannot infer target URL: missing host header and originUrl');
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https';
  return `${proto}://${host}${req.url}`;
}
