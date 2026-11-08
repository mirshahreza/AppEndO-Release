import { afterEach, describe, expect, it } from 'vitest';
import type { EdgeApiOperation } from '../../../../shared/api/contracts/data-api';
import { resolveDataApiListIncludeCount } from '../dataApiListCount';

const baseListOperation = {
  id: 'op_list',
  method: 'GET',
  kind: 'list',
  pathPattern: '/api/items',
  enabled: true,
  query: {
    allowFilter: true,
    allowSort: true,
    maxPageSize: 100,
    defaultPageSize: 20,
  },
} satisfies EdgeApiOperation;

describe('resolveDataApiListIncludeCount', () => {
  afterEach(() => {
    delete process.env.APPENDO_DATA_API_LIST_INCLUDE_COUNT;
  });

  it('defaults to exact count when unset', () => {
    expect(resolveDataApiListIncludeCount({}, baseListOperation)).toEqual({
      includeCount: true,
      countMode: 'exact',
    });
  });

  it('honors query includeCount=false', () => {
    expect(resolveDataApiListIncludeCount({ includeCount: 'false' }, baseListOperation)).toEqual({
      includeCount: false,
      countMode: 'omitted',
    });
  });

  it('honors operation countMode none when query omits includeCount', () => {
    const op = {
      ...baseListOperation,
      query: { ...baseListOperation.query!, countMode: 'none' as const },
    };
    expect(resolveDataApiListIncludeCount({}, op)).toEqual({
      includeCount: false,
      countMode: 'none',
    });
  });

  it('query includeCount=true overrides operation countMode none', () => {
    const op = {
      ...baseListOperation,
      query: { ...baseListOperation.query!, countMode: 'none' as const },
    };
    expect(resolveDataApiListIncludeCount({ includeCount: 'true' }, op)).toEqual({
      includeCount: true,
      countMode: 'exact',
    });
  });

  it('honors peak env override', () => {
    process.env.APPENDO_DATA_API_LIST_INCLUDE_COUNT = 'false';
    expect(resolveDataApiListIncludeCount({}, baseListOperation)).toEqual({
      includeCount: false,
      countMode: 'omitted',
    });
  });

  it('honors operation defaultIncludeCount when query omits includeCount', () => {
    const op = {
      ...baseListOperation,
      query: { ...baseListOperation.query!, defaultIncludeCount: false },
    };
    expect(resolveDataApiListIncludeCount({}, op)).toEqual({
      includeCount: false,
      countMode: 'omitted',
    });
  });
});
