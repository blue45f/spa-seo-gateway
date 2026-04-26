import puppeteer, { type Page } from 'puppeteer';
import { Cluster, type TaskFunction } from 'puppeteer-cluster';
import { config } from './config.js';
import { logger } from './logger.js';
import { browserPool as poolMetric } from './metrics.js';

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
  private cluster: Cluster | null = null;
  private startedAt = 0;
  private active = 0;
  private totalServed = 0;
  private recycleAt = 0;
  private recycling = false;
  private stopped = false;

  async start(): Promise<void> {
    if (this.cluster) return;
    this.cluster = await Cluster.launch({
      puppeteer,
      concurrency: Cluster.CONCURRENCY_CONTEXT,
      maxConcurrency: config.renderer.poolMax,
      timeout: config.renderer.pageTimeoutMs + 10_000,
      workerCreationDelay: 50,
      retryLimit: 0,
      monitor: false,
      puppeteerOptions: {
        headless: true,
        args: LAUNCH_ARGS,
        executablePath: config.renderer.executablePath,
        defaultViewport: config.renderer.viewport,
        pipe: true,
        timeout: 30_000,
      },
    });

    this.cluster.on('taskerror', (err: Error) => {
      logger.warn({ err: err.message }, 'cluster task error');
    });

    this.startedAt = Date.now();
    this.recycleAt = config.renderer.maxRequestsPerBrowser;
    poolMetric.set({ state: 'ready' }, 1);
    logger.info(
      { maxConcurrency: config.renderer.poolMax, recycleAt: this.recycleAt },
      'browser pool ready (puppeteer-cluster CONCURRENCY_CONTEXT)',
    );
  }

  async stop(): Promise<void> {
    this.stopped = true;
    const c = this.cluster;
    this.cluster = null;
    if (c) {
      try {
        await c.idle();
        await c.close();
      } catch (e) {
        logger.warn({ err: (e as Error).message }, 'cluster close error');
      }
    }
    poolMetric.set({ state: 'ready' }, 0);
  }

  async withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    if (!this.cluster || this.stopped) throw new Error('pool not running');
    this.active++;
    this.totalServed++;
    poolMetric.set({ state: 'active' }, this.active);
    poolMetric.set({ state: 'served_total' }, this.totalServed);

    if (this.totalServed >= this.recycleAt && !this.recycling) {
      this.recycleAt = this.totalServed + config.renderer.maxRequestsPerBrowser;
      this.recycling = true;
      void this.recycle().finally(() => {
        this.recycling = false;
      });
    }

    try {
      const task: TaskFunction<undefined, T> = async ({ page }) => fn(page);
      return (await this.cluster.execute(task)) as T;
    } finally {
      this.active--;
      poolMetric.set({ state: 'active' }, this.active);
    }
  }

  private async recycle(): Promise<void> {
    if (!this.cluster || this.stopped) return;
    const old = this.cluster;
    logger.info({ served: this.totalServed }, 'recycling cluster (memory hygiene)');
    try {
      const fresh = await Cluster.launch({
        puppeteer,
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: config.renderer.poolMax,
        timeout: config.renderer.pageTimeoutMs + 10_000,
        workerCreationDelay: 50,
        retryLimit: 0,
        monitor: false,
        puppeteerOptions: {
          headless: true,
          args: LAUNCH_ARGS,
          executablePath: config.renderer.executablePath,
          defaultViewport: config.renderer.viewport,
          pipe: true,
          timeout: 30_000,
        },
      });
      fresh.on('taskerror', (err: Error) => {
        logger.warn({ err: err.message }, 'cluster task error');
      });
      this.cluster = fresh;
      await old.idle();
      await old.close();
      logger.info('cluster recycle complete');
    } catch (e) {
      logger.error({ err: (e as Error).message }, 'recycle failed; keeping old cluster');
    }
  }

  stats() {
    return {
      ready: this.cluster !== null && !this.stopped,
      active: this.active,
      totalServed: this.totalServed,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
      maxConcurrency: config.renderer.poolMax,
      nextRecycleAt: this.recycleAt,
      recycling: this.recycling,
    };
  }
}

export const browserPool = new BrowserPool();
