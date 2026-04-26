import { detectBot } from '@spa-seo-gateway/core';
import { describe, expect, it } from 'vitest';

describe('detectBot', () => {
  it('detects Googlebot', () => {
    expect(detectBot('Googlebot/2.1', {}, {}).isBot).toBe(true);
  });

  it('detects Bingbot', () => {
    expect(detectBot('Mozilla/5.0 bingbot', {}, {}).isBot).toBe(true);
  });

  it('returns human for Chrome', () => {
    expect(detectBot('Mozilla/5.0 Chrome/130.0', {}, {}).isBot).toBe(false);
  });

  it('honors x-force-render header', () => {
    expect(detectBot('Chrome', { 'x-force-render': 'true' }, {}).reason).toBe('force-header');
  });

  it('honors bypass query', () => {
    const r = detectBot('Googlebot', {}, { _no_render: '' });
    expect(r.isBot).toBe(false);
    expect(r.reason).toBe('bypass-query');
  });

  it('handles missing UA', () => {
    expect(detectBot(undefined, {}, {}).isBot).toBe(false);
  });
});
