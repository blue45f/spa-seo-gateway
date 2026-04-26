import { type AbVariant, applyVariant, selectVariant } from '@heejun/spa-seo-gateway-core';
import { describe, expect, it } from 'vitest';

describe('selectVariant', () => {
  it('returns null for empty array', () => {
    expect(selectVariant([])).toBeNull();
  });

  it('selects the only variant deterministically', () => {
    const result = selectVariant([{ weight: 1 }]);
    expect(result?.index).toBe(0);
  });

  it('respects weight ratio over many trials', () => {
    const variants: AbVariant[] = [
      { title: 'A', weight: 1 },
      { title: 'B', weight: 9 },
    ];
    const counts = [0, 0];
    for (let i = 0; i < 5_000; i++) {
      const r = selectVariant(variants);
      counts[r!.index]++;
    }
    // B 가 9배 weight 라 A 비율이 5~15% 범위면 OK (랜덤 분산 허용).
    const ratioA = counts[0] / 5_000;
    expect(ratioA).toBeGreaterThan(0.05);
    expect(ratioA).toBeLessThan(0.15);
  });

  it('uses default weight 1 when omitted', () => {
    const variants: AbVariant[] = [{ title: 'A' }, { title: 'B' }];
    const counts = [0, 0];
    for (let i = 0; i < 4_000; i++) {
      const r = selectVariant(variants);
      counts[r!.index]++;
    }
    // 균등 분포 — 0.45~0.55 범위.
    expect(counts[0] / 4_000).toBeGreaterThan(0.45);
    expect(counts[0] / 4_000).toBeLessThan(0.55);
  });
});

describe('applyVariant', () => {
  const html = `<!DOCTYPE html><html><head>
    <title>Original</title>
    <meta name="description" content="Original desc">
    <meta property="og:title" content="OG original">
    <meta property="og:description" content="OG desc original">
  </head><body>x</body></html>`;

  it('replaces title when title variant given', () => {
    const out = applyVariant(html, { title: 'New Title' }, '/test', 0);
    expect(out).toContain('<title>New Title</title>');
    expect(out).not.toContain('<title>Original</title>');
  });

  it('replaces meta description', () => {
    const out = applyVariant(html, { description: 'New desc' }, '/test', 1);
    expect(out).toMatch(/<meta name="description" content="New desc"\s*>/);
  });

  it('escapes HTML special chars in attributes', () => {
    const out = applyVariant(html, { title: 'A & B "quoted" <tag>' }, '/p', 0);
    expect(out).toContain('A &#38; B &#34;quoted&#34; &#60;tag&#62;');
  });

  it('inserts title into head when missing', () => {
    const noTitle = '<!DOCTYPE html><html><head></head><body></body></html>';
    const out = applyVariant(noTitle, { title: 'Inserted' }, '/p', 0);
    expect(out).toContain('<title>Inserted</title>');
  });

  it('inserts og:* into head when missing', () => {
    const noOg = '<!DOCTYPE html><html><head><title>x</title></head><body></body></html>';
    const out = applyVariant(noOg, { ogTitle: 'OG', ogDescription: 'D' }, '/p', 0);
    expect(out).toMatch(/<meta property="og:title" content="OG"/);
    expect(out).toMatch(/<meta property="og:description" content="D"/);
  });

  it('returns original html when variant has no fields', () => {
    const out = applyVariant(html, {}, '/p', 0);
    expect(out).toBe(html);
  });
});
