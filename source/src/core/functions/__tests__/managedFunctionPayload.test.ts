import { describe, expect, it } from 'vitest';
import {
  mergeManagedFunctionCacheFields,
  normalizeManagedFunctionCacheFields,
} from '../managedFunctionPayload';

describe('managed function cache payload normalization', () => {
  it('applies safe defaults for create payload', () => {
    const normalized = normalizeManagedFunctionCacheFields(undefined);

    expect(normalized).toEqual({
      cacheEnabled: false,
      cacheTtlMs: 180000,
      cacheByParam: false,
      cacheByUser: false,
    });
  });

  it('normalizes explicit create cache payload values', () => {
    const normalized = normalizeManagedFunctionCacheFields({
      cacheEnabled: true,
      cacheTtlMs: 5500,
      cacheByParam: true,
      cacheByUser: true,
    });

    expect(normalized).toEqual({
      cacheEnabled: true,
      cacheTtlMs: 5500,
      cacheByParam: true,
      cacheByUser: true,
    });
  });

  it('clamps invalid ttl to minimum boundary', () => {
    const normalized = normalizeManagedFunctionCacheFields({
      cacheEnabled: true,
      cacheTtlMs: 10,
      cacheByParam: false,
      cacheByUser: false,
    });

    expect(normalized.cacheTtlMs).toBe(1000);
  });

  it('preserves existing values on update when payload omits cache fields', () => {
    const merged = mergeManagedFunctionCacheFields({}, {
      cache_enabled: true,
      cache_ttl_ms: 250000,
      cache_by_param: true,
      cache_by_user: false,
    });

    expect(merged).toEqual({
      cacheEnabled: true,
      cacheTtlMs: 250000,
      cacheByParam: true,
      cacheByUser: false,
    });
  });

  it('overrides existing values on update when payload includes cache fields', () => {
    const merged = mergeManagedFunctionCacheFields({
      cacheEnabled: false,
      cacheTtlMs: 4444,
      cacheByParam: false,
      cacheByUser: true,
    }, {
      cache_enabled: true,
      cache_ttl_ms: 250000,
      cache_by_param: true,
      cache_by_user: false,
    });

    expect(merged).toEqual({
      cacheEnabled: false,
      cacheTtlMs: 4444,
      cacheByParam: false,
      cacheByUser: true,
    });
  });
});
