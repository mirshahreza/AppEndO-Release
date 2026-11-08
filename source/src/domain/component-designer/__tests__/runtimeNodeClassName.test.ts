import { describe, expect, it } from 'vitest';
import { applyTailwindUtility, resolveResponsiveTailwindUtilityValue, applyResponsiveTailwindUtility } from '../tailwindClasses';
import { TAILWIND_INSPECTOR_FIELDS, type TailwindInspectorField } from '../inspectorRegistry';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { renderHeroUiRealNode } from '../runtimeRenderer';
import {
  mergePreviewContainerClassName,
  nodeClassNameHasWidthUtility,
  nodeClassNameRequestsBlockShell,
  resolveRuntimeNodeClassName,
} from '../runtimeShared';
import type { DesignerNode } from '../types';

const buildNode = (className: string, paletteItemId: string): DesignerNode => ({
  id: 'node-1',
  type: 'container',
  parentId: 'root',
  order: 0,
  props: {
    className,
    _designerPaletteItemId: paletteItemId,
  },
  layout: {},
  binding: {},
  children: [],
});

describe('runtime node className helpers', () => {
  it('detects block shell width utilities', () => {
    expect(nodeClassNameRequestsBlockShell('w-full')).toBe(true);
    expect(nodeClassNameRequestsBlockShell('max-w-md')).toBe(true);
    expect(nodeClassNameRequestsBlockShell('text-sm')).toBe(false);
  });

  it('does not prefix w-full onto containers that already set a width', () => {
    expect(nodeClassNameHasWidthUtility('flex !w-64 shrink-0 flex-col')).toBe(true);
    expect(mergePreviewContainerClassName('flex !w-64 shrink-0 flex-col')).toBe('flex !w-64 shrink-0 flex-col');
    expect(mergePreviewContainerClassName('flex flex-col gap-3')).toBe('w-full flex flex-col gap-3');
  });

  it('merges node className with runtime extras', () => {
    const node = buildNode('w-full max-w-lg', 'heroui.dropdown');
    expect(resolveRuntimeNodeClassName(node, 'pointer-events-none')).toBe('!w-full !max-w-lg pointer-events-none');
  });

  it('promotes rounded/padding/height/width/opacity/shadow utilities to important so HeroUI chrome does not win', () => {
    const node = buildNode('inline-flex rounded-lg px-2 h-8 w-full text-xs opacity-75 shadow-md', 'heroui.button-solid');
    expect(resolveRuntimeNodeClassName(node)).toBe(
      'inline-flex !rounded-lg !px-2 !h-8 !w-full !text-xs !opacity-75 !shadow-md',
    );
  });

  it('does not promote arbitrary bracket size utilities (those use inline style)', () => {
    const node = buildNode('w-[320px] h-[50%]', 'heroui.button-solid');
    expect(resolveRuntimeNodeClassName(node)).toBe('w-[320px] h-[50%]');
  });
});

describe('tailwind utilities on runtime components', () => {
  it('applies width utilities on dropdown preview shell', () => {
    const initial = createInitialDesignerState();
    const withDropdown = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.dropdown',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withDropdown.selectedNodeId!;
    const widthField = TAILWIND_INSPECTOR_FIELDS.find((field) => field.key === 'twWidth')!;
    const className = applyTailwindUtility('', widthField, 'w-full');
    const state = designerReducer(withDropdown, {
      type: 'set-node-prop',
      nodeId,
      key: 'className',
      value: className,
    });

    const node = state.document.nodes[nodeId];
    const rendered = renderHeroUiRealNode(node, { mode: 'design' });
    expect(rendered).toBeTruthy();

    const shellClassName = resolveRuntimeNodeClassName(
      node,
      'flex w-full max-w-full flex-col items-stretch gap-1',
    );
    expect(shellClassName).toContain('w-full');
  });

  it('applies width utilities in visual preview document render', () => {
    const initial = createInitialDesignerState();
    const withInput = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withInput.selectedNodeId!;
    const widthField = TAILWIND_INSPECTOR_FIELDS.find((field) => field.key === 'twWidth')!;
    const className = applyTailwindUtility('rounded-md border', widthField, 'w-full');
    const state = designerReducer(withInput, {
      type: 'set-node-prop',
      nodeId,
      key: 'className',
      value: className,
    });

    const preview = renderDesignerDocumentPreview(state.document);
    expect(preview).toBeTruthy();
    expect(state.document.nodes[nodeId].props.className).toContain('w-full');
  });

  it('maps surfaceToken to background Tailwind class', () => {
    const node = buildNode('', 'layout.dock-pane');
    node.props.surfaceToken = 'workspace';
    expect(resolveRuntimeNodeClassName(node)).toBe('bg-surface-workspace');

    node.props.surfaceToken = 'elevated';
    expect(resolveRuntimeNodeClassName(node)).toBe('bg-surface-elevated');

    node.props.surfaceToken = 'shell';
    expect(resolveRuntimeNodeClassName(node)).toBe('bg-surface-shell');

    node.props.surfaceToken = 'transparent';
    expect(resolveRuntimeNodeClassName(node)).toBe('bg-transparent');

    node.props.surfaceToken = 'menu';
    expect(resolveRuntimeNodeClassName(node)).toBe('bg-nav-active');

    node.props.surfaceToken = 'header';
    expect(resolveRuntimeNodeClassName(node)).toBe('bg-surface-panel-muted');
  });

  it('resolves and applies responsive Tailwind utility classes', () => {
    const field = TAILWIND_INSPECTOR_FIELDS.find((f) => f.key === 'twDisplay')!;
    
    // Test resolve
    let className = 'block md:flex lg:hidden';
    expect(resolveResponsiveTailwindUtilityValue(className, field, '')).toBe('block');
    expect(resolveResponsiveTailwindUtilityValue(className, field, 'md:')).toBe('md:flex');
    expect(resolveResponsiveTailwindUtilityValue(className, field, 'lg:')).toBe('lg:hidden');

    // Test apply
    className = applyResponsiveTailwindUtility('block px-4', field, 'flex', 'md:');
    expect(className).toBe('block px-4 md:flex');

    className = applyResponsiveTailwindUtility('block px-4 md:flex', field, 'hidden', 'md:');
    expect(className).toBe('block px-4 md:hidden');

    className = applyResponsiveTailwindUtility('block px-4 md:flex', field, '', 'md:');
    expect(className).toBe('block px-4');
  });
});
