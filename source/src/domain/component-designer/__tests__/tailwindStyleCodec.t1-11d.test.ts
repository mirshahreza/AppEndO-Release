import { describe, expect, it } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';
import { applyResponsiveTailwindUtility } from '../tailwindClasses';
import {
  encodeOpacityClassName,
  FONT_WEIGHT_FIELD,
  OPACITY_FIELD,
  parseOpacityClassName,
  ROUNDED_FIELD,
  roundTripOpacityClassName,
  roundTripStyleUtility,
  SHADOW_FIELD,
  snapToTailwindOpacityScale,
  TEXT_ALIGN_FIELD,
  TEXT_SIZE_FIELD,
} from '../tailwindStyleCodec';

describe('T1-11d typography/appearance codec round-trip', () => {
  const utilitySamples: Array<{ utility: string; field: typeof TEXT_SIZE_FIELD }> = [
    { utility: 'text-sm', field: TEXT_SIZE_FIELD },
    { utility: 'text-2xl', field: TEXT_SIZE_FIELD },
    { utility: 'font-bold', field: FONT_WEIGHT_FIELD },
    { utility: 'font-normal', field: FONT_WEIGHT_FIELD },
    { utility: 'text-left', field: TEXT_ALIGN_FIELD },
    { utility: 'text-center', field: TEXT_ALIGN_FIELD },
    { utility: 'text-justify', field: TEXT_ALIGN_FIELD },
    { utility: 'rounded-lg', field: ROUNDED_FIELD },
    { utility: 'rounded-full', field: ROUNDED_FIELD },
    { utility: 'shadow-md', field: SHADOW_FIELD },
    { utility: 'shadow-xl', field: SHADOW_FIELD },
  ];

  it.each(utilitySamples)('round-trips $utility', ({ utility, field }) => {
    expect(roundTripStyleUtility(utility, field)).toBe(utility);
  });

  it.each(['opacity-0', 'opacity-50', 'opacity-75', 'opacity-100'])(
    'round-trips opacity %s',
    (utility) => {
      expect(roundTripOpacityClassName(utility)).toBe(utility);
      expect(encodeOpacityClassName(parseOpacityClassName(utility))).toBe(utility);
    },
  );

  it('snaps slider percentages onto the Tailwind opacity scale', () => {
    expect(snapToTailwindOpacityScale(47)).toBe(50);
    expect(snapToTailwindOpacityScale(73)).toBe(75);
    expect(parseOpacityClassName('text-sm opacity-50 flex')).toBe(50);
    expect(encodeOpacityClassName(50, 'md:')).toBe('md:opacity-50');
  });

  it('clears empty style utilities to blank', () => {
    expect(roundTripStyleUtility('', TEXT_SIZE_FIELD)).toBe('');
    expect(encodeOpacityClassName(null)).toBe('');
  });
});

describe('T1-11d visual style panel codegen regression', () => {
  const normalizeClassTokens = (value: string) => value.trim().split(/\s+/).filter(Boolean).sort().join(' ');

  it('produces identical TSX whether className is set raw or via typography/appearance utilities', () => {
    const finalClassName = 'text-lg font-bold text-center rounded-lg shadow-md opacity-75';

    let direct = createInitialDesignerState();
    direct = designerReducer(direct, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: direct.document.rootNodeId,
    });
    const directNodeId = direct.document.nodes[direct.document.rootNodeId].children[0] as string;
    direct = designerReducer(direct, {
      type: 'set-node-prop',
      nodeId: directNodeId,
      key: 'className',
      value: finalClassName,
    });
    const directTsx = generateDesignerTsx(direct.document, direct.bindingDefinitions);

    let visual = createInitialDesignerState();
    visual = designerReducer(visual, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: visual.document.rootNodeId,
    });
    const visualNodeId = visual.document.nodes[visual.document.rootNodeId].children[0] as string;

    let className = '';
    className = applyResponsiveTailwindUtility(className, TEXT_SIZE_FIELD, 'text-lg', '');
    className = applyResponsiveTailwindUtility(className, FONT_WEIGHT_FIELD, 'font-bold', '');
    className = applyResponsiveTailwindUtility(className, TEXT_ALIGN_FIELD, 'text-center', '');
    className = applyResponsiveTailwindUtility(className, ROUNDED_FIELD, 'rounded-lg', '');
    className = applyResponsiveTailwindUtility(className, SHADOW_FIELD, 'shadow-md', '');
    className = applyResponsiveTailwindUtility(className, OPACITY_FIELD, encodeOpacityClassName(75), '');

    expect(normalizeClassTokens(className)).toBe(normalizeClassTokens(finalClassName));

    visual = designerReducer(visual, {
      type: 'set-node-prop',
      nodeId: visualNodeId,
      key: 'className',
      value: className,
    });
    const visualTsx = generateDesignerTsx(visual.document, visual.bindingDefinitions);

    expect(visualTsx).toBe(directTsx);
    expect(visualTsx).toContain('text-lg');
    expect(visualTsx).toContain('font-bold');
    expect(visualTsx).toContain('rounded-lg');
    expect(visualTsx).toContain('shadow-md');
    expect(visualTsx).toContain('opacity-75');
  });
});
