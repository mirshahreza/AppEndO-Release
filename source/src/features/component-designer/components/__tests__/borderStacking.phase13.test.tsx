// @vitest-environment jsdom

/**
 * Phase 13 — Border-stacking reduction.
 * Counts real enclosure `border` utilities in nested Inspector / AutoForm field subtrees
 * (not props-only). Directional dividers (`border-t` / `border-b`) are excluded — the phase
 * targets stacked all-sides borders (`border border-slate-200`).
 */
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';

vi.mock('@heroui/react', async () => {
  const { componentDesignerHeroUiMock } = await import('../../../../test-support/componentDesignerHeroUiMock');
  return componentDesignerHeroUiMock;
});

// Mirrors the real HEROUI_FIELD_BORDER_CLASS / HEROUI_FIELD_NESTED_BORDER_CLASS split
// (surfaceClasses.ts) so this suite exercises the actual `nested` prop wiring rather than
// hard-coding a border on every mocked control.
vi.mock('../../../../shared/ui/HeroFieldControls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/ui/HeroFieldControls')>();
  return {
    ...actual,
    UiInput: ({ value, onChange, ariaLabel, placeholder, disabled, isDisabled, nested }: any) => (
      <input
        value={value ?? ''}
        onChange={onChange}
        aria-label={ariaLabel}
        placeholder={placeholder}
        disabled={Boolean(isDisabled ?? disabled)}
        className={nested ? '!border-0 !shadow-none' : '!border !border-[#e2e8f0]'}
      />
    ),
    UiSelect: ({ value, onChange, ariaLabel, children, disabled, isDisabled, nested }: any) => (
      <select
        value={value ?? ''}
        onChange={onChange}
        aria-label={ariaLabel}
        disabled={Boolean(isDisabled ?? disabled)}
        className={nested ? '!border-0 !shadow-none' : '!border !border-[#e2e8f0]'}
      >
        {children}
      </select>
    ),
    UiCheckbox: ({ checked, onChange, 'aria-label': ariaLabel }: any) => (
      <input
        type="checkbox"
        aria-label={ariaLabel}
        checked={Boolean(checked)}
        onChange={(event) => onChange?.({ target: { checked: event.target.checked } })}
      />
    ),
  };
});

vi.mock('../../../../shared/api/queries/my-apis', () => ({
  useAccessibleApiRoutesQuery: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../../../shared/api/queries/api-endpoint-schema', () => ({
  useApiEndpointSchemaQuery: () => ({ data: null, isLoading: false, isError: false }),
  fetchEndpointResponseFields: vi.fn(),
  fetchEndpointFormFields: vi.fn(),
}));

import { createInitialDesignerState, designerReducer } from '../../../../domain/component-designer/state';
import { InspectorDataGridColumnsField } from '../InspectorDataGridColumnsField';
import { BindingGridColumnConfigStep } from '../BindingGridColumnConfigStep';
import { AutoFormWizardDialog } from '../AutoFormWizardDialog';
import {
  NESTED_LAYER_DIVIDER_CLASS,
  HEROUI_FIELD_NESTED_BORDER_CLASS,
  resolveHeroUiFieldBorderClass,
} from '../../../../shared/ui/surfaceClasses';

/** All-sides enclosure border token (`border`), excluding border-0 / border-none and directional-only. */
const countEnclosureBorderElements = (root: ParentNode): number => {
  let count = 0;
  root.querySelectorAll('*').forEach((el) => {
    const className = typeof el.className === 'string' ? el.className : '';
    const tokens = className.split(/\s+/).filter(Boolean);
    if (tokens.includes('border-0') || tokens.includes('border-none')) return;
    if (tokens.includes('border') || tokens.includes('!border')) {
      count += 1;
    }
  });
  if (root instanceof Element) {
    const className = typeof root.className === 'string' ? root.className : '';
    const tokens = className.split(/\s+/).filter(Boolean);
    if (
      !tokens.includes('border-0')
      && !tokens.includes('border-none')
      && (tokens.includes('border') || tokens.includes('!border'))
    ) {
      count += 1;
    }
  }
  return count;
};

const wrap = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

afterEach(() => {
  cleanup();
});

describe('Phase 13 — border-stacking nested layers', () => {
  it('exports NESTED_LAYER_DIVIDER_CLASS as ring-based (no layout border)', () => {
    expect(NESTED_LAYER_DIVIDER_CLASS).toContain('nested-layer-divider');
    expect(NESTED_LAYER_DIVIDER_CLASS).toContain('ring-1');
    expect(NESTED_LAYER_DIVIDER_CLASS).toContain('ring-inset');
    expect(NESTED_LAYER_DIVIDER_CLASS.split(/\s+/)).not.toContain('border');
  });

  it('resolveHeroUiFieldBorderClass supports nested borderless variant', () => {
    expect(resolveHeroUiFieldBorderClass(false, { nested: true })).toBe(HEROUI_FIELD_NESTED_BORDER_CLASS);
    expect(resolveHeroUiFieldBorderClass(true, { nested: true })).toContain('rose');
  });

  it('InspectorDataGridColumnsField column card has ≤1 enclosure border under section shell', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.app-table-grid',
      parentId: state.document.rootNodeId,
    });
    const root = state.document.nodes[state.document.rootNodeId];
    const childId = root.children[root.children.length - 1];
    state = designerReducer(state, { type: 'select-node', nodeId: childId });
    const node = state.document.nodes[childId];

    const { container } = wrap(
      <InspectorDataGridColumnsField
        node={node}
        document={state.document}
        bindingDefinitions={state.bindingDefinitions}
        dispatch={vi.fn()}
      />,
    );

    const sectionTitle = screen.getByText('Grid columns');
    const sectionShell = sectionTitle.closest('[class*="rounded-lg"]') as HTMLElement | null;
    expect(sectionShell).toBeTruthy();

    const columnCard = container.querySelector('.nested-layer-divider') as HTMLElement | null;
    expect(columnCard).toBeTruthy();
    expect(columnCard!.className).toContain('ring-1');
    expect(columnCard!.className.split(/\s+/)).not.toContain('border');

    const shellEnclosureOnly = sectionShell!.className.split(/\s+/).includes('border') ? 1 : 0;
    expect(shellEnclosureOnly).toBe(1);

    // Full subtree count, HeroUI field controls (input/select) included — the column card's
    // own `UiInput`/`UiSelect` fields (Header Label, Field Key, Column Type, Width, …) must
    // pass `nested` so they render borderless inside the ring-divided card. Before phase 13
    // wiring, every one of these fields kept its own `!border` — this asserts that gap is closed.
    expect(countEnclosureBorderElements(columnCard!)).toBe(0);
  });

  it('AutoForm-equivalent wizard field row has 0 enclosure borders on card chrome', () => {
    // Same nested chain as AutoFormWizardDialog Form fields step:
    // AppSurfaceBox (outer border) → field row (NESTED_LAYER_DIVIDER_CLASS) → HeroUI control.
    const { container } = wrap(
      <BindingGridColumnConfigStep
        rows={[
          {
            key: 'notes',
            label: 'Notes',
            enabled: true,
            sort: true,
            filter: false,
            isAction: false,
          },
        ]}
        onRowsChange={vi.fn()}
      />,
    );

    const sectionTitle = screen.getByText('Grid columns');
    const sectionShell = sectionTitle.closest('[class*="rounded-lg"]') as HTMLElement | null;
    expect(sectionShell).toBeTruthy();
    expect(sectionShell!.className.split(/\s+/)).toContain('border');

    const fieldRow = container.querySelector('.nested-layer-divider') as HTMLElement | null;
    expect(fieldRow).toBeTruthy();
    expect(fieldRow!.className).toContain('ring-1');
    expect(fieldRow!.className.split(/\s+/)).not.toContain('border');

    // Full subtree count, HeroUI field controls included — the row's own `UiInput` (Header
    // label) must pass `nested` so it renders borderless inside the ring-divided row.
    expect(countEnclosureBorderElements(fieldRow!)).toBe(0);
  });

  it('AutoFormWizardDialog mounts and its source uses NESTED_LAYER_DIVIDER_CLASS on field rows', () => {
    const source = readFileSync(
      resolve(__dirname, '../AutoFormWizardDialog.tsx'),
      'utf8',
    );
    expect(source).toContain('NESTED_LAYER_DIVIDER_CLASS');
    expect(source).toMatch(/rounded-lg \$\{NESTED_LAYER_DIVIDER_CLASS\} bg-white/);
    expect(source).not.toMatch(/rounded-lg border border-slate-200 bg-white px-2 py-2/);
    // The field row's own UiInput/UiSelect must suppress their enclosure border via `nested`
    // (layer 4 of the originally-documented 4-layer chain — audit doc §5.2 point 4).
    expect(source).toMatch(/<UiInput\s+size="sm"\s+nested/);
    expect(source).toMatch(/<UiSelect\s+size="sm"\s+nested/);

    wrap(
      <AutoFormWizardDialog open onClose={vi.fn()} onGenerate={vi.fn()} entryMode="catalog" />,
    );
    expect(screen.getByText('Form source')).toBeInTheDocument();
  });

  it('resolveHeroUiFieldBorderClass({ nested: true }) is actually wired to a live call site, not just defined', () => {
    // Guards against the nested variant existing in surfaceClasses.ts but never being passed
    // from any real UiInput/UiSelect/UiTextarea usage (would make HEROUI_FIELD_NESTED_BORDER_CLASS
    // dead code reachable only from unit tests of the resolver itself).
    const heroFieldControlsSource = readFileSync(
      resolve(__dirname, '../../../../shared/ui/HeroFieldControls.tsx'),
      'utf8',
    );
    expect(heroFieldControlsSource).toMatch(/resolveHeroUiFieldBorderClass\(isInvalid,\s*\{\s*nested\s*\}\)/);

    const columnFieldSource = readFileSync(
      resolve(__dirname, '../InspectorDataGridColumnsField.tsx'),
      'utf8',
    );
    expect(columnFieldSource).toMatch(/nested/);
  });
});
