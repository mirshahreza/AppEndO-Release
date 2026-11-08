import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { generateDesignerTsx } from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

/**
 * Bug found: `heroui.modal` / `heroui.alert-dialog` / `heroui.drawer`, when NOT driven by a
 * showHide Dynamic Action or a GridDetail flow, exported a bare static `isOpen` with NO
 * close handler at all — a modal simply dropped onto the canvas and published (the most
 * common, default case) could never be dismissed by the user (backdrop click / Escape) in the
 * real published app: a permanent, full-page-blocking overlay. Fixed by giving each such node
 * its own local `React.useState<boolean>` in the generated component's preamble.
 *
 * Modal / alert-dialog now export CreateEditModalShell / ConfirmDialogShell with conditional
 * mount + `onClose` / `onBackdropClick` (not HeroUI `isOpen` / `onOpenChange`). Drawer still
 * uses HeroUI Drawer with `isOpen` / `onOpenChange`.
 */

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

describe.each(['heroui.modal', 'heroui.alert-dialog', 'heroui.drawer'] as const)('%s dismissability without a Dynamic Action', (itemId) => {
  it('declares real local open state and wires a working dismiss path, not a dead static isOpen', async () => {
    const state = insert(createInitialDesignerState(), itemId);
    const nodeId = lastChild(state);
    const sanitizedId = nodeId.replace(/[^a-zA-Z0-9_]/g, '_');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await assertValidTsxSyntax(itemId, tsx);

    expect(tsx).toContain(`const [isOpen_${sanitizedId}, setIsOpen_${sanitizedId}] = React.useState(`);

    if (itemId === 'heroui.drawer') {
      expect(tsx).toContain(`isOpen={isOpen_${sanitizedId}}`);
      expect(tsx).toContain(`onOpenChange={setIsOpen_${sanitizedId}}`);
      return;
    }

    // Shells mount when open and dismiss via onClose / onBackdropClick → setState(false).
    expect(tsx).toContain(`{isOpen_${sanitizedId} ? (`);
    expect(tsx).toContain(`setIsOpen_${sanitizedId}(false)`);
    expect(tsx).toContain('onClose={() => {');
    if (itemId === 'heroui.modal') {
      expect(tsx).toContain('<CreateEditModalShell');
    } else {
      expect(tsx).toContain('<ConfirmDialogShell');
    }
  });

  it('seeds the local open state from the static Inspector "Open" checkbox', async () => {
    let state = insert(createInitialDesignerState(), itemId);
    const nodeId = lastChild(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'isOpen', value: true });
    const sanitizedId = nodeId.replace(/[^a-zA-Z0-9_]/g, '_');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain(`React.useState(true)`);
    expect(tsx).toMatch(new RegExp(`isOpen_${sanitizedId}[^=]*=[^;]*React\\.useState\\(true\\)`));
  });
});
