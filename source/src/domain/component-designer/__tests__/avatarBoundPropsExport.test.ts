import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { createStoreReadBindingDefinition } from '../bindingStoreEngine';
import type { DesignerState } from '../types';

/**
 * Bug found: `heroui.avatar`'s bound `src`/`alt`/`fallbackSrc`/`text` were excluded from the
 * static attrs pass (to avoid a duplicate attribute) but the manual `Avatar.Image`/
 * `Avatar.Fallback` construction only ever read the STATIC prop value — so a bound photo/
 * fallback-text leaked as a meaningless attribute on the `<Avatar>` wrapper and never rendered
 * in the published app; only the static text-initial fallback ever showed.
 */

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const bindStoreProp = (state: DesignerState, nodeId: string, prop: string, storePath: string): DesignerState => {
  const binding = createStoreReadBindingDefinition(prop, storePath);
  return designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: binding.bindingKey,
    definition: binding.definition,
  });
};

describe('heroui.avatar bound props export', () => {
  it('renders a bound src on Avatar.Image, not as a dead attribute on the Avatar wrapper', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.avatar');
    const nodeId = lastChildId(state);
    state = bindStoreProp(state, nodeId, 'src', 'user.avatarUrl');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('avatar bound src', tsx);

    expect(tsx).toContain('<Avatar.Image src={designerStore?.user?.avatarUrl}');
    const srcAttrCount = (tsx.match(/\bsrc=/g) ?? []).length;
    expect(srcAttrCount).toBe(1);
  });

  it('renders a bound alt on Avatar.Image without duplicating the attribute', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.avatar');
    const nodeId = lastChildId(state);
    // A static src (realistic authoring: alt is bound, the image source is a plain default) —
    // Avatar.Image only renders at all when there's an actual image source configured.
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'src', value: '/default-avatar.png' });
    state = bindStoreProp(state, nodeId, 'alt', 'user.displayName');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('avatar bound alt', tsx);

    expect(tsx).toContain('alt={designerStore?.user?.displayName}');
    const altAttrCount = (tsx.match(/\balt=/g) ?? []).length;
    expect(altAttrCount).toBe(1);
  });

  it('never leaks a bound leftover fallbackSrc onto Avatar (field removed; Avatar.Image has no such prop)', () => {
    // Parity audit item 65: the previous assertion incorrectly treated a leaked
    // `fallbackSrc={…}` on `<Avatar>` as correct behavior. Real Avatar.Image has no
    // fallbackSrc prop — fallback UI is Avatar.Fallback driven by `text`.
    let state = insertItem(createInitialDesignerState(), 'heroui.avatar');
    const nodeId = lastChildId(state);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'src', value: '/default-avatar.png' });
    state = bindStoreProp(state, nodeId, 'fallbackSrc', 'user.fallbackAvatarUrl');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('avatar bound fallbackSrc stripped', tsx);

    expect(tsx).not.toMatch(/\bfallbackSrc=/);
    expect(tsx).toContain('<Avatar.Image src="/default-avatar.png"');
  });

  it('renders bound text inside Avatar.Fallback instead of the static default', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.avatar');
    const nodeId = lastChildId(state);
    state = bindStoreProp(state, nodeId, 'text', 'user.initials');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('avatar bound text', tsx);

    expect(tsx).toContain('<Avatar.Fallback>{designerStore?.user?.initials}</Avatar.Fallback>');
    expect(tsx).not.toContain('<Avatar.Fallback>AB</Avatar.Fallback>');
  });

  it('still renders a plain static avatar correctly when nothing is bound', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.avatar');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('avatar static', tsx);
    expect(tsx).toContain('<Avatar.Fallback>AB</Avatar.Fallback>');
  });
});
