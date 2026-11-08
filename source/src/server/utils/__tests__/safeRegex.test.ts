import { describe, expect, it } from 'vitest';
import { safeRegexMatch } from '../safeRegex';

describe('safeRegexMatch', () => {
  it('matches and returns groups for a simple pattern', () => {
    const result = safeRegexMatch('h(e)llo', 'say HELLO world', { flags: 'i' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.matched).toBe(true);
    expect(result.matches[0].match).toBe('HELLO');
    expect(result.matches[0].groups).toEqual(['E']);
  });

  it('returns matched:false with no error on a valid pattern that does not match', () => {
    const result = safeRegexMatch('xyz', 'abc');
    expect(result).toEqual({ ok: true, matched: false, matches: [] });
  });

  it('collects all matches when global is requested', () => {
    const result = safeRegexMatch('\\d+', 'a1 b22 c333', { global: true });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.matches.map((m) => m.match)).toEqual(['1', '22', '333']);
  });

  it('rejects an invalid pattern instead of throwing', () => {
    const result = safeRegexMatch('[', 'abc');
    expect(result).toEqual(expect.objectContaining({ ok: false, errorCode: 'INVALID_PATTERN' }));
  });

  it('rejects an over-length pattern', () => {
    const result = safeRegexMatch('a'.repeat(600), 'abc');
    expect(result).toEqual(expect.objectContaining({ ok: false, errorCode: 'PATTERN_TOO_LONG' }));
  });

  it('never hangs on a classic catastrophic-backtracking pattern (RE2 is linear-time)', () => {
    const start = Date.now();
    const result = safeRegexMatch('(a+)+b', 'a'.repeat(64) + 'c');
    expect(Date.now() - start).toBeLessThan(1000);
    expect(result).toEqual({ ok: true, matched: false, matches: [] });
  });

  it('supports named groups', () => {
    const result = safeRegexMatch('h(?<letter>e)llo', 'say HELLO world', { flags: 'i' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.matches[0].namedGroups).toEqual({ letter: 'E' });
  });
});
