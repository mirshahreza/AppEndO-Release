import { afterEach, describe, expect, it } from 'vitest';
import { bootstrapCultureRegistry, MASTER_CULTURE_PACK_ID } from '../CultureRegistry';
import { resolveCultureFromPathname } from '../CultureUrlResolver';

describe('CultureUrlResolver', () => {
  afterEach(() => {
    bootstrapCultureRegistry(['us', 'ir', 'iq']);
  });

  it('resolves enabled culture from the first URL segment', () => {
    expect(resolveCultureFromPathname('/ir/admin/users')).toEqual({
      cultureId: 'ir',
      remainderPath: '/admin/users',
    });

    expect(resolveCultureFromPathname('/iq/settings')).toEqual({
      cultureId: 'iq',
      remainderPath: '/settings',
    });

    expect(resolveCultureFromPathname('/us/admin/users')).toEqual({
      cultureId: 'us',
      remainderPath: '/admin/users',
    });
  });

  it('falls back to master culture when the first segment is not an enabled culture', () => {
    expect(resolveCultureFromPathname('/admin/users')).toEqual({
      cultureId: MASTER_CULTURE_PACK_ID,
      remainderPath: '/admin/users',
    });

    expect(resolveCultureFromPathname('/users')).toEqual({
      cultureId: MASTER_CULTURE_PACK_ID,
      remainderPath: '/users',
    });
  });

  it('falls back to master culture for root and culture-only paths', () => {
    expect(resolveCultureFromPathname('/')).toEqual({
      cultureId: MASTER_CULTURE_PACK_ID,
      remainderPath: '/',
    });

    expect(resolveCultureFromPathname('/ir')).toEqual({
      cultureId: 'ir',
      remainderPath: '/',
    });
  });

  it('ignores disabled culture pack ids in the URL prefix', () => {
    bootstrapCultureRegistry(['us']);

    expect(resolveCultureFromPathname('/ir/admin/users')).toEqual({
      cultureId: MASTER_CULTURE_PACK_ID,
      remainderPath: '/ir/admin/users',
    });
  });

  it('normalizes pathnames without a leading slash', () => {
    expect(resolveCultureFromPathname('ir/admin/users')).toEqual({
      cultureId: 'ir',
      remainderPath: '/admin/users',
    });
  });
});
