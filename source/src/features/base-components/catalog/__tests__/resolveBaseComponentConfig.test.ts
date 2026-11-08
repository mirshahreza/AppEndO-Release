import { describe, expect, it } from 'vitest';
import { exportBaseComponentConfig } from '../exportBaseComponentConfig';
import { resolveBaseComponentConfig } from '../resolveBaseComponentConfig';
import { TABS_OPTIONS } from '../sections/tabs.options';

describe('resolveBaseComponentConfig', () => {
  it('normalizes invalid closed values and condition-disabled choices', () => {
    const resolution = resolveBaseComponentConfig(TABS_OPTIONS, {
      'tabs.variant': 'unsupported',
      'tabs.activationMode': 'automatic',
      'tabs.panelLifecycle': 'lazy-keep',
      'tabs.width': 'equal',
      'tabs.itemCount': 8,
    });

    expect(resolution.values['tabs.variant']).toBe('line');
    expect(resolution.values['tabs.activationMode']).toBe('manual');
    expect(resolution.values['tabs.width']).toBe('fit');
    expect(resolution.adjustments.map(({ optionId }) => optionId)).toEqual(
      expect.arrayContaining([
        'tabs.variant',
        'tabs.activationMode',
        'tabs.width',
      ]),
    );
  });

  it('keeps automatic activation when panels are eager', () => {
    const resolution = resolveBaseComponentConfig(TABS_OPTIONS, {
      'tabs.activationMode': 'automatic',
      'tabs.panelLifecycle': 'eager',
    });

    expect(resolution.values['tabs.activationMode']).toBe('automatic');
    expect(resolution.optionState['tabs.activationMode'].enabled).toBe(true);
    expect(resolution.violations).toEqual([]);
  });

  it('reports unknown input without leaking it into resolved values', () => {
    const resolution = resolveBaseComponentConfig(TABS_OPTIONS, {
      'tabs.unknown': true,
    });

    expect(resolution.values).not.toHaveProperty('tabs.unknown');
    expect(resolution.violations).toContainEqual(
      expect.objectContaining({ optionId: 'tabs.unknown' }),
    );
  });
});

describe('exportBaseComponentConfig', () => {
  it('separates public, fixture and scenario state and omits catalog-only state', () => {
    const resolution = resolveBaseComponentConfig(TABS_OPTIONS, {
      'tabs.panelLifecycle': 'eager',
      'tabs.activationMode': 'automatic',
      'tabs.itemCount': 5,
      'tabs.badges': true,
      'tabs.disabledItem': true,
      'tabs.viewport': 'phone',
      'tabs.direction': 'rtl',
    });
    const result = exportBaseComponentConfig(TABS_OPTIONS, resolution.values);

    expect(result.public).toMatchObject({
      activationMode: 'automatic',
      panelLifecycle: 'eager',
    });
    expect(result.demo.fixtures).toEqual(
      expect.objectContaining({ itemCount: 5, badges: true }),
    );
    expect(result.demo.scenarios).toEqual(
      expect.objectContaining({ disabledItem: true }),
    );
    expect(JSON.stringify(result)).not.toContain('viewport');
    expect(JSON.stringify(result)).not.toContain('direction');
  });
});
