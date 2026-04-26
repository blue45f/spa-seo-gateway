import { existsSync, readFileSync, watch } from 'node:fs';
import { resolve } from 'node:path';
import { recordAudit } from './audit.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { setRoutes } from './runtime-config.js';

let active: ReturnType<typeof watch> | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

function configFilePath(): string {
  return process.env.GATEWAY_CONFIG_FILE ?? resolve(process.cwd(), 'seo-gateway.config.json');
}

function reloadOnce() {
  const file = configFilePath();
  if (!existsSync(file)) return;
  try {
    const raw = readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as { routes?: unknown[] };
    if (!Array.isArray(parsed.routes)) {
      logger.warn({ file }, 'hot reload: no routes[] in config file');
      return;
    }
    const routes = parsed.routes as Array<{ pattern: string; [k: string]: unknown }>;
    setRoutes(
      routes.filter((r): r is { pattern: string } => typeof r.pattern === 'string') as never[],
    );
    logger.info({ count: routes.length, file }, 'hot reload: routes updated');
    recordAudit({
      actor: 'hot-reload',
      action: 'routes.reload',
      target: file,
      outcome: 'ok',
      meta: { count: routes.length },
    });
  } catch (e) {
    logger.warn({ err: (e as Error).message, file }, 'hot reload failed');
    recordAudit({
      actor: 'hot-reload',
      action: 'routes.reload',
      target: file,
      outcome: 'error',
      meta: { error: (e as Error).message },
    });
  }
}

export function startHotReload(): void {
  if (!config.hotReload) {
    logger.info('hot reload disabled (set HOT_RELOAD=true to enable)');
    return;
  }
  const file = configFilePath();
  if (!existsSync(file)) {
    logger.info({ file }, 'hot reload: config file not present (will start when created)');
  }
  try {
    active = watch(file, { persistent: false }, () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(reloadOnce, 200);
    });
    process.on('SIGHUP', () => {
      logger.info('SIGHUP — manual reload');
      reloadOnce();
    });
    logger.info({ file }, 'hot reload watching config file');
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'hot reload setup failed');
  }
}

export function stopHotReload(): void {
  active?.close();
  active = null;
  if (debounceTimer) clearTimeout(debounceTimer);
}
