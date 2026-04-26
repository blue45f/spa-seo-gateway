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

function defaultPersistFile(): string {
  return process.env.GATEWAY_CONFIG_FILE ?? resolve(process.cwd(), 'seo-gateway.config.json');
}

export async function persistRoutesToFile(
  filePath?: string,
): Promise<{ ok: boolean; path: string; error?: string }> {
  const target = filePath ?? defaultPersistFile();
  try {
    let existing: Record<string, unknown> = {};
    try {
      existing = JSON.parse(await fs.readFile(target, 'utf8')) as Record<string, unknown>;
    } catch {
      /* file may not exist; start fresh */
    }
    const merged = { ...existing, routes: getRoutes() };
    const tmp = `${target}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
    await fs.rename(tmp, target);
    logger.info({ path: target }, 'routes persisted');
    return { ok: true, path: target };
  } catch (e) {
    return { ok: false, path: target, error: (e as Error).message };
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
