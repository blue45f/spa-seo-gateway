/**
 * visual-regression.ts: 페이지 스크린샷 → baseline 비교.
 *
 * 실제 puppeteer 풀을 띄우지 않고 browserPool.withPage 만 mocking 해
 * pixelmatch / pngjs 경로 (baseline 생성, 동일 크기 비교, 크기 불일치) 를 모두 검증한다.
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { browserPool, runVisualDiff } from '@heejun/spa-seo-gateway-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// pngjs 는 packages/core 의 transitive dep — 워크스페이스 root 에서 import 가능.
// @ts-expect-error — pngjs lacks .d.ts; runtime export shape is verified by the test itself.
import { PNG } from '../packages/core/node_modules/pngjs/lib/png.js'

let tmp: string

function makePng(width: number, height: number, color = 0xffffffff): Buffer {
  const png = new PNG({ width, height })
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) << 2
      png.data[idx] = (color >> 24) & 0xff
      png.data[idx + 1] = (color >> 16) & 0xff
      png.data[idx + 2] = (color >> 8) & 0xff
      png.data[idx + 3] = color & 0xff
    }
  }
  return PNG.sync.write(png)
}

function makeMixedPng(width: number, height: number): Buffer {
  // 우상단 절반은 빨강, 나머지는 흰색 — diff 발생 보장
  const png = new PNG({ width, height })
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) << 2
      const red = x > width / 2
      png.data[idx] = red ? 0xff : 0xff
      png.data[idx + 1] = red ? 0x00 : 0xff
      png.data[idx + 2] = red ? 0x00 : 0xff
      png.data[idx + 3] = 0xff
    }
  }
  return PNG.sync.write(png)
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'spa-vd-'))
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('runVisualDiff', () => {
  it('creates baseline on first run', async () => {
    const png = makePng(20, 20)
    vi.spyOn(browserPool, 'withPage').mockImplementation(async (fn) => {
      const fakePage = {
        setViewport: async () => undefined,
        goto: async () => undefined,
        screenshot: async () => png,
      }
      return fn(fakePage as never)
    })

    const result = await runVisualDiff('https://e.com/p', { baselineDir: tmp })
    expect(result.baselineCreated).toBe(true)
    expect(result.diffPixels).toBe(0)
    expect(result.diffPercent).toBe(0)
    expect(existsSync(result.baselinePath)).toBe(true)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('reports 0 diff when baseline matches current screenshot exactly', async () => {
    const png = makePng(20, 20)
    vi.spyOn(browserPool, 'withPage').mockImplementation(async (fn) => {
      const fakePage = {
        setViewport: async () => undefined,
        goto: async () => undefined,
        screenshot: async () => png,
      }
      return fn(fakePage as never)
    })

    await runVisualDiff('https://e.com/eq', { baselineDir: tmp }) // baseline 생성
    const second = await runVisualDiff('https://e.com/eq', { baselineDir: tmp })
    expect(second.baselineCreated).toBe(false)
    expect(second.diffPixels).toBe(0)
    expect(second.diffPercent).toBe(0)
    expect(second.diffPath).not.toBeNull()
    expect(existsSync(second.diffPath as string)).toBe(true)
  })

  it('reports nonzero diff when screenshots differ', async () => {
    const baseline = makePng(20, 20)
    const changed = makeMixedPng(20, 20)
    let call = 0
    vi.spyOn(browserPool, 'withPage').mockImplementation(async (fn) => {
      call++
      const fakePage = {
        setViewport: async () => undefined,
        goto: async () => undefined,
        screenshot: async () => (call === 1 ? baseline : changed),
      }
      return fn(fakePage as never)
    })

    await runVisualDiff('https://e.com/diff', { baselineDir: tmp })
    const second = await runVisualDiff('https://e.com/diff', { baselineDir: tmp })
    expect(second.diffPixels).toBeGreaterThan(0)
    expect(second.diffPercent).toBeGreaterThan(0)
  })

  it('returns diffPixels: -1 when sizes mismatch', async () => {
    const small = makePng(20, 20)
    const big = makePng(40, 40)
    let call = 0
    vi.spyOn(browserPool, 'withPage').mockImplementation(async (fn) => {
      call++
      const fakePage = {
        setViewport: async () => undefined,
        goto: async () => undefined,
        screenshot: async () => (call === 1 ? small : big),
      }
      return fn(fakePage as never)
    })

    await runVisualDiff('https://e.com/size', {
      baselineDir: tmp,
      viewport: { width: 20, height: 20 },
    })
    const second = await runVisualDiff('https://e.com/size', {
      baselineDir: tmp,
      viewport: { width: 40, height: 40 },
    })
    expect(second.diffPixels).toBe(-1)
    expect(second.diffPercent).toBe(-1)
    expect(second.diffPath).toBeNull()
  })

  it('mode=create forces a new baseline even when one exists', async () => {
    const png = makePng(20, 20)
    vi.spyOn(browserPool, 'withPage').mockImplementation(async (fn) => {
      const fakePage = {
        setViewport: async () => undefined,
        goto: async () => undefined,
        screenshot: async () => png,
      }
      return fn(fakePage as never)
    })

    await runVisualDiff('https://e.com/force', { baselineDir: tmp })
    const forced = await runVisualDiff('https://e.com/force', { baselineDir: tmp, mode: 'create' })
    expect(forced.baselineCreated).toBe(true)
  })
})
