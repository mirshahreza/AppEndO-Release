/**
 * Bug found (per-element gap #15 / Phase 44): `viz.sheet` only supported raw
 * string matrix data, so API-backed structured columns, formula cells, and
 * runtime onCellChange action chains were dead. Fixed in
 * `visualizationDataTransform.ts`, `visualizationDataModel.ts`,
 * `BindingVizFieldMappingStep.tsx`, and `DesignerRuntimeSheet.tsx` by adding
 * typed sheet columns, formula evaluation via the shared expression engine, and
 * real cell-change dynamic-action execution.
 */
// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  DesignerVizSheet,
  executeSheetCellChangeActions,
  resolveSheetComputedRows,
} from '../DesignerRuntimeSheet';
import type { DesignerSheetData } from '../visualizationDataModel';

vi.mock('@heroui/react', async () => {
  const { componentDesignerHeroUiMock } = await import('../../../test-support/componentDesignerHeroUiMock');
  return {
    ...componentDesignerHeroUiMock,
    ComboBox: () => null,
    ListBoxItem: () => null,
  };
});

vi.mock('../../../shared/ui/HeroFieldControls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/ui/HeroFieldControls')>();
  return {
    ...actual,
    UiInput: ({ value, onChange, ariaLabel, type }: any) => (
      <input value={value ?? ''} onChange={onChange} aria-label={ariaLabel} type={type} />
    ),
    UiSelect: ({ value, onChange, ariaLabel, children }: any) => (
      <select value={value ?? ''} onChange={onChange} aria-label={ariaLabel}>{children}</select>
    ),
  };
});

const SHEET_DATA: DesignerSheetData = {
  columns: [
    { key: 'qty', header: 'Qty', type: 'number' },
    { key: 'price', header: 'Price', type: 'number' },
    { key: 'status', header: 'Status', type: 'select', options: ['draft', 'done'] },
    { key: 'total', header: 'Total', type: 'formula', formula: '= qty * price' },
  ],
  rows: [
    { qty: 2, price: 5, status: 'draft' },
  ],
};

afterEach(() => {
  cleanup();
});

describe('Phase 44 - viz.sheet', () => {
  it('recomputes formula columns when an editable number cell changes', async () => {
    render(<DesignerVizSheet data={SHEET_DATA} />);

    expect(screen.getByText('10')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Qty'), { target: { value: '3' } });

    await waitFor(() => {
      expect(screen.getByText('15')).toBeTruthy();
    });
  });

  it('runs onCellChangeAction chains for edited cells', async () => {
    const patchStore = vi.fn();
    await executeSheetCellChangeActions(
      {
        key: 'status',
        header: 'Status',
        type: 'select',
        options: ['draft', 'done'],
        onCellChangeAction: [
          {
            id: 'da_set',
            type: 'setValue',
            targetNodeId: 'sheet-node',
            storePath: 'sheet.lastStatus',
            valueSource: 'static',
            staticValue: 'changed',
          },
        ],
      },
      0,
      { status: 'done' },
      {
        definitions: {},
        storeSegments: {},
        lovs: {},
        dataSources: {},
      },
      {
        designerStore: {},
        patchStore,
      },
    );

    expect(patchStore).toHaveBeenCalledWith('sheet.lastStatus', 'changed');
  });

  it('evaluates formulas with the shared expression compiler aliases', () => {
    const rows = resolveSheetComputedRows(
      [{ qty: 4, price: 7 }],
      [
        { key: 'qty', header: 'Qty', type: 'number' },
        { key: 'price', header: 'Price', type: 'number' },
        { key: 'total', header: 'Total', type: 'formula', formula: '= qty * price' },
      ],
    );

    expect(rows[0]?.total).toBe(28);
  });
});
