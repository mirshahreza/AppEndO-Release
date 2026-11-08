import { describe, expect, it } from 'vitest';
import { callWithProviderFallback, resolveModelTierForActionClass } from '../modelRouter';
import type { IAiProvider } from '../../IAiProvider';

describe('V5 P01 § V5-2b — resolveModelTierForActionClass', () => {
  it('routes high-stakes action classes to the strong tier', () => {
    expect(resolveModelTierForActionClass('EDIT')).toBe('strong');
    expect(resolveModelTierForActionClass('PLAN')).toBe('strong');
    expect(resolveModelTierForActionClass('VERIFY')).toBe('strong');
  });

  it('routes low-risk action classes to the fast tier', () => {
    expect(resolveModelTierForActionClass('EXPLORE')).toBe('fast');
    expect(resolveModelTierForActionClass('INSPECT')).toBe('fast');
    expect(resolveModelTierForActionClass('CLARIFY')).toBe('fast');
  });
});

const makeProvider = (name: string, impl: () => Promise<string>): IAiProvider => ({
  getProviderName: () => name,
  chat: impl,
});

describe('V5 P01 § V5-2b — callWithProviderFallback', () => {
  it('returns the primary result when it succeeds', async () => {
    const primary = makeProvider('primary', async () => 'ok');
    const result = await callWithProviderFallback([primary], (p) => p.chat([]));
    expect(result).toBe('ok');
  });

  it('falls back to the next provider when the primary throws', async () => {
    const primary = makeProvider('primary', async () => { throw new Error('primary down'); });
    const fallback = makeProvider('fallback', async () => 'fallback-ok');
    const result = await callWithProviderFallback([primary, fallback], (p) => p.chat([]));
    expect(result).toBe('fallback-ok');
  });

  it('throws an aggregated error when every provider fails', async () => {
    const a = makeProvider('a', async () => { throw new Error('a down'); });
    const b = makeProvider('b', async () => { throw new Error('b down'); });
    await expect(callWithProviderFallback([a, b], (p) => p.chat([]))).rejects.toThrow(/a down.*b down/s);
  });
});
