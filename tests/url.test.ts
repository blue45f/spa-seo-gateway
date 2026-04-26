import { cacheKey, normalize } from '@spa-seo-gateway/core';
import { describe, expect, it } from 'vitest';

describe('normalize', () => {
  it('removes tracking parameters', () => {
    const out = normalize('https://example.com/p?utm_source=x&id=1&fbclid=abc');
    expect(out).toBe('https://example.com/p?id=1');
  });

  it('sorts query parameters', () => {
    expect(normalize('https://example.com/?b=2&a=1')).toBe('https://example.com/?a=1&b=2');
  });

  it('lowercases host and removes hash', () => {
    expect(normalize('https://Example.com/x#frag')).toBe('https://example.com/x');
  });

  it('removes trailing slash from non-root paths', () => {
    expect(normalize('https://example.com/path/')).toBe('https://example.com/path');
  });
});

describe('cacheKey', () => {
  it('produces stable hash for equivalent URLs', () => {
    const a = cacheKey('https://Example.com/p/?a=1&utm_source=g&b=2#x');
    const b = cacheKey('https://example.com/p?b=2&a=1');
    expect(a).toBe(b);
  });

  it('differs by locale', () => {
    expect(cacheKey('https://example.com/', 'en')).not.toBe(cacheKey('https://example.com/', 'ko'));
  });

  it('returns a 16-hex-char hash', () => {
    expect(cacheKey('https://example.com/')).toMatch(/^[0-9a-f]{16}$/);
  });
});
