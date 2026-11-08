/**
 * @vitest-environment jsdom
 * Bug found (parity audit item 3): generic plugin-contributed platform slots
 * (core.sidebar.navigation, core.dashboard.widgets, core.settings.sections,
 * core.toolbar.actions) were resolved correctly via the real `slotRegistry` in both the design
 * canvas and the exported `.tsx` (both use `DesignerSlotPreview` directly), but the
 * interactive-preview/published-page render engine (`designerRuntimePreview.tsx`) never
 * consulted `slotRegistry` at all — those slots always fell to the static placeholder, so real
 * plugin widgets never appeared on a published page.
 */
import * as React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CORE_SLOT_CATALOG } from '../../../shared/api/contracts/slots/catalog';
import { getDesignerPaletteCatalog, resetDesignerPaletteCatalog, setDesignerPaletteCatalog } from '../catalog';
import { buildSlotPaletteItems } from '../slotPalette';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { slotRegistry } from '../../../core/slots/SlotRegistry';
import { DASHBOARD_WIDGETS_SLOT_ID } from '../DesignerRuntimeRegisteredSlotFill';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: state.document.rootNodeId });

const lastChildId = (state: DesignerState): string => {
  const parent = state.document.nodes[state.document.rootNodeId];
  return parent.children[parent.children.length - 1] as string;
};

describe('generic platform slots — live preview fix', () => {
  beforeAll(() => {
    setDesignerPaletteCatalog([...getDesignerPaletteCatalog(), ...buildSlotPaletteItems(CORE_SLOT_CATALOG)]);
  });

  afterAll(() => {
    resetDesignerPaletteCatalog();
  });

  afterEach(() => {
    slotRegistry.unregisterByPackage('preview-test-package');
    cleanup();
  });

  it('renders a real registered widget for core.dashboard.widgets in interactive preview, not the placeholder', () => {
    const Widget = () => <div data-testid="real-dashboard-widget">Live widget</div>;
    slotRegistry.register({
      id: 'widget-1',
      packageId: 'preview-test-package',
      target: DASHBOARD_WIDGETS_SLOT_ID,
      order: 10,
      component: Widget,
    });

    let state = insertItem(createInitialDesignerState(), 'platform.slot.core.dashboard.widgets');
    const nodeId = lastChildId(state);
    void nodeId;

    render(<>{renderDesignerDocumentPreview(state.document, { interactive: true })}</>);

    expect(screen.getByTestId('real-dashboard-widget')).toBeTruthy();
    expect(screen.queryByText('Platform Slot')).toBeNull();
  });

  it('still shows the empty-state placeholder when nothing is registered for the slot (honest no-op)', () => {
    const state = insertItem(createInitialDesignerState(), 'platform.slot.core.settings.sections');
    render(<>{renderDesignerDocumentPreview(state.document, { interactive: true })}</>);
    expect(screen.getByText('Platform Slot')).toBeTruthy();
  });
});
