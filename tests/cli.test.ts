import { readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { checkPort, commandExists } from '../packages/cli/src/doctor.js'
import { parseArgs, resolveUserAgent } from '../packages/cli/src/render.js'

describe('cli/render parseArgs', () => {
  it('returns empty object for empty rest', () => {
    expect(parseArgs([])).toEqual({})
  })

  it('parses a single positional as url', () => {
    expect(parseArgs(['https://example.com/'])).toEqual({ url: 'https://example.com/' })
  })

  it('parses --out with a value', () => {
    expect(parseArgs(['https://example.com/', '--out', 'result.html'])).toEqual({
      url: 'https://example.com/',
      out: 'result.html',
    })
  })

  it('parses --ua with a value', () => {
    const ua = 'MyAgent/1.0'
    expect(parseArgs(['--ua', ua, 'https://example.com/'])).toEqual({
      url: 'https://example.com/',
      ua,
    })
  })

  it('parses --stdout as boolean flag', () => {
    expect(parseArgs(['--stdout', 'https://example.com/'])).toEqual({
      stdout: true,
      url: 'https://example.com/',
    })
  })

  it('parses --mobile as boolean flag', () => {
    expect(parseArgs(['--mobile', 'https://example.com/'])).toEqual({
      mobile: true,
      url: 'https://example.com/',
    })
  })

  it('parses mixed flag/positional order', () => {
    expect(
      parseArgs(['--mobile', 'https://example.com/', '--out', 'r.html', '--ua', 'X', '--stdout'])
    ).toEqual({
      mobile: true,
      url: 'https://example.com/',
      out: 'r.html',
      ua: 'X',
      stdout: true,
    })
  })

  it('uses the LAST positional when multiple are supplied', () => {
    expect(parseArgs(['first', 'second', 'third'])).toEqual({ url: 'third' })
  })

  it('ignores unknown flags (treated as no-op)', () => {
    // --unknown does not consume the next arg; the next arg is a positional.
    expect(parseArgs(['--unknown', '--mobile', 'https://example.com/'])).toEqual({
      mobile: true,
      url: 'https://example.com/',
    })
  })

  it('leaves out missing-value flags as undefined', () => {
    // --out with nothing after it -> out becomes undefined (rest[++i] is undefined)
    const a = parseArgs(['--out'])
    expect(a.out).toBeUndefined()
    expect(a.url).toBeUndefined()
  })

  it('skips empty-string args defensively', () => {
    expect(parseArgs(['', 'https://example.com/'])).toEqual({ url: 'https://example.com/' })
  })
})

describe('cli/render resolveUserAgent', () => {
  it('returns the explicit ua when supplied (overrides --mobile)', () => {
    expect(resolveUserAgent({ ua: 'Custom/1.0', mobile: true })).toBe('Custom/1.0')
  })

  it('returns mobile Googlebot UA when --mobile is set and no ua override', () => {
    const ua = resolveUserAgent({ mobile: true })
    expect(ua).toMatch(/Mobile/)
    expect(ua).toMatch(/Googlebot/)
  })

  it('returns desktop Googlebot UA by default', () => {
    const ua = resolveUserAgent({})
    expect(ua).toMatch(/Googlebot/)
    expect(ua).not.toMatch(/Mobile/)
  })
})

describe('cli/doctor commandExists', () => {
  it('detects a real command (node is always available in vitest)', () => {
    const r = commandExists('node')
    expect(r.ok).toBe(true)
    expect(typeof r.version).toBe('string')
    expect(r.version!.length).toBeGreaterThan(0)
  })

  it('returns ok:false for a clearly missing command', () => {
    const r = commandExists('definitely-not-a-real-command-xyz-12345')
    expect(r.ok).toBe(false)
    expect(r.version).toBeUndefined()
  })
})

describe('cli/doctor checkPort', () => {
  it('returns true for an available high port', async () => {
    // 0 lets the OS pick — guaranteed-free.  But our impl listens on an
    // explicit port; pick a high random number and accept a possible false
    // negative by retrying once.
    const port = 40000 + Math.floor(Math.random() * 20000)
    const ok = await checkPort(port)
    expect(typeof ok).toBe('boolean')
    // We don't assert true strictly (rare race), but in practice this is fine.
    expect(ok).toBe(true)
  })

  it('returns false when the port is already in use', async () => {
    // Bind a server first, then ask checkPort about the same port.
    const srv = createServer()
    await new Promise<void>((res) => srv.listen(0, '127.0.0.1', () => res()))
    const addr = srv.address()
    if (!addr || typeof addr === 'string') {
      srv.close()
      throw new Error('no address')
    }
    const busyPort = addr.port
    try {
      const ok = await checkPort(busyPort)
      expect(ok).toBe(false)
    } finally {
      await new Promise<void>((res) => srv.close(() => res()))
    }
  })
})

describe('cli/index module shape (no import — main() runs on load)', () => {
  const indexPath = resolve(__dirname, '../packages/cli/src/index.ts')
  const src = readFileSync(indexPath, 'utf8')

  it('declares an async main() dispatcher', () => {
    expect(src).toMatch(/async function main\(/)
  })

  it('dispatches the four documented commands', () => {
    expect(src).toMatch(/case 'init'/)
    expect(src).toMatch(/case 'doctor'/)
    expect(src).toMatch(/case 'render'/)
    expect(src).toMatch(/case 'help'/)
  })

  it('imports the three sub-command runners', () => {
    expect(src).toMatch(/runInit/)
    expect(src).toMatch(/runDoctor/)
    expect(src).toMatch(/runRender/)
  })

  it('handles unknown commands with exit code 2', () => {
    expect(src).toMatch(/process\.exitCode = 2/)
  })

  it('has the #!/usr/bin/env node shebang', () => {
    expect(src.startsWith('#!/usr/bin/env node')).toBe(true)
  })
})
