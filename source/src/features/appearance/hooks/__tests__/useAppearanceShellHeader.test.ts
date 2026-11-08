import { describe, expect, it } from 'vitest';
import { buildAppearanceShellHeaderOverride } from '../useAppearanceShellHeader';

describe('buildAppearanceShellHeaderOverride', () => {
  it('uses nav culture keys and suppresses nav group prefix for footer workspace pages', () => {
    const t = (key: string) => (
      key === 'nav.appearance' ? 'المظهر' : key === 'nav.appearance.description' ? 'وصف المظهر' : key
    );

    expect(buildAppearanceShellHeaderOverride(t)).toEqual({
      icon: 'tabler:IconPalette',
      label: 'المظهر',
      description: 'وصف المظهر',
      groupLabel: null,
    });
  });

  it('does not set a nested-editor title trail', () => {
    expect(buildAppearanceShellHeaderOverride(undefined)).not.toHaveProperty('titleTrail');
  });
});
