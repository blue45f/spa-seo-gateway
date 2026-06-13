/**
 * warm-cron.ts: 주기적 sitemap warming 스케줄러.
 *
 * 본 모듈은 setInterval + setTimeout 으로 구동되며 실제 워밍은 prerender-warmer 가
 * 처리. 본 테스트는 disabled/enabled 분기와 stop 의 idempotency 만 검증한다.
 */
import { config, startWarmCron, stopWarmCron } from '@heejun/spa-seo-gateway-core'
import { afterEach, describe, expect, it } from 'vitest'

const restore = {
  enabled: config.warmCron.enabled,
  sitemap: config.warmCron.sitemap,
}

afterEach(() => {
  stopWarmCron()
  ;(config as { warmCron: { enabled: boolean; sitemap?: string } }).warmCron = {
    ...config.warmCron,
    enabled: restore.enabled,
    sitemap: restore.sitemap,
  }
})

describe('warm-cron', () => {
  it('no-ops when disabled', () => {
    ;(config as { warmCron: { enabled: boolean; sitemap?: string } }).warmCron = {
      ...config.warmCron,
      enabled: false,
      sitemap: undefined,
    }
    expect(() => startWarmCron()).not.toThrow()
    expect(() => stopWarmCron()).not.toThrow()
  })

  it('no-ops when no sitemap configured', () => {
    ;(config as { warmCron: { enabled: boolean; sitemap?: string } }).warmCron = {
      ...config.warmCron,
      enabled: true,
      sitemap: undefined,
    }
    expect(() => startWarmCron()).not.toThrow()
  })

  it('starts when sitemap + enabled (initial timer scheduled — unref so no test hang)', () => {
    ;(config as { warmCron: { enabled: boolean; sitemap?: string; intervalMs: number } }).warmCron =
      {
        ...config.warmCron,
        enabled: true,
        sitemap: 'https://www.example.com/sitemap.xml',
        intervalMs: 60_000,
      }
    startWarmCron()
    // unref 덕분에 vitest 종료가 막히지 않음. 즉시 stop.
    stopWarmCron()
  })

  it('stopWarmCron is safe to call without start', () => {
    expect(() => stopWarmCron()).not.toThrow()
    expect(() => stopWarmCron()).not.toThrow()
  })
})
