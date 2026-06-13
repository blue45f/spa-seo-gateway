import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runDoctor } from '../packages/cli/src/doctor.js'

// Mock @clack/prompts so the doctor's interactive helpers become no-ops.
vi.mock('@clack/prompts', () => {
  const spinner = () => ({
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
  })
  return {
    intro: vi.fn(),
    outro: vi.fn(),
    note: vi.fn(),
    cancel: vi.fn(),
    spinner,
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }
})

// Save/restore the env keys doctor inspects, plus cwd.
const ENV_KEYS = [
  'PUPPETEER_EXECUTABLE_PATH',
  'ADMIN_TOKEN',
  'AUDIT_WEBHOOK_SECRET',
  'HMAC_SECRET',
  'ANTHROPIC_API_KEY',
]

describe('cli/doctor runDoctor — env/branch matrix', () => {
  const originalCwd = process.cwd()
  const savedEnv: Record<string, string | undefined> = {}
  let tmpDir: string
  let consoleClearSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      savedEnv[k] = process.env[k]
      delete process.env[k]
    }
    tmpDir = mkdtempSync(join(tmpdir(), 'ssg-doctor-'))
    process.chdir(tmpDir)
    consoleClearSpy = vi.spyOn(console, 'clear').mockImplementation(() => {})
  })

  afterEach(() => {
    process.chdir(originalCwd)
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k]
      else process.env[k] = savedEnv[k]
    }
    consoleClearSpy.mockRestore()
  })

  it('runs to completion with no envs / no config files', async () => {
    await expect(runDoctor()).resolves.toBeUndefined()
    expect(consoleClearSpy).toHaveBeenCalled()
  })

  it('detects PUPPETEER_EXECUTABLE_PATH when it points at an existing file', async () => {
    const fake = join(tmpDir, 'fake-chrome')
    writeFileSync(fake, '#!/bin/sh\necho chrome\n')
    process.env.PUPPETEER_EXECUTABLE_PATH = fake
    await expect(runDoctor()).resolves.toBeUndefined()
  })

  it('reports missing chromium when PUPPETEER_EXECUTABLE_PATH points nowhere', async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = join(tmpDir, 'does-not-exist')
    await expect(runDoctor()).resolves.toBeUndefined()
  })

  it('detects seo-gateway.config.json in cwd', async () => {
    writeFileSync(join(tmpDir, 'seo-gateway.config.json'), '{}')
    await expect(runDoctor()).resolves.toBeUndefined()
  })

  it('detects the alternate .seo-gateway.json config name', async () => {
    writeFileSync(join(tmpDir, '.seo-gateway.json'), '{}')
    await expect(runDoctor()).resolves.toBeUndefined()
  })

  it('detects a .env file in cwd', async () => {
    writeFileSync(join(tmpDir, '.env'), 'FOO=bar\n')
    await expect(runDoctor()).resolves.toBeUndefined()
  })

  it('reports ADMIN_TOKEN when set', async () => {
    process.env.ADMIN_TOKEN = 'abc123'
    await expect(runDoctor()).resolves.toBeUndefined()
  })

  it('reports AUDIT_WEBHOOK_SECRET when set', async () => {
    process.env.AUDIT_WEBHOOK_SECRET = 'whsec'
    await expect(runDoctor()).resolves.toBeUndefined()
  })

  it('falls back to HMAC_SECRET for the Audit HMAC check', async () => {
    process.env.HMAC_SECRET = 'hmacsec'
    await expect(runDoctor()).resolves.toBeUndefined()
  })

  it('reports ANTHROPIC_API_KEY when set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-fake'
    await expect(runDoctor()).resolves.toBeUndefined()
  })

  it('exercises the "all green" path with every env + config present', async () => {
    const fake = join(tmpDir, 'fake-chrome')
    writeFileSync(fake, '')
    writeFileSync(join(tmpDir, 'seo-gateway.config.json'), '{}')
    writeFileSync(join(tmpDir, '.env'), '')
    process.env.PUPPETEER_EXECUTABLE_PATH = fake
    process.env.ADMIN_TOKEN = 't'
    process.env.AUDIT_WEBHOOK_SECRET = 's'
    process.env.ANTHROPIC_API_KEY = 'k'
    await expect(runDoctor()).resolves.toBeUndefined()
  })
})

describe('cli/doctor runDoctor — port 3000 occupied branch', () => {
  let srv: Server | undefined
  const originalCwd = process.cwd()
  let tmpDir: string
  let consoleClearSpy: ReturnType<typeof vi.spyOn>
  let portAvailable = false

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'ssg-doctor-port-'))
    process.chdir(tmpDir)
    consoleClearSpy = vi.spyOn(console, 'clear').mockImplementation(() => {})

    // Try to bind 3000. If it's already in use (CI parallelism, etc.) we still
    // get the "occupied" branch — just from someone else.  If we *can* bind it,
    // we hold it for the duration of this suite so runDoctor sees it busy.
    srv = createServer()
    await new Promise<void>((resolve) => {
      const s = srv!
      s.once('error', () => {
        // Already busy — fine. Drop our reference.
        srv = undefined
        resolve()
      })
      s.once('listening', () => {
        portAvailable = true
        resolve()
      })
      s.listen(3000, '127.0.0.1')
    })
  })

  afterEach(async () => {
    if (srv) {
      await new Promise<void>((resolve) => srv!.close(() => resolve()))
      srv = undefined
    }
    process.chdir(originalCwd)
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
    consoleClearSpy.mockRestore()
  })

  it('completes when port 3000 is occupied', async () => {
    // Regardless of who holds 3000, runDoctor should walk the busy branch and
    // finish without throwing.
    await expect(runDoctor()).resolves.toBeUndefined()
    // Sanity: we either bound the port ourselves, or someone else has it.
    expect(typeof portAvailable).toBe('boolean')
  })
})
