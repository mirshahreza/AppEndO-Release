import { describe, expect, it } from 'vitest';
import {
  buildReusablePaletteItems,
  getComponentIdFromPaletteItemId,
  isReusablePaletteItemId,
  toReusablePaletteItemId,
} from '../reusablePalette';

describe('reusablePalette', () => {
  it('builds palette items from component summaries', () => {
    const items = buildReusablePaletteItems([
      {
        id: 'hero-banner',
        name: 'Hero Banner',
        folder: 'marketing',
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: toReusablePaletteItemId('hero-banner'),
      category: 'platform-workspace',
      nodeType: 'reusable-slot',
      sourceType: 'reusable',
      sourceRef: 'hero-banner',
      defaultProps: {
        componentId: 'hero-banner',
        label: 'Hero Banner',
        folder: 'marketing',
      },
    });
  });

  it('resolves reusable palette item ids', () => {
    const componentId = 'hero-banner';
    const paletteItemId = toReusablePaletteItemId(componentId);

    expect(isReusablePaletteItemId(paletteItemId)).toBe(true);
    expect(getComponentIdFromPaletteItemId(paletteItemId)).toBe(componentId);
    expect(isReusablePaletteItemId('html.text')).toBe(false);
  });
});
