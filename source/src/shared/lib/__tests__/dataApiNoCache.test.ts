import { describe, expect, it } from 'vitest';
import {
  appendDataApiNoCacheQueryParam,
  readDataApiNoCacheFromRequest,
} from '../dataApiNoCache';

describe('dataApiNoCache', () => {
  it('appends noCache=1 to relative list URLs', () => {
    expect(appendDataApiNoCacheQueryParam('/api/hwy/member-directory?page=1'))
      .toBe('/api/hwy/member-directory?page=1&noCache=1');
  });

  it('reads noCache from query', () => {
    expect(readDataApiNoCacheFromRequest({ query: { noCache: '1' } })).toBe(true);
    expect(readDataApiNoCacheFromRequest({ query: { page: '1' } })).toBe(false);
  });
});
