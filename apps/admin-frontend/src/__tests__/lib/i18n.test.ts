import { describe, expect, it } from 'vitest';
import { translate } from '../../lib/i18n';

describe('translate', () => {
  it('returns Korean string for ko', () => {
    expect(translate('ko', 'nav.welcome')).toBe('소개');
  });

  it('returns English string for en', () => {
    expect(translate('en', 'nav.welcome')).toBe('Welcome');
  });

  it('falls back to ko when key is missing in en', () => {
    expect(translate('en', 'no.such.key', 'fallback')).toBe('fallback');
  });

  it('returns key when no translation exists at all', () => {
    expect(translate('ko', 'definitely.not.a.real.key')).toBe('definitely.not.a.real.key');
  });

  it('covers all v1.6/1.7 feature labels in both languages', () => {
    const keys = [
      'nav.visual',
      'nav.ai',
      'nav.audit',
      'visual.title',
      'visual.run',
      'ai.title',
      'audit.title',
      'audit.verify',
    ];
    for (const k of keys) {
      expect(translate('ko', k)).not.toBe(k);
      expect(translate('en', k)).not.toBe(k);
    }
  });
});
