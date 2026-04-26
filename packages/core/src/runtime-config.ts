import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { config, type RouteOverride } from './config.js';
import { logger } from './logger.js';

type CompiledRoute = RouteOverride & { regex: RegExp };

let routes: CompiledRoute[] = config.routes.map((r) => ({
  ...r,
  regex: new RegExp(r.pattern),
}));

export function getRoutes(): RouteOverride[] {
  return routes.map(({ regex: _r, ...rest }) => rest);
}

export function setRoutes(next: RouteOverride[]): void {
  routes = next.map((r) => ({ ...r, regex: new RegExp(r.pattern) }));
  logger.info({ count: routes.length }, 'routes updated at runtime');
}

export function matchRoute(targetUrl: string): RouteOverride | null {
  let path: string;
  try {
    const u = new URL(targetUrl);
    path = u.pathname + u.search;
  } catch {
    return null;
  }
  for (const r of routes) {
    if (r.regex.test(path)) {
      const { regex: _r, ...rest } = r;
      return rest;
    }
  }
  return null;
}

const PERSIST_FILE =
  process.env.GATEWAY_CONFIG_FILE ?? resolve(process.cwd(), 'seo-gateway.config.json');

export async function persistRoutesToFile(): Promise<{
  ok: boolean;
  path: string;
  error?: string;
}> {
  try {
    let existing: Record<string, unknown> = {};
    try {
      existing = JSON.parse(await fs.readFile(PERSIST_FILE, 'utf8')) as Record<string, unknown>;
    } catch {
      /* file may not exist; start fresh */
    }
    const merged = { ...existing, routes: getRoutes() };
    const tmp = `${PERSIST_FILE}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
    await fs.rename(tmp, PERSIST_FILE);
    logger.info({ path: PERSIST_FILE }, 'routes persisted');
    return { ok: true, path: PERSIST_FILE };
  } catch (e) {
    return { ok: false, path: PERSIST_FILE, error: (e as Error).message };
  }
}

export type SiteSummary = {
  origin: string | undefined;
  mode: 'render-only' | 'proxy' | 'cms' | 'saas';
  routes: number;
};

export function getSiteSummary(): SiteSummary {
  return { origin: config.originUrl, mode: config.mode, routes: routes.length };
}
