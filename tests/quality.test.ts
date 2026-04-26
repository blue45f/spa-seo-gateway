import { describe, expect, it } from 'vitest';
import { assessQuality, shortTtlForStatus } from '../src/quality.js';

describe('assessQuality', () => {
  it('flags soft 404 by title', () => {
    const html = '<html><head><title>404 - Not Found</title></head><body>oops</body></html>';
    expect(assessQuality(html).reason).toBe('soft-404');
  });

  it('flags Korean soft 404', () => {
    const html =
      '<html><head><title>페이지를 찾을 수 없습니다</title></head><body>없음</body></html>';
    expect(assessQuality(html).reason).toBe('soft-404');
  });

  it('flags 5xx error pages', () => {
    const html =
      '<html><head><title>500 Internal Server Error</title></head><body>err</body></html>';
    expect(assessQuality(html).reason).toBe('error-page');
  });

  it('flags too-small body text', () => {
    const html = '<html><head><title>Hi</title></head><body>hi</body></html>';
    const v = assessQuality(html, { minTextLength: 50 });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('too-small');
  });

  it('passes a normal page', () => {
    const html =
      '<html><head><title>Hello</title></head><body><h1>Welcome</h1><p>This is a normal page with sufficient body content for indexing purposes.</p></body></html>';
    const v = assessQuality(html);
    expect(v.ok).toBe(true);
    expect(v.textLength).toBeGreaterThan(50);
  });

  it('strips script/style noise from text count', () => {
    const html =
      '<html><head></head><body><script>console.log("' +
      'a'.repeat(500) +
      '")</script><p>tiny</p></body></html>';
    expect(assessQuality(html).reason).toBe('too-small');
  });
});

describe('shortTtlForStatus', () => {
  it('returns null for 200', () => {
    expect(shortTtlForStatus(200)).toBeNull();
  });

  it('returns shorter TTL for 404/410', () => {
    expect(shortTtlForStatus(404)).toBeLessThan(10 * 60_000);
    expect(shortTtlForStatus(410)).toBeLessThan(10 * 60_000);
  });

  it('returns very short TTL for 5xx', () => {
    expect(shortTtlForStatus(503)).toBeLessThan(2 * 60_000);
  });
});
