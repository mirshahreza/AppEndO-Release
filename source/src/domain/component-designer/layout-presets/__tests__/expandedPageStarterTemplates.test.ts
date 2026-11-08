import { describe, expect, it } from 'vitest';
import { createStateFromNewLayoutPreset, getTemplateForPreset, NEW_LAYOUT_PRESETS } from '../newLayoutPresets';
import {
  PAGE_STARTER_COMPOSITE_WIDGET_IDS,
} from '../expandedPageStarterTemplates';
import type { TemplateNodeSeed } from '../../types';

const collectPaletteIds = (seeds: TemplateNodeSeed[], out = new Set<string>()): Set<string> => {
  for (const seed of seeds) {
    if (typeof seed.paletteItemId === 'string' && seed.paletteItemId.trim()) {
      out.add(seed.paletteItemId.trim());
    }
    collectPaletteIds(seed.children ?? [], out);
  }
  return out;
};

describe('expanded page starter templates', () => {
  it('copies Feature Grid as heading and cards, not the composite widget', () => {
    const { state } = createStateFromNewLayoutPreset('feature-grid');
    const paletteIds = Object.values(state.document.nodes)
      .map((node) => node.props._designerPaletteItemId)
      .filter((value): value is string => typeof value === 'string');

    expect(paletteIds).not.toContain('content.feature-grid');
    expect(Object.values(state.document.nodes).some((node) => node.props.text === 'Core Features')).toBe(true);
    expect(Object.values(state.document.nodes).some((node) => node.props.text === 'Fast setup')).toBe(true);
    expect(Object.values(state.document.nodes).some((node) => node.props.text === 'Live preview')).toBe(true);
    expect(Object.values(state.document.nodes).some((node) => node.props.text === 'Export ready')).toBe(true);
  });

  it.each(NEW_LAYOUT_PRESETS.filter((preset) => preset.id !== 'blank').map((preset) => preset.id))(
    'does not address a composite template widget in preset %s',
    (presetId) => {
      const paletteIds = collectPaletteIds(getTemplateForPreset(presetId));
      for (const widgetId of PAGE_STARTER_COMPOSITE_WIDGET_IDS) {
        expect(paletteIds.has(widgetId), `${presetId} must expand ${widgetId} into layout parts`).toBe(false);
      }
    },
  );
});
