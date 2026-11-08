import { describe, expect, it } from 'vitest';
import {
  APPENDO_LOGO_ONLY_SRC,
  APPENDO_LOGO_SRC,
  resolveAppEndLogoMark,
} from '../AppEndLogo';

describe('resolveAppEndLogoMark', () => {
  it('uses the mark-only asset for sidebar chrome on tablet and phone', () => {
    expect(
      resolveAppEndLogoMark({ variant: 'sidebar', compactChrome: true }),
    ).toBe(true);
    expect(
      resolveAppEndLogoMark({ variant: 'sidebar', compactChrome: false }),
    ).toBe(false);
  });

  it('uses the mark-only asset for the collapsed desktop sidebar rail', () => {
    expect(
      resolveAppEndLogoMark({ variant: 'sidebar', compactChrome: false, collapsed: true }),
    ).toBe(true);
    expect(
      resolveAppEndLogoMark({ variant: 'sidebar', compactChrome: false, collapsed: false }),
    ).toBe(false);
  });

  it('keeps the lockup on default surfaces even when compact', () => {
    expect(
      resolveAppEndLogoMark({ variant: 'default', compactChrome: true }),
    ).toBe(false);
  });

  it('honors an explicit mark flag and the mark-only src', () => {
    expect(
      resolveAppEndLogoMark({ variant: 'default', compactChrome: false, mark: true }),
    ).toBe(true);
    expect(
      resolveAppEndLogoMark({
        variant: 'sidebar',
        compactChrome: true,
        mark: false,
      }),
    ).toBe(false);
    expect(
      resolveAppEndLogoMark({
        src: APPENDO_LOGO_ONLY_SRC,
        variant: 'default',
        compactChrome: false,
      }),
    ).toBe(true);
  });

  it('does not restyle a custom tenant logo', () => {
    expect(
      resolveAppEndLogoMark({
        src: '/assets/workspace/custom-logo.png',
        variant: 'sidebar',
        compactChrome: true,
        mark: true,
      }),
    ).toBe(false);
    expect(APPENDO_LOGO_SRC).toBe('/assets/appendo-logo.png');
  });
});
