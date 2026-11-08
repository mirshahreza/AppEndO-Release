import { describe, expect, it } from 'vitest';
import { resolveEffectiveShellExperience } from '../shellExperienceDefaults';

describe('resolveEffectiveShellExperience', () => {
  it('uses portal defaults when user override is null', () => {
    const effective = resolveEffectiveShellExperience(
      {
        version: 1,
        sidebarDefaultCollapsed: true,
        sidebarCollapsePolicy: 'hidden',
        allowUserSidebarPreference: true,
        layoutWidth: 'bounded',
        layoutWidthUserControl: false,
      },
      { version: 1, sidebarCollapsed: null, layoutWidth: null, navExpandedGroups: null },
    );

    expect(effective.sidebarCollapsed).toBe(true);
    expect(effective.sidebarCollapsePolicy).toBe('hidden');
    expect(effective.layoutWidth).toBe('bounded');
  });

  it('prefers user override when set', () => {
    const effective = resolveEffectiveShellExperience(
      {
        version: 1,
        sidebarDefaultCollapsed: true,
        sidebarCollapsePolicy: 'rail',
        allowUserSidebarPreference: true,
        layoutWidth: 'bounded',
        layoutWidthUserControl: true,
      },
      { version: 1, sidebarCollapsed: false, layoutWidth: 'fluid', navExpandedGroups: ['Platform'] },
    );

    expect(effective.sidebarCollapsed).toBe(false);
    expect(effective.layoutWidth).toBe('fluid');
    expect(effective.navExpandedGroups).toEqual(['Platform']);
  });
});
