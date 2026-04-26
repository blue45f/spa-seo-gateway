/**
 * Visual regression — 페이지를 풀에서 렌더한 뒤 스크린샷을 캡처해
 * 로컬 baseline 과 perceptual diff. percy/chromatic 같은 외부 서비스 없이
 * 단일 게이트웨이에서 회귀 감지.
 *
 *   const { diffPixels, diffPercent } = await runVisualDiff(url, { baselineDir: '...' });
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { browserPool } from './pool.js';

export type VisualDiffOptions = {
  baselineDir?: string;
  threshold?: number; // pixelmatch 0~1 (기본 0.1, 작을수록 민감)
  viewport?: { width: number; height: number };
  fullPage?: boolean;
  /** auto: 없으면 baseline 으로 저장 / create: 강제 새로 작성 / compare: 비교만 */
  mode?: 'auto' | 'create' | 'compare';
};

export type VisualDiffResult = {
  url: string;
  baselinePath: string;
  diffPath: string | null;
  width: number;
  height: number;
  diffPixels: number;
  diffPercent: number;
  baselineCreated: boolean;
  durationMs: number;
};

function pathFor(url: string, baselineDir: string): string {
  const safe = url.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 200);
  return resolve(baselineDir, `${safe}.png`);
}

export async function runVisualDiff(
  url: string,
  options: VisualDiffOptions = {},
): Promise<VisualDiffResult> {
  const baselineDir = options.baselineDir ?? resolve(process.cwd(), '.data/baselines');
  const threshold = options.threshold ?? 0.1;
  const viewport = options.viewport ?? { width: 1280, height: 800 };
  const fullPage = options.fullPage ?? false;
  const mode = options.mode ?? 'auto';

  await mkdir(baselineDir, { recursive: true });
  const t0 = Date.now();
  const baselinePath = pathFor(url, baselineDir);
  const diffPath = baselinePath.replace(/\.png$/, '.diff.png');

  const screenshot = await browserPool.withPage(async (page) => {
    await page.setViewport(viewport);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
    return (await page.screenshot({ type: 'png', fullPage })) as Buffer;
  });

  const baselineExists = existsSync(baselinePath);
  if (!baselineExists || mode === 'create') {
    await writeFile(baselinePath, screenshot);
    return {
      url,
      baselinePath,
      diffPath: null,
      width: viewport.width,
      height: viewport.height,
      diffPixels: 0,
      diffPercent: 0,
      baselineCreated: true,
      durationMs: Date.now() - t0,
    };
  }

  const baselineBuf = await readFile(baselinePath);
  const baseline = PNG.sync.read(baselineBuf);
  const current = PNG.sync.read(screenshot);

  // 크기 다르면 새로 caputre 한 것을 baseline 으로 간주
  if (baseline.width !== current.width || baseline.height !== current.height) {
    return {
      url,
      baselinePath,
      diffPath: null,
      width: current.width,
      height: current.height,
      diffPixels: -1,
      diffPercent: -1,
      baselineCreated: false,
      durationMs: Date.now() - t0,
    };
  }

  const diff = new PNG({ width: current.width, height: current.height });
  const diffPixels = pixelmatch(
    baseline.data,
    current.data,
    diff.data,
    current.width,
    current.height,
    { threshold },
  );
  const total = current.width * current.height;
  const diffPercent = (diffPixels / total) * 100;

  await mkdir(dirname(diffPath), { recursive: true });
  await writeFile(diffPath, PNG.sync.write(diff));

  return {
    url,
    baselinePath,
    diffPath,
    width: current.width,
    height: current.height,
    diffPixels,
    diffPercent,
    baselineCreated: false,
    durationMs: Date.now() - t0,
  };
}
