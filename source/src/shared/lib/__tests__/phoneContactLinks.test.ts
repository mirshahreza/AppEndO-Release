import { describe, expect, it } from 'vitest';
import { resolvePhoneContactLinks } from '../phoneContactLinks';

describe('resolvePhoneContactLinks', () => {
  it('maps Iraqi mobile 07… to +964… for tel and wa.me', () => {
    expect(resolvePhoneContactLinks('07701234567')).toEqual({
      tel: 'tel:+9647701234567',
      whatsapp: 'https://wa.me/9647701234567',
    });
  });

  it('accepts international plus prefix', () => {
    expect(resolvePhoneContactLinks('+1 202 555 0142')).toEqual({
      tel: 'tel:+12025550142',
      whatsapp: 'https://wa.me/12025550142',
    });
  });

  it('returns null for empty or too-short values', () => {
    expect(resolvePhoneContactLinks('')).toBeNull();
    expect(resolvePhoneContactLinks('12345')).toBeNull();
  });
});
