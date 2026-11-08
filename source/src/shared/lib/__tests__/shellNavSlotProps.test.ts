import { describe, expect, it } from 'vitest';
import type { DesignerDocument } from '../../../domain/component-designer/types';
import {
  SHELL_NAV_REGION_SIDE,
  SHELL_NAV_REGION_TOP,
} from '../shellNavRegions';
import {
  extractShellNavSlotConfigFromDocument,
  resolveShellNavNavigationRef,
} from '../shellNavSlotProps';

function makeDocument(nodes: DesignerDocument['nodes']): DesignerDocument {
  return {
    schemaVersion: '1.0.0',
    id: 'doc-1',
    name: 'Test Document',
    rootNodeId: 'root',
    nodes,
    metadata: {
      createdAt: '',
      updatedAt: '',
    },
    diagnostics: [],
  };
}

describe('shellNavSlotProps', () => {
  it('extracts navigationRef from nav region system-slot nodes', () => {
    const document = makeDocument({
      root: { id: 'root', type: 'container', props: {}, children: ['side'], parentId: null, order: 0, layout: {}, binding: {} },
      side: {
        id: 'side',
        type: 'system-slot',
        props: { slotId: SHELL_NAV_REGION_SIDE, navigationRef: ' my-nav ' },
        children: [],
        parentId: 'root',
        order: 0,
        layout: {},
        binding: {},
      },
      top: {
        id: 'top',
        type: 'system-slot',
        props: { slotId: SHELL_NAV_REGION_TOP, navigationRef: 'top-nav' },
        children: [],
        parentId: 'root',
        order: 1,
        layout: {},
        binding: {},
      },
    });

    expect(extractShellNavSlotConfigFromDocument(document)).toEqual({
      [SHELL_NAV_REGION_SIDE]: { navigationRef: 'my-nav' },
      [SHELL_NAV_REGION_TOP]: { navigationRef: 'top-nav' },
    });
  });

  it('prefers slot navigationRef over shell fallback', () => {
    const config = extractShellNavSlotConfigFromDocument(makeDocument({
      root: { id: 'root', type: 'container', props: {}, children: ['side'], parentId: null, order: 0, layout: {}, binding: {} },
      side: {
        id: 'side',
        type: 'system-slot',
        props: { slotId: SHELL_NAV_REGION_SIDE, navigationRef: 'custom' },
        children: [],
        parentId: 'root',
        order: 0,
        layout: {},
        binding: {},
      },
    }));

    expect(resolveShellNavNavigationRef(SHELL_NAV_REGION_SIDE, config, 'studio')).toBe('custom');
  });

  it('falls back to shell navigationRef when slot prop is absent', () => {
    expect(resolveShellNavNavigationRef(SHELL_NAV_REGION_SIDE, {}, 'studio')).toBe('studio');
    expect(resolveShellNavNavigationRef(SHELL_NAV_REGION_SIDE, {}, null)).toBeNull();
  });
});
