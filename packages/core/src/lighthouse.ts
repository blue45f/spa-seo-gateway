/**
 * Lighthouse 점수 측정 — 옵트인. lighthouse 패키지가 무거우므로 (50MB+) 설치 시
 * 사용자가 명시적으로 추가하도록 peer dependency. 이 모듈은 동적 import 로
 * 없으면 우아하게 실패한다.
 *
 *   pnpm add lighthouse
 */
import { logger } from './logger.js'

export type LighthouseScores = {
  url: string
  durationMs: number
  scores: {
    performance: number | null
    accessibility: number | null
    bestPractices: number | null
    seo: number | null
    pwa: number | null
  }
  topAudits: Array<{ id: string; title: string; score: number | null }>
  fetchedAt: string
}

type LighthouseCategory = { score?: number | null }
type LighthouseAudit = { title?: string; score?: number | null }
type LighthouseResult = {
  lhr?: {
    categories?: Record<string, LighthouseCategory>
    audits?: Record<string, LighthouseAudit>
  }
}
type LighthouseRunner = (
  url: string,
  opts: { port: number; output: 'json'; logLevel: 'error'; onlyCategories: string[] }
) => Promise<LighthouseResult>
type ChromeLauncher = {
  launch(opts: {
    chromeFlags: string[]
    chromePath?: string
  }): Promise<{ port: number; kill(): Promise<void> | void }>
}

const cache = new Map<string, { scores: LighthouseScores; expiresAt: number }>()
const TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX = 256

export async function runLighthouse(
  url: string,
  opts: { useCache?: boolean; chromePath?: string } = {}
): Promise<LighthouseScores> {
  const useCache = opts.useCache ?? true
  const cached = cache.get(url)
  if (useCache && cached && cached.expiresAt > Date.now()) {
    return cached.scores
  }

  // 동적 import — lighthouse 미설치 시 즉시 안내
  let lighthouse: LighthouseRunner
  let chromeLauncher: ChromeLauncher
  try {
    lighthouse = ((await import('lighthouse' as string)) as { default: LighthouseRunner }).default
    chromeLauncher = (await import('chrome-launcher' as string)) as ChromeLauncher
  } catch {
    throw new Error(
      'lighthouse 가 설치되어 있지 않습니다. `pnpm add lighthouse chrome-launcher` 후 재시도하세요.'
    )
  }

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
    chromePath: opts.chromePath,
  })

  const t0 = Date.now()
  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'],
    })

    const lhr = result?.lhr
    if (!lhr) throw new Error('lighthouse returned empty result')

    const cat = lhr.categories ?? {}
    const num = (k: string) => {
      const v = cat[k]?.score
      return typeof v === 'number' ? Math.round(v * 100) : null
    }

    const audits = lhr.audits ?? {}
    const topAudits = Object.entries(audits)
      .map(([id, a]) => ({
        id,
        title: a.title ?? id,
        score: typeof a.score === 'number' ? Math.round(a.score * 100) : null,
      }))
      .filter((a) => typeof a.score === 'number' && a.score < 90)
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      .slice(0, 10)

    const scores: LighthouseScores = {
      url,
      durationMs: Date.now() - t0,
      scores: {
        performance: num('performance'),
        accessibility: num('accessibility'),
        bestPractices: num('best-practices'),
        seo: num('seo'),
        pwa: num('pwa'),
      },
      topAudits,
      fetchedAt: new Date().toISOString(),
    }
    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(url, { scores, expiresAt: Date.now() + TTL_MS })
    return scores
  } catch (e) {
    logger.error({ err: (e as Error).message, url }, 'lighthouse 실행 실패')
    throw e
  } finally {
    await Promise.resolve(chrome.kill()).catch(() => {})
  }
}

export function clearLighthouseCache(): void {
  cache.clear()
}
