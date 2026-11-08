import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { generateDesignerTsx } from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

/**
 * Bug found (parity audit item 4): `platform.slot.core.shell.header` (and its alias
 * `shell.chrome.slot-header-actions`) — the showLogo/showBreadcrumb/showActions Inspector
 * fields were honored in the live/published shell (extractShellHeaderConfigFromDocument), but
 * silently ignored in both the design canvas and the exported `.tsx` — `DesignerSlotPreview`'s
 * header branch never passed a `config`, and export never even emitted a `slotProps` attribute
 * at all (unlike canvas's `slotProps={node.props}`). Fixed in both `DesignerSlotPreview.tsx`
 * and `tsxPlatformPalette.ts`.
 */

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const findHeaderSlotNodeId = (state: DesignerState): string => {
  const node = Object.values(state.document.nodes).find(
    (n) => n.type === 'system-slot' && n.props.slotId === 'core.shell.header',
  );
  expect(node).toBeTruthy();
  return node!.id;
};

describe('shell header slot config export fix', () => {
  it('exports a real slotProps object with showLogo/showBreadcrumb/showActions on DesignerSlotPreview, not as flat dead attributes', () => {
    let state = insert(createInitialDesignerState(), 'shell.chrome.header');
    const nodeId = findHeaderSlotNodeId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'showLogo', value: false });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'showBreadcrumb', value: false });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('shell header slot config', tsx);

    const tagMatch = tsx.match(/<DesignerSlotPreview\b[^>]*\sslotId="core\.shell\.header"[^>]*\/>/);
    expect(tagMatch).toBeTruthy();
    const tag = tagMatch![0];
    expect(tag).toContain('slotProps={');
    expect(tag).toContain('"showLogo":false');
    expect(tag).toContain('"showBreadcrumb":false');
    // Never leaks as a flat, invalid DOM attribute on the wrapper.
    expect(tag).not.toMatch(/\sshowLogo=/);
    expect(tag).not.toMatch(/\sshowBreadcrumb=/);
  });
});
