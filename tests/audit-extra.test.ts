/**
 * audit-chain.test.ts 가 hash chain 만 검증한다. 본 테스트는 그 외 분기:
 * - HMAC 서명: AUDIT_WEBHOOK_SECRET / HMAC_SECRET 설정 시 signature 필드 생성
 * - audit.file 설정 시 디스크 append
 * - webhookUrl 설정 시 POST 트리거 (fetch 모킹)
 * - getRecentAudit limit 동작
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { config, getRecentAudit, recordAudit } from '@heejun/spa-seo-gateway-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let tmp: string
const restore = {
  file: config.audit.file,
  webhook: config.audit.webhookUrl,
  secret: process.env.AUDIT_WEBHOOK_SECRET,
  hmac: process.env.HMAC_SECRET,
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'spa-audit-'))
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
  ;(config as { audit: { file?: string; webhookUrl?: string } }).audit = {
    file: restore.file,
    webhookUrl: restore.webhook,
  }
  if (restore.secret === undefined) delete process.env.AUDIT_WEBHOOK_SECRET
  else process.env.AUDIT_WEBHOOK_SECRET = restore.secret
  if (restore.hmac === undefined) delete process.env.HMAC_SECRET
  else process.env.HMAC_SECRET = restore.hmac
  vi.unstubAllGlobals()
})

describe('recordAudit + HMAC', () => {
  it('attaches signature when AUDIT_WEBHOOK_SECRET is set', () => {
    process.env.AUDIT_WEBHOOK_SECRET = 'top-secret'
    recordAudit({ actor: 'test', action: 'with.hmac', outcome: 'ok' })
    const recent = getRecentAudit(1)
    expect(recent[0]?.signature).toMatch(/^[a-f0-9]{64}$/)
  })

  it('falls back to HMAC_SECRET env var if AUDIT_WEBHOOK_SECRET missing', () => {
    delete process.env.AUDIT_WEBHOOK_SECRET
    process.env.HMAC_SECRET = 'secondary'
    recordAudit({ actor: 'test', action: 'with.hmac.fb', outcome: 'ok' })
    const recent = getRecentAudit(1)
    expect(recent[0]?.signature).toBeDefined()
  })

  it('omits signature when neither secret env var is set', () => {
    delete process.env.AUDIT_WEBHOOK_SECRET
    delete process.env.HMAC_SECRET
    recordAudit({ actor: 'test', action: 'no.hmac', outcome: 'ok' })
    const recent = getRecentAudit(1)
    expect(recent[0]?.signature).toBeUndefined()
  })
})

describe('recordAudit + file sink', () => {
  it('appends each event as JSON line when audit.file is set', async () => {
    const file = join(tmp, 'audit.log')
    ;(config as { audit: { file?: string; webhookUrl?: string } }).audit = { file }
    recordAudit({ actor: 't', action: 'file.a', outcome: 'ok' })
    recordAudit({ actor: 't', action: 'file.b', outcome: 'error' })
    // flush 는 비동기 — 잠시 대기
    await new Promise((r) => setTimeout(r, 50))
    expect(existsSync(file)).toBe(true)
    const content = readFileSync(file, 'utf8')
    expect(content).toMatch(/"action":"file\.a"/)
    expect(content).toMatch(/"action":"file\.b"/)
  })
})

describe('recordAudit + webhook', () => {
  it('POSTs to webhookUrl with the full event body', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    ;(config as { audit: { file?: string; webhookUrl?: string } }).audit = {
      webhookUrl: 'https://hooks.example.com/audit',
    }
    recordAudit({ actor: 't', action: 'webhook.test', outcome: 'ok' })
    // postWebhook 은 void → 짧게 기다림
    await new Promise((r) => setTimeout(r, 30))
    expect(fetchMock).toHaveBeenCalled()
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit] | undefined
    expect(call?.[0]).toBe('https://hooks.example.com/audit')
    const body = JSON.parse(call?.[1].body as string)
    expect(body.action).toBe('webhook.test')
    expect(body.hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('does not throw when webhook fails', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network down')
    })
    vi.stubGlobal('fetch', fetchMock)
    ;(config as { audit: { file?: string; webhookUrl?: string } }).audit = {
      webhookUrl: 'https://hooks.example.com/audit',
    }
    expect(() => recordAudit({ actor: 't', action: 'wh.fail', outcome: 'ok' })).not.toThrow()
    await new Promise((r) => setTimeout(r, 30))
  })
})

describe('getRecentAudit limit', () => {
  it('returns at most "limit" events, newest first', () => {
    for (let i = 0; i < 5; i++) {
      recordAudit({ actor: 't', action: `seq.${i}`, outcome: 'ok' })
    }
    const r3 = getRecentAudit(3)
    expect(r3.length).toBe(3)
    expect(r3[0]?.action).toBe('seq.4')
    expect(r3[1]?.action).toBe('seq.3')
    expect(r3[2]?.action).toBe('seq.2')
  })
})
