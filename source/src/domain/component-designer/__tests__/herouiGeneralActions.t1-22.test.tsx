/**
 * @vitest-environment jsdom
 * Phase T1-22 — HeroUI General/Actions audit regression tests.
 */
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Toast } from '@heroui/react';
import { getBindingCapabilityRow } from '../bindingCapabilityMatrix';
import { generateDesignerTsx } from '../codegen';
import {
  collectDocumentBindingPlan,
  createDynamicActionsEventBindingDefinition,
  createPropertyBindingDefinition,
  eventBindingKeyForEvent,
  propertyBindingKeyForProp,
} from '../bindingEngine';
import { createDynamicAction } from '../bindingDynamicActionsEngine';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { resolveNodeEventBindingTargets } from '../bindingEngine';
import { createInitialDesignerState, designerReducer } from '../state';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import type { DesignerState } from '../types';

const HEROUI_GENERAL_ACTION_IDS = [
  'heroui.button-solid',
  'heroui.button-outline',
  'heroui.link',
  'heroui.chip',
  'heroui.avatar',
  'heroui.spinner',
  'heroui.skeleton',
  'heroui.tooltip-trigger',
] as const;

const DYNAMIC_ACTION_IDS = [
  'heroui.button-solid',
  'heroui.button-outline',
  'heroui.link',
  'heroui.chip',
] as const;

const HOVER_EVENT_IDS = [
  'heroui.chip',
  'heroui.avatar',
  'heroui.tooltip-trigger',
] as const;

const toastMock = vi.hoisted(() => vi.fn(() => 'toast-key'));

vi.mock('@heroui/react', async () => {
  const actual = await vi.importActual<typeof import('@heroui/react')>('@heroui/react');
  return {
    ...actual,
    toast: toastMock,
    Toast: {
      ...(actual.Toast as object),
      Provider: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="toast-provider">{children}</div>
      ),
    },
  };
});

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: parentId ?? state.document.rootNodeId,
  });

const lastChildId = (state: DesignerState, parentId: string): string => {
  const parent = state.document.nodes[parentId];
  return parent.children[parent.children.length - 1] as string;
};

describe('T1-22 HeroUI General/Actions audit', () => {
  beforeEach(() => {
    toastMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it.each(HEROUI_GENERAL_ACTION_IDS)('renders %s in canvas preview without throwing', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
  });

  it.each(HEROUI_GENERAL_ACTION_IDS)('exports TSX for %s', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('export const GeneratedComponent');
  });

  it.each(DYNAMIC_ACTION_IDS)('lists DynamicActions capability for %s', (itemId) => {
    const row = getBindingCapabilityRow(itemId);
    expect(row?.supportedCapabilities).toContain('DynamicActions');
  });

  it.each(['heroui.avatar', 'heroui.spinner', 'heroui.skeleton', 'heroui.tooltip-trigger'] as const)(
    'has no matrix binding obligations for %s',
    (itemId) => {
      const row = getBindingCapabilityRow(itemId);
      expect(row?.bindingStatus).toBe('none');
      expect(row?.supportedCapabilities).toEqual([]);
    },
  );

  it('reflects button-solid label and loading state in canvas and export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.button-solid');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'text',
      value: 'Save changes',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'isLoading',
      value: true,
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Save changes');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('Save changes');
    expect(tsx).toContain('isPending');
    // Bug found (parity audit item 19): 'color' removed — @heroui/react's real Button has no
    // such prop/variant at all; a leftover value on an older saved document must never leak.
    expect(tsx).not.toMatch(/\scolor=/);
  });

  it('reflects button-outline variant in export TSX', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.button-outline');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'text',
      value: 'Cancel',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('Cancel');
    expect(tsx).toContain('variant="outline"');
  });

  it('renders long chip label without breaking preview', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.chip');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const longLabel = 'Status '.repeat(40).trim();

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'text',
      value: longLabel,
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Status');
  });

  it('reflects chip color and variant in export TSX', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.chip');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'color',
      value: 'success',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'variant',
      value: 'soft',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('color="success"');
    expect(tsx).toContain('variant="soft"');
  });

  it('reflects skeleton animationType in export TSX (parity audit item 22: isLoaded replaced — never a real prop)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.skeleton');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'animationType',
      value: 'pulse',
    });

    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('animationType="pulse"');
    expect(tsx).not.toMatch(/\sisLoaded=/);
  });

  it('reflects avatar fallback text and image src in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.avatar');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'text',
      value: 'EK',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'src',
      value: 'https://example.com/avatar.png',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'alt',
      value: 'Profile photo',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('EK');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('EK');
    expect(tsx).toContain('avatar.png');
    expect(tsx).toContain('Profile photo');
  });

  it('renders tooltip-trigger design-mode placeholder markup', () => {
    const state = insertItem(createInitialDesignerState(), 'heroui.tooltip-trigger');
    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.querySelector('[data-designer-component="heroui.tooltip-trigger"]')).toBeTruthy();
  });

  it('exports tooltip-trigger with Tooltip.Root structure', () => {
    const state = insertItem(createInitialDesignerState(), 'heroui.tooltip-trigger');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<Tooltip.Root');
    expect(tsx).toContain('<Tooltip.Trigger');
    expect(tsx).toContain('<Tooltip.Content');
  });

  // Bug found (parity audit item 8): the no-href trigger case exported the exact same static,
  // non-interactive placeholder <span> the design canvas uses for its own preview chip, instead
  // of the real interactive <Button> the live canvas/interactive Preview renders
  // (DesignerRuntimeParityPalette.tsx's HButton) — a published no-href tooltip trigger was
  // completely inert (non-clickable, non-keyboard-focusable) in the actual app.
  it('exports a real interactive Button for the no-href trigger case, not a static span', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.tooltip-trigger');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    // The palette default seeds href="#" (Link branch) — clear it to exercise the no-href case.
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'href', value: '' });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<Button variant="ghost" size="sm">');
    expect(tsx).not.toMatch(/<span className="inline-flex rounded-md border border-dashed/);
    expect(tsx).toContain("import { Button, Link, Tooltip } from '@heroui/react';");
  });

  it('exports the no-href trigger Button as isDisabled when the node is disabled', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.tooltip-trigger');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'href', value: '' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'isDisabled', value: true });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<Button variant="ghost" size="sm" isDisabled>');
  });

  it('still exports a real interactive Link (not a Button) for the href trigger case', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.tooltip-trigger');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'href', value: '/docs' });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<Link href="/docs"');
    expect(tsx).not.toContain('<Button');
  });

  // Bug found: `tooltipText` was never read by codegen at all — the exported tooltip always
  // repeated the trigger's own label, and a static `tooltipText` leaked as a bogus attribute on
  // `<Tooltip.Root>` (not a real prop there).
  it('exports the configured tooltipText inside Tooltip.Content, not the trigger label', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.tooltip-trigger');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'text', value: 'Info' });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'tooltipText',
      value: 'THIS IS THE REAL TOOLTIP MESSAGE',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<Tooltip.Content showArrow offset={8}>THIS IS THE REAL TOOLTIP MESSAGE</Tooltip.Content>');
    expect(tsx).not.toMatch(/tooltipText=/);
  });

  it('confirms heroui.link onClick binding fires in interactive preview (doc 10 §6)', async () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.link');
    const linkId = lastChildId(state, state.document.rootNodeId);

    const toastAction = createDynamicAction('showToast');
    toastAction.toastTitle = 'Link clicked';

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: linkId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [toastAction]),
    });

    render(
      <Toast.Provider>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          interactive: true,
        })}
      </Toast.Provider>,
    );

    const link = screen.getByRole('link');
    fireEvent.click(link);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith('Link clicked', expect.any(Object));
    });
  });

  it('fires Show Toast when clicking button-solid with DynamicActions binding', async () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.button-solid');
    const buttonId = lastChildId(state, state.document.rootNodeId);

    const toastAction = createDynamicAction('showToast');
    toastAction.toastTitle = 'Button clicked';

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [toastAction]),
    });

    render(
      <Toast.Provider>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          interactive: true,
        })}
      </Toast.Provider>,
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith('Button clicked', expect.any(Object));
    });
  });

  it('fires Show Toast when clicking button-outline with DynamicActions binding', async () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.button-outline');
    const buttonId = lastChildId(state, state.document.rootNodeId);

    const toastAction = createDynamicAction('showToast');
    toastAction.toastTitle = 'Outline clicked';

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [toastAction]),
    });

    render(
      <Toast.Provider>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          interactive: true,
        })}
      </Toast.Provider>,
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith('Outline clicked', expect.any(Object));
    });
  });

  it('prevents default href navigation for dynamic-only button clicks while still running actions', async () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.button-solid');
    const buttonId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: buttonId,
      key: 'href',
      value: '#',
    });

    const toastAction = createDynamicAction('showToast');
    toastAction.toastTitle = 'Delete clicked';

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [toastAction]),
    });

    const { container } = render(
      <Toast.Provider>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          interactive: true,
        })}
      </Toast.Provider>,
    );

    const trigger = container.querySelector('a[href="#"], button');
    expect(trigger).toBeTruthy();

    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    trigger!.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith('Delete clicked', expect.any(Object));
    });
  });

  it.each(HOVER_EVENT_IDS)('exposes onHover inspector target for %s', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const node = state.document.nodes[nodeId];
    expect(resolveNodeEventBindingTargets(node)).toContain('onHover');
  });

  it('fires chip onHover DynamicActions binding on mouse enter', async () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.chip');
    const chipId = lastChildId(state, state.document.rootNodeId);

    const toastAction = createDynamicAction('showToast');
    toastAction.toastTitle = 'Chip hovered';

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: chipId,
      bindingKey: eventBindingKeyForEvent('onHover'),
      definition: createDynamicActionsEventBindingDefinition('onHover', [toastAction]),
    });

    const { container } = render(
      <Toast.Provider>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          interactive: true,
        })}
      </Toast.Provider>,
    );

    const chip = container.querySelector('[data-slot="chip"], [class*="chip"]') ?? container.firstElementChild;
    expect(chip).toBeTruthy();
    fireEvent.mouseEnter(chip!);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith('Chip hovered', expect.any(Object));
    });
  });

  it('emits bound avatar src expression in export TSX', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.avatar');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: propertyBindingKeyForProp('src'),
      definition: createPropertyBindingDefinition('src', 'user.avatarUrl'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('dataContext?.user?.avatarUrl');
    expect(tsx).toContain('<Avatar');
  });

  it('compiles button-solid DynamicActions binding to generated handler', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.button-solid');
    const buttonId = lastChildId(state, state.document.rootNodeId);

    const toastAction = createDynamicAction('showToast');
    toastAction.toastTitle = 'Exported';

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [toastAction]),
    });

    const plan = collectDocumentBindingPlan(state.document, state.bindingDefinitions);
    expect(plan.eventBindings.some((binding) => binding.nodeId === buttonId && binding.targetEvent === 'onClick')).toBe(true);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('onClick=');
    expect(tsx).toMatch(/toast/);
  });

  it.each(['heroui.button-solid', 'heroui.button-outline'] as const)(
    "does not offer a non-functional 'Radius' Inspector control for %s (regression: @heroui/react's Button has no radius prop — the old field silently did nothing in canvas or export)",
    (itemId) => {
      const state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      const node = state.document.nodes[nodeId];
      const keys = resolveInspectorFieldSections(node).flatMap((section) => section.fields.map((field) => field.key));
      expect(keys).not.toContain('radius');
    },
  );
});
