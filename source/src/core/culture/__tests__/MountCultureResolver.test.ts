import { beforeEach, describe, expect, it } from 'vitest';
import type { PlatformMount } from '../../../shared/api/contracts/platform/types';
import { bootstrapCultureRegistry } from '../CultureRegistry';
import {
  resolveCultureById,
  resolveMountCulture,
  resolveMountCultureId,
} from '../MountCultureResolver';

const irMount: PlatformMount = {
  id: 'ir',
  pathPrefix: '/ir',
  name: 'Iran',
  enabled: true,
  defaultRoute: '/ir',
  designerRoutePropagation: 'auto',
  authProfile: {},
  cultureId: 'ir',
};

const iqMount: PlatformMount = {
  id: 'iq',
  pathPrefix: '/iq',
  name: 'Iraq',
  enabled: true,
  defaultRoute: '/iq',
  designerRoutePropagation: 'auto',
  authProfile: {},
  cultureId: 'iq',
};

describe('MountCultureResolver', () => {
  beforeEach(() => {
    bootstrapCultureRegistry(['us', 'ir', 'iq']);
  });

  it('resolves cultureId from mount binding', () => {
    expect(resolveMountCultureId(irMount)).toBe('ir');
    expect(resolveMountCultureId(iqMount)).toBe('iq');
  });

  it('falls back to master culture when cultureId is absent', () => {
    const legacyIr: PlatformMount = {
      ...irMount,
      cultureId: undefined,
    };
    expect(resolveMountCultureId(legacyIr)).toBe('us');
  });

  it('resolves full culture metadata from registry', () => {
    const culture = resolveMountCulture(irMount);
    expect(culture).toMatchObject({
      cultureId: 'ir',
      locale: 'fa-IR',
      calendar: 'jalali',
      direction: 'rtl',
      language: 'fa',
    });

    const iqCulture = resolveMountCulture(iqMount);
    expect(iqCulture).toMatchObject({
      cultureId: 'iq',
      locale: 'ar-IQ',
      calendar: 'gregorian',
      direction: 'rtl',
      language: 'ar',
    });
  });

  it('resolves culture by id without a mount entity', () => {
    expect(resolveCultureById('ir')).toMatchObject({
      cultureId: 'ir',
      locale: 'fa-IR',
      direction: 'rtl',
    });

    expect(resolveCultureById('us')).toMatchObject({
      cultureId: 'us',
      locale: 'en-US',
      direction: 'ltr',
    });
  });
});
