import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
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

export function cacheKey(url: string, locale = 'default', namespace = ''): string {
  return createHash('sha1')
    .update(`${namespace}|${normalize(url)}|${locale}`)
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
];
const PRIVATE_V6 = [/^::1$/, /^::$/, /^fc/i, /^fd/i, /^fe[89ab]/i];

function isPrivateIp(addr: string): boolean {
  if (addr.includes('.')) return PRIVATE_V4.some((re) => re.test(addr));
  return PRIVATE_V6.some((re) => re.test(addr));
}

const SAFE_TTL_MS = 5 * 60_000;
const safeCache = new Map<string, { ok: boolean; reason?: string; expiresAt: number }>();

export async function isSafeTarget(targetUrl: string): Promise<{ ok: boolean; reason?: string }> {
  let host: string;
  try {
    host = new URL(targetUrl).hostname;
  } catch {
    return { ok: false, reason: 'invalid url' };
  }
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return { ok: false, reason: `loopback host: ${host}` };
  }
  const cached = safeCache.get(host);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: cached.ok, reason: cached.reason };
  }
  try {
    const { address } = await lookup(host);
    const verdict = isPrivateIp(address)
      ? { ok: false, reason: `private address resolved: ${address}` }
      : { ok: true as const };
    safeCache.set(host, { ...verdict, expiresAt: Date.now() + SAFE_TTL_MS });
    return verdict;
  } catch (e) {
    return { ok: false, reason: `dns lookup failed: ${(e as Error).message}` };
  }
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
