import { describe, expect, it } from 'vitest';
import {
  BUILTIN_FILTER_ALL,
  BUILTIN_FILTER_NO,
  BUILTIN_FILTER_YES,
  matchesBuiltInFilter,
  migrateLegacyBuiltInFilter,
  parseBuiltInFilter,
} from '../builtInFilter';

describe('builtInFilter', () => {
  it('parses All, BuiltIn, and Not BuiltIn', () => {
    expect(parseBuiltInFilter('')).toBe(BUILTIN_FILTER_ALL);
    expect(parseBuiltInFilter(BUILTIN_FILTER_YES)).toBe(BUILTIN_FILTER_YES);
    expect(parseBuiltInFilter(BUILTIN_FILTER_NO)).toBe(BUILTIN_FILTER_NO);
    expect(parseBuiltInFilter('custom')).toBe(BUILTIN_FILTER_ALL);
  });

  it('matches origin independently of other filters', () => {
    expect(matchesBuiltInFilter(true, BUILTIN_FILTER_ALL)).toBe(true);
    expect(matchesBuiltInFilter(false, BUILTIN_FILTER_ALL)).toBe(true);
    expect(matchesBuiltInFilter(true, BUILTIN_FILTER_YES)).toBe(true);
    expect(matchesBuiltInFilter(false, BUILTIN_FILTER_YES)).toBe(false);
    expect(matchesBuiltInFilter(true, BUILTIN_FILTER_NO)).toBe(false);
    expect(matchesBuiltInFilter(false, BUILTIN_FILTER_NO)).toBe(true);
  });

  it('migrates leftover hide/show and Kind CSVs', () => {
    expect(migrateLegacyBuiltInFilter({ builtInFilter: BUILTIN_FILTER_YES })).toBe(BUILTIN_FILTER_YES);
    expect(migrateLegacyBuiltInFilter({ showBuiltIn: false })).toBe(BUILTIN_FILTER_NO);
    expect(migrateLegacyBuiltInFilter({ showBuiltIn: true })).toBe(BUILTIN_FILTER_ALL);
    expect(migrateLegacyBuiltInFilter({ hideBuiltinItems: true })).toBe(BUILTIN_FILTER_NO);
    expect(migrateLegacyBuiltInFilter({ hideBuiltinPortals: false })).toBe(BUILTIN_FILTER_ALL);
    expect(migrateLegacyBuiltInFilter({ kindFilter: 'custom' })).toBe(BUILTIN_FILTER_NO);
    expect(migrateLegacyBuiltInFilter({ kindFilter: 'builtin' })).toBe(BUILTIN_FILTER_YES);
    expect(migrateLegacyBuiltInFilter({ kindFilter: 'custom,builtin' })).toBe(BUILTIN_FILTER_ALL);
  });
});
