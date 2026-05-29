import { describe, expect, it } from 'vitest';
import {
  bytesToHuman,
  escapeRegex,
  formatUptime,
  lighthouseScoreColor,
  methodPillClass,
} from '../../lib/format';

describe('formatUptime', () => {
  it('returns ... for missing', () => {
    expect(formatUptime(undefined)).toBe('...');
    expect(formatUptime(0)).toBe('...');
  });

  it('formats minutes', () => {
    expect(formatUptime(60 * 5)).toBe('5m');
  });

  it('formats hours + minutes', () => {
    expect(formatUptime(3600 + 60 * 7)).toBe('1h 7m');
  });

  it('formats days + hours + minutes', () => {
    expect(formatUptime(86400 + 3600 * 2 + 60 * 30)).toBe('1d 2h 30m');
  });
});

describe('lighthouseScoreColor', () => {
  it('neutral for null', () => {
    expect(lighthouseScoreColor(null)).toContain('ink');
  });
  it('ok for 90+', () => {
    expect(lighthouseScoreColor(95)).toContain('ok');
  });
  it('warn for 50-89', () => {
    expect(lighthouseScoreColor(70)).toContain('warn');
  });
  it('err for <50', () => {
    expect(lighthouseScoreColor(30)).toContain('err');
  });
});

describe('methodPillClass', () => {
  it('returns method-specific classes', () => {
    expect(methodPillClass('GET')).toContain('ok');
    expect(methodPillClass('POST')).toContain('accent');
    expect(methodPillClass('DELETE')).toContain('err');
  });
  it('falls back for unknown methods', () => {
    expect(methodPillClass('CONNECT')).toContain('ink');
  });
});

describe('bytesToHuman', () => {
  it('handles bytes', () => {
    expect(bytesToHuman(512)).toBe('512 B');
  });
  it('handles KB', () => {
    expect(bytesToHuman(2048)).toBe('2.0 KB');
  });
  it('handles MB', () => {
    expect(bytesToHuman(5 * 1024 * 1024)).toBe('5.00 MB');
  });
});

describe('escapeRegex', () => {
  it('escapes regex meta characters', () => {
    expect(escapeRegex('a.b*c+')).toBe('a\\.b\\*c\\+');
  });
});
