/** secure-ish API key — 32 hex chars (128 bits), `tk_live_` 프리픽스. */
export function generateApiKey(): string {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const buf = new Uint8Array(20);
    globalThis.crypto.getRandomValues(buf);
    return `tk_live_${Array.from(buf)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`;
  }
  // 폴백 — 테스트 환경
  let s = 'tk_live_';
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}
