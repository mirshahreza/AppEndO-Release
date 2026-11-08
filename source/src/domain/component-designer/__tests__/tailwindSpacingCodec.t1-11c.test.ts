import { describe, expect, it } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  applySpacingToClassName,
  encodeGapClassName,
  encodeSpacingClassName,
  parseGapClassName,
  parseSpacingClassName,
  roundTripSpacingClassName,
} from '../tailwindSpacingCodec';
import {
  applyResponsiveTailwindUtility,
} from '../tailwindClasses';
import { TAILWIND_INSPECTOR_FIELDS } from '../inspectorRegistry';

describe('T1-11c tailwindSpacingCodec round-trip', () => {
  const samples: Array<{ className: string; kind: 'padding' | 'margin' | 'gap' }> = [
    { className: 'p-4', kind: 'padding' },
    { className: 'p-2 px-6', kind: 'padding' },
    { className: 'pt-2 pr-4 pb-6 pl-8', kind: 'padding' },
    { className: 'm-0', kind: 'margin' },
    { className: 'gap-4', kind: 'gap' },
  ];

  it.each(samples)('round-trips $className ($kind)', ({ className, kind }) => {
    expect(roundTripSpacingClassName(className, kind)).toBe(className);
  });

  it('normalizes px/py pairs to the canonical p + px shorthand', () => {
    expect(roundTripSpacingClassName('px-4 py-2', 'padding')).toBe('p-2 px-4');
    expect(parseSpacingClassName('px-4 py-2', 'padding')).toEqual(
      parseSpacingClassName('p-2 px-4', 'padding'),
    );
  });

  it('parses compound padding into visual side values', () => {
    expect(parseSpacingClassName('p-2 px-6', 'padding')).toEqual({
      top: 2,
      right: 6,
      bottom: 2,
      left: 6,
    });
  });

  it('encodes uniform margin and gap', () => {
    expect(encodeSpacingClassName({ top: 0, right: 0, bottom: 0, left: 0 }, 'margin')).toBe('m-0');
    expect(encodeGapClassName(4)).toBe('gap-4');
    expect(parseGapClassName('flex gap-4 p-2')).toBe(4);
  });

  it('applies spacing into a full className without dropping unrelated tokens', () => {
    const withPadding = applySpacingToClassName('flex gap-4 text-sm', 'padding', 'p-4');
    expect(withPadding.split(/\s+/).sort()).toEqual(['flex', 'gap-4', 'p-4', 'text-sm'].sort());

    const replaced = applySpacingToClassName(withPadding, 'padding', 'p-2 px-6');
    const tokens = replaced.split(/\s+/).filter(Boolean);
    expect(tokens).toEqual(expect.arrayContaining(['p-2', 'px-6', 'flex', 'gap-4', 'text-sm']));
    expect(tokens).not.toContain('p-4');
  });
});

describe('T1-11c visual style panel codegen regression', () => {
  const flexDirectionField = TAILWIND_INSPECTOR_FIELDS.find((field) => field.key === 'twFlexDirection');
  const itemsField = TAILWIND_INSPECTOR_FIELDS.find((field) => field.key === 'twItems');
  const justifyField = TAILWIND_INSPECTOR_FIELDS.find((field) => field.key === 'twJustify');

  const normalizeClassTokens = (value: string) => value.trim().split(/\s+/).filter(Boolean).sort().join(' ');

  const extractRootChildClassName = (tsx: string): string => {
    const match = /<div className="([^"]*)">\s*<div \/>/.exec(tsx);
    return match?.[1] ?? '';
  };

  it('produces identical TSX whether className is set raw or via visual codec utilities', () => {
    expect(flexDirectionField && itemsField && justifyField).toBeTruthy();
    if (!flexDirectionField || !itemsField || !justifyField) {
      return;
    }

    const finalClassName = 'flex flex-row flex-wrap items-center justify-center gap-4 p-2 px-6';

    // Path A: set final className directly (legacy raw path)
    let direct = createInitialDesignerState();
    direct = designerReducer(direct, {
      type: 'insert-palette-item',
      itemId: 'layout.flex-row',
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

    // Path B: build the same className through the visual-panel utilities (codec + apply helpers)
    let visual = createInitialDesignerState();
    visual = designerReducer(visual, {
      type: 'insert-palette-item',
      itemId: 'layout.flex-row',
      parentId: visual.document.rootNodeId,
    });
    const visualNodeId = visual.document.nodes[visual.document.rootNodeId].children[0] as string;

    let className = typeof visual.document.nodes[visualNodeId]?.props.className === 'string'
      ? String(visual.document.nodes[visualNodeId].props.className)
      : '';
    className = applyResponsiveTailwindUtility(className, flexDirectionField, 'flex-row', '');
    className = className.split(/\s+/).filter((token) => token !== 'flex-wrap').concat('flex-wrap').join(' ');
    className = applyResponsiveTailwindUtility(className, justifyField, 'justify-center', '');
    className = applyResponsiveTailwindUtility(className, itemsField, 'items-center', '');
    className = applySpacingToClassName(className, 'gap', encodeGapClassName(4));
    className = applySpacingToClassName(
      className,
      'padding',
      encodeSpacingClassName(parseSpacingClassName('p-2 px-6', 'padding'), 'padding'),
    );

    expect(normalizeClassTokens(className)).toBe(normalizeClassTokens(finalClassName));

    visual = designerReducer(visual, {
      type: 'set-node-prop',
      nodeId: visualNodeId,
      key: 'className',
      value: className,
    });
    const visualTsx = generateDesignerTsx(visual.document, visual.bindingDefinitions);

    expect(normalizeClassTokens(extractRootChildClassName(visualTsx)))
      .toBe(normalizeClassTokens(extractRootChildClassName(directTsx)));
    expect(visualTsx).toContain('p-2');
    expect(visualTsx).toContain('px-6');
    expect(visualTsx).toContain('gap-4');
  });
});
