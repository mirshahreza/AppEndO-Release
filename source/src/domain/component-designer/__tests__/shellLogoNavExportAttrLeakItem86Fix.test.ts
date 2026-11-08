/**
 * Bug found (parity audit item 86): Export for Logo / Nav-Region platform slots still leaked
 * `logoSrc`/`logoAlt`/`logoHref`/`navigationRef` as flat attributes on `<DesignerSlotPreview>`
 * because `excludeKeys` in `tsxPlatformPalette.ts` only covered header toggles. Values already
 * travel correctly via `slotProps={...}`; the flat attrs were cosmetic/invalid-HTML duplication.
 * Fixed by extending excludeKeys with the logo + nav-region config keys.
 */
import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { generateDesignerTsx } from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerDocument, DesignerNode, DesignerState } from '../types';
import { renderPlatformPaletteJsx } from '../tsxPlatformPalette';
import { SHELL_CHROME_LOGO } from '../../../shared/lib/shellChromeSlots';
import {
  SHELL_LOGO_ALT_PROP,
  SHELL_LOGO_HREF_PROP,
  SHELL_LOGO_SRC_PROP,
} from '../../../shared/lib/shellLogoProps';
import { SHELL_NAV_REGION_SIDE } from '../../../shared/lib/shellNavRegions';
import { SHELL_NAV_SLOT_NAVIGATION_REF_PROP } from '../../../shared/lib/shellNavSlotProps';

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: parentId ?? state.document.rootNodeId,
  });

const findLogoSlotNodeId = (state: DesignerState): string => {
  const node = Object.values(state.document.nodes).find(
    (n) => n.type === 'system-slot' && n.props.slotId === SHELL_CHROME_LOGO,
  );
  expect(node).toBeTruthy();
  return node!.id;
};

const makeNavSideSlotNode = (): DesignerNode => ({
  id: 'nav-side',
  type: 'system-slot',
  parentId: 'root',
  order: 0,
  props: {
    slotId: SHELL_NAV_REGION_SIDE,
    label: 'Side Nav',
    surface: 'admin-shell',
    [SHELL_NAV_SLOT_NAVIGATION_REF_PROP]: 'studio-side-nav',
    _designerPaletteItemId: `platform.slot.${SHELL_NAV_REGION_SIDE}`,
  },
  layout: {},
  binding: {},
  children: [],
});

describe('shell logo/nav export attribute leak (item 86)', () => {
  it('keeps logoSrc/logoAlt/logoHref inside slotProps and never as flat DesignerSlotPreview attrs', () => {
    let state = insert(createInitialDesignerState(), 'shell.chrome.slot-logo');
    const nodeId = findLogoSlotNodeId(state);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: SHELL_LOGO_SRC_PROP,
      value: 'https://cdn.example.com/brand.svg',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: SHELL_LOGO_ALT_PROP,
      value: 'Brand',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: SHELL_LOGO_HREF_PROP,
      value: 'https://example.com',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('shell logo slot config', tsx);

    const tagMatch = tsx.match(/<DesignerSlotPreview\b[^>]*\sslotId="core\.shell\.logo"[^>]*\/>/);
    expect(tagMatch).toBeTruthy();
    const tag = tagMatch![0];
    expect(tag).toContain('slotProps={');
    expect(tag).toContain('"logoSrc":"https://cdn.example.com/brand.svg"');
    expect(tag).toContain('"logoAlt":"Brand"');
    expect(tag).toContain('"logoHref":"https://example.com"');
    expect(tag).not.toMatch(/\slogoSrc=/);
    expect(tag).not.toMatch(/\slogoAlt=/);
    expect(tag).not.toMatch(/\slogoHref=/);
  });

  it('keeps navigationRef inside slotProps and never as a flat DesignerSlotPreview attr', () => {
    const node = makeNavSideSlotNode();
    const jsx = renderPlatformPaletteJsx(
      `platform.slot.${SHELL_NAV_REGION_SIDE}`,
      node,
    );
    expect(jsx).toBeTruthy();
    expect(jsx!).toContain('slotProps={');
    expect(jsx!).toContain('"navigationRef":"studio-side-nav"');
    expect(jsx!).not.toMatch(/\snavigationRef=/);

    const document: DesignerDocument = {
      ...createInitialDesignerState().document,
      nodes: {
        root: {
          ...createInitialDesignerState().document.nodes.root,
          children: ['nav-side'],
        },
        'nav-side': node,
      },
    };
    const tsx = generateDesignerTsx(document, {});
    assertValidTsxSyntax('shell nav region slot config', tsx);
    const tagMatch = tsx.match(/<DesignerSlotPreview\b[^>]*\sslotId="core\.shell\.nav\.side"[^>]*\/>/);
    expect(tagMatch).toBeTruthy();
    const tag = tagMatch![0];
    expect(tag).toContain('"navigationRef":"studio-side-nav"');
    expect(tag).not.toMatch(/\snavigationRef=/);
  });
});
