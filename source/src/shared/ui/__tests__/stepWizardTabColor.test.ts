import { describe, expect, it } from 'vitest';
import {
  isStepWizardTabColorCustom,
  resolveStepWizardTabAppearance,
  resolveStepWizardTabColorMode,
} from '../stepWizardTabColor';

describe('stepWizardTabColor', () => {
  it('defaults omitted and theme to the accent wash recipe', () => {
    expect(resolveStepWizardTabColorMode(undefined)).toBe('theme');
    expect(resolveStepWizardTabColorMode('theme')).toBe('theme');

    const selected = resolveStepWizardTabAppearance(undefined, 'selected', false);
    expect(selected.className).toContain('--app-accent-subtle');
    expect(selected.className).toContain('--app-nav-group-header-text');
    expect(selected.iconClassName).toContain('--app-nav-group-header-text');

    const unselected = resolveStepWizardTabAppearance('theme', 'unselected', true);
    expect(unselected.className).toContain('--app-accent-500');
    expect(unselected.className).toContain('color-mix');
    expect(unselected.className).toContain('--app-nav-group-header-text');
    expect(unselected.iconClassName).toContain('--app-nav-group-header-text');
  });

  it('gray keeps the slate/nav recipe', () => {
    expect(resolveStepWizardTabColorMode('gray')).toBe('gray');

    const selected = resolveStepWizardTabAppearance('gray', 'selected', true);
    expect(selected.className).toContain('bg-primary-subtle');
    expect(selected.iconClassName).toContain('text-primary-600');

    const unselected = resolveStepWizardTabAppearance('gray', 'unselected', true);
    expect(unselected.className).toContain('text-text-nav');
    expect(unselected.className).toContain('hover:bg-slate-50/80');
  });

  it('custom pair paints mild washes from the two hexes', () => {
    const custom = { selected: '#0EA5E9', unselected: '#64748B' };
    expect(isStepWizardTabColorCustom(custom)).toBe(true);
    expect(resolveStepWizardTabColorMode(custom)).toBe('custom');

    const selected = resolveStepWizardTabAppearance(custom, 'selected', false);
    expect(selected.style?.['--step-tab-fill']).toContain('#0EA5E9');
    expect(selected.style?.['--step-tab-fill']).toContain('22%');
    expect(selected.style?.['--step-tab-ink']).toContain('64%');
    expect(selected.style?.['--step-tab-ink']).toContain('black');

    const unselected = resolveStepWizardTabAppearance(custom, 'unselected', true);
    expect(unselected.style?.['--step-tab-fill']).toContain('#64748B');
    expect(unselected.style?.['--step-tab-fill']).toContain('10%');
    expect(unselected.className).toContain('--step-tab-fill-hover');
  });
});
