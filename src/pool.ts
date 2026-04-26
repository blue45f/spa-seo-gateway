import puppeteer, { type Browser, type Page } from 'puppeteer';
import { config } from './config.js';
import { logger } from './logger.js';
import { browserPool as poolMetric } from './metrics.js';

type Holder = {
  id: number;
  browser: Browser;
  startedAt: number;
  totalCount: number;
  activeCount: number;
  recycling: boolean;
};

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-zygote',
  '--disable-gpu',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-breakpad',
  '--disable-component-extensions-with-background-pages',
  '--disable-features=TranslateUI,BlinkGenPropertyTrees,IsolateOrigins,site-per-process',
  '--disable-ipc-flooding-protection',
  '--disable-renderer-backgrounding',
  '--enable-features=NetworkService,NetworkServiceInProcess',
  '--force-color-profile=srgb',
  '--metrics-recording-only',
  '--mute-audio',
];

class BrowserPool {
  private holders: Holder[] = [];
  private nextId = 1;
  private maxConcurrent = config.renderer.poolMax;
  private currentConcurrent = 0;
  private waiters: Array<() => void> = [];
  private starting: Promise<void> | null = null;
  private stopped = false;

  async start(): Promise<void> {
    if (this.starting) return this.starting;
    this.starting = (async () => {
      const min = Math.min(config.renderer.poolMin, config.renderer.poolMax);
      const initial = Array.from({ length: min }, () => this.spawn());
      await Promise.all(initial);
      logger.info({ count: this.holders.length }, 'browser pool ready');
      this.updateMetrics();
    })();
    return this.starting;
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await Promise.all(
      this.holders.map(async (h) => {
        try {
          await h.browser.close();
        } catch (e) {
          logger.warn({ err: (e as Error).message, id: h.id }, 'close failed');
        }
      }),
    );
    this.holders = [];
    while (this.waiters.length) this.waiters.shift()?.();
  }

  async withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    if (this.stopped) throw new Error('pool stopped');
    await this.acquireSlot();
    let holder: Holder | null = null;
    let page: Page | null = null;
    try {
      holder = await this.pickHolder();
      holder.activeCount++;
      holder.totalCount++;
      const ctx = await holder.browser.createBrowserContext();
      page = await ctx.newPage();
      try {
        return await fn(page);
      } finally {
        try {
          await page.close({ runBeforeUnload: false });
        } catch {
          /* page may already be closed */
        }
        try {
          await ctx.close();
        } catch {
          /* context may already be closed */
        }
      }
    } finally {
      if (holder) {
        holder.activeCount--;
        if (
          holder.totalCount >= config.renderer.maxRequestsPerBrowser &&
          holder.activeCount === 0 &&
          !holder.recycling
        ) {
          this.recycle(holder).catch((err) =>
            logger.warn({ err: err.message, id: holder!.id }, 'recycle failed'),
          );
        }
      }
      this.releaseSlot();
      this.updateMetrics();
    }
  }

  private async acquireSlot(): Promise<void> {
    while (this.currentConcurrent >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.currentConcurrent++;
  }

  private releaseSlot(): void {
    this.currentConcurrent--;
    const next = this.waiters.shift();
    if (next) next();
  }

  private async pickHolder(): Promise<Holder> {
    let eligible = this.holders.filter((h) => h.browser.connected && !h.recycling);
    if (eligible.length === 0) {
      await this.spawn();
      eligible = this.holders.filter((h) => h.browser.connected && !h.recycling);
      if (eligible.length === 0) throw new Error('no browser available');
    }
    if (eligible.every((h) => h.activeCount > 0) && this.holders.length < config.renderer.poolMax) {
      await this.spawn();
      eligible = this.holders.filter((h) => h.browser.connected && !h.recycling);
    }
    eligible.sort((a, b) => a.activeCount - b.activeCount);
    return eligible[0]!;
  }

  private async spawn(): Promise<Holder> {
    const browser = await puppeteer.launch({
      headless: true,
      args: LAUNCH_ARGS,
      executablePath: config.renderer.executablePath,
      defaultViewport: config.renderer.viewport,
      pipe: true,
      timeout: 30_000,
    });
    const holder: Holder = {
      id: this.nextId++,
      browser,
      startedAt: Date.now(),
      totalCount: 0,
      activeCount: 0,
      recycling: false,
    };
    this.holders.push(holder);
    browser.on('disconnected', () => {
      logger.warn({ id: holder.id }, 'browser disconnected');
      this.holders = this.holders.filter((h) => h !== holder);
      this.updateMetrics();
    });
    logger.info({ id: holder.id, total: this.holders.length }, 'browser spawned');
    this.updateMetrics();
    return holder;
  }

  private async recycle(holder: Holder): Promise<void> {
    holder.recycling = true;
    logger.info({ id: holder.id, served: holder.totalCount }, 'recycling browser');
    try {
      await holder.browser.close();
    } catch (e) {
      logger.warn({ err: (e as Error).message }, 'browser close error');
    }
    this.holders = this.holders.filter((h) => h !== holder);
    if (this.holders.length < config.renderer.poolMin && !this.stopped) {
      await this.spawn();
    }
  }

  private updateMetrics(): void {
    poolMetric.set({ state: 'total' }, this.holders.length);
    poolMetric.set(
      { state: 'active' },
      this.holders.reduce((s, h) => s + h.activeCount, 0),
    );
    poolMetric.set(
      { state: 'idle' },
      this.holders.filter((h) => h.activeCount === 0 && !h.recycling).length,
    );
    poolMetric.set({ state: 'concurrent' }, this.currentConcurrent);
  }

  stats() {
    return {
      holders: this.holders.map((h) => ({
        id: h.id,
        ageMs: Date.now() - h.startedAt,
        totalCount: h.totalCount,
        activeCount: h.activeCount,
        recycling: h.recycling,
        connected: h.browser.connected,
      })),
      currentConcurrent: this.currentConcurrent,
      waiters: this.waiters.length,
      maxConcurrent: this.maxConcurrent,
    };
  }
}

export const browserPool = new BrowserPool();
