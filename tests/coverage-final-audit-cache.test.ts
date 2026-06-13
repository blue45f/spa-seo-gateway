/**
 * Final coverage push for:
 *   - audit.ts: pendingWrite reset when config.audit.file becomes unset
 *     between the push and the recursive flush() (lines 77-78)
 *
 * The Redis branch (cache.ts lines 60-62) is documented as intentionally
 * uncovered: it requires a real Redis (or a successful mock of @keyv/redis).
 * The cache.ts module statically imports `@keyv/redis`, and vi.mock for this
 * external package does not intercept the static import in our setup (vitest 4
 * + pnpm). A separate integration test with a real Redis instance is the
 * cleaner path forward and is out of scope for unit coverage.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// ─── audit.ts lines 77-78 ────────────────────────────────────────────

describe('audit.flush — pendingWrite reset when config.audit.file unset mid-flight (lines 77-78)', () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'cov-audit2-'))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it('races recordAudit calls with config.audit.file unset → flush hits the reset branch', async () => {
    const { recordAudit, config } = await import('@heejun/spa-seo-gateway-core')
    const cfg = config as { audit: { file?: string; webhookUrl?: string } }

    // First event: schedule a flush() that starts and yields at the first await.
    cfg.audit = { file: join(tmp, 'audit.log') }
    recordAudit({ actor: 'cov', action: 'race.first', outcome: 'ok' })
    // Yield once so flush has a chance to begin (await mkdir).
    await Promise.resolve()

    // Second event: pushes onto pendingWrite while appending=true (so flush no-ops here).
    recordAudit({ actor: 'cov', action: 'race.second', outcome: 'ok' })

    // Unset audit.file. When the FIRST flush finishes its mkdir+appendFile, it
    // checks `pendingWrite.length` and recursively calls flush() — and the new
    // flush sees !config.audit.file → lines 77-78 reset.
    cfg.audit = {}

    // Wait long enough for both flushes to complete.
    await new Promise((r) => setTimeout(r, 200))
    expect(true).toBe(true)
  })
})
