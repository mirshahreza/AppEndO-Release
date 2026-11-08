import { describe, expect, it } from 'vitest';
import {
  bootstrapCultureRegistry,
  getDefaultCulturePackId,
  getEnabledCulturePackIds,
  listBuiltinCulturePackAdapters,
  MASTER_CULTURE_PACK_ID,
  resolveCulturePackAdapter,
} from '../CultureRegistry';

describe('CultureRegistry', () => {
  it('registers builtin us, ir, and iq culture packs', () => {
    const adapters = listBuiltinCulturePackAdapters();
    expect(adapters.map((adapter) => adapter.extension.id).sort()).toEqual([
      'iq',
      'ir',
      'us',
    ]);
  });

  it('bootstraps enabled culture pack ids', () => {
    bootstrapCultureRegistry(['us', 'ir', 'iq']);
    expect(getEnabledCulturePackIds()).toEqual(['us', 'ir', 'iq']);
  });

  it('bootstraps default culture id from config object', () => {
    bootstrapCultureRegistry({
      enabledCulturePackIds: ['us', 'ir'],
      defaultCultureId: 'ir',
    });
    expect(getDefaultCulturePackId()).toBe('ir');
  });

  it('resolves culture pack metadata from adapter registry', () => {
    const ir = resolveCulturePackAdapter('ir');
    expect(ir?.extension).toMatchObject({
      type: 'culture-pack',
      id: 'ir',
      calendar: 'jalali',
      direction: 'rtl',
      locale: 'fa-IR',
    });

    const iq = resolveCulturePackAdapter('iq');
    expect(iq?.extension).toMatchObject({
      type: 'culture-pack',
      id: 'iq',
      calendar: 'gregorian',
      direction: 'rtl',
      language: 'ar',
      locale: 'ar-IQ',
    });
  });

  it('uses us as master culture pack id', () => {
    expect(MASTER_CULTURE_PACK_ID).toBe('us');
    expect(resolveCulturePackAdapter(MASTER_CULTURE_PACK_ID)?.extension.language).toBe('en');
  });
});
