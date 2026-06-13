/** secure API key — 40 hex chars (160 bits), `tk_live_` 프리픽스. */
export function generateApiKey(): string {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    // API key 는 자격증명이므로 약한 난수로 대체하지 않는다.
    throw new Error('generateApiKey requires Web Crypto (crypto.getRandomValues)')
  }
  const buf = new Uint8Array(20)
  globalThis.crypto.getRandomValues(buf)
  return `tk_live_${Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`
}
