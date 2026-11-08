import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { buildVizBindingWizardActions } from '../bindingVizEngine';
import { renderBindingApiRuntimeHelpers } from '../bindingApiCodegen';
import type { DesignerState } from '../types';

/**
 * Bug found (parity audit item 9): the exported/published bundle's inlined runtime helper
 * `transformApiRowsToTimelineEvents` (bindingApiCodegen.ts, injected verbatim as source text into
 * every generated package that uses timeline/gantt) diverges from the real function of the same
 * name in `visualizationDataTransform.ts` (used by the live canvas/interactive Preview) — the
 * mapping type never declared `progressField`, and the returned event object never computed
 * `progress` from it. A published Gantt's internal progress-fill bar was always empty/full
 * regardless of the "Progress Field" configured in the Connect-to-API wizard.
 */

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

describe('viz.gantt progressField export fix (parity audit item 9)', () => {
  it('exports a helper that declares and reads progressField, and the generated mapping literal includes it', () => {
    let state = insert(createInitialDesignerState(), 'viz.gantt');
    const nodeId = lastChild(state);
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'projects',
      dataSource: {
        id: 'projects',
        name: 'Projects',
        endpoint: '/api/projects',
        fields: ['id', 'title', 'start', 'end', 'completion'],
        primaryKey: 'id',
        operations: { list: { method: 'GET', endpoint: '/api/projects' } },
      },
    });
    const vizNode = state.document.nodes[nodeId]!;
    for (const action of buildVizBindingWizardActions(vizNode, state.bindingDefinitions.dataSources.projects!, {
      fieldMapping: {
        kind: 'gantt',
        idField: 'id',
        titleField: 'title',
        startField: 'start',
        endField: 'end',
        progressField: 'completion',
      },
    })) {
      state = designerReducer(state, action);
    }

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('bound gantt with progressField', tsx);

    // The generated mapping literal carries the configured field.
    expect(tsx).toMatch(/"progressField":"completion"/);
    // The inlined helper's type signature and body must actually declare and use it.
    expect(tsx).toMatch(/mapping:\s*\{[^}]*progressField\?:\s*string[^}]*\}/);
    expect(tsx).toContain('mapping.progressField ? readVizNumberField(row, mapping.progressField) : undefined');
  });

  it('the inlined runtime helper actually computes progress from real rows (behavioral, not just textual)', () => {
    const jsSource = transformSync(renderBindingApiRuntimeHelpers().join('\n'), { loader: 'ts' }).code;
    // eslint-disable-next-line no-new-func
    const module = new Function(`${jsSource}\nreturn { transformApiRowsToTimelineEvents };`)();
    const rows = [
      { id: 'a', title: 'Kickoff', start: '2026-01-01', end: '2026-01-05', completion: 40 },
      { id: 'b', title: 'Build', start: '2026-01-05', end: '2026-01-20', completion: '75' },
      { id: 'c', title: 'No progress row', start: '2026-01-20', end: '2026-01-25' },
    ];
    const events = module.transformApiRowsToTimelineEvents(rows, {
      kind: 'gantt',
      idField: 'id',
      titleField: 'title',
      startField: 'start',
      endField: 'end',
      progressField: 'completion',
    });

    expect(events[0].progress).toBe(40);
    expect(events[1].progress).toBe(75);
    expect(events[2].progress).toBeUndefined();
  });

  it('still exports and runs correctly when no progressField is configured', () => {
    let state = insert(createInitialDesignerState(), 'viz.gantt');
    const nodeId = lastChild(state);
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'projects',
      dataSource: {
        id: 'projects',
        name: 'Projects',
        endpoint: '/api/projects',
        fields: ['id', 'title', 'start', 'end'],
        primaryKey: 'id',
        operations: { list: { method: 'GET', endpoint: '/api/projects' } },
      },
    });
    const vizNode = state.document.nodes[nodeId]!;
    for (const action of buildVizBindingWizardActions(vizNode, state.bindingDefinitions.dataSources.projects!)) {
      state = designerReducer(state, action);
    }

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('bound gantt without progressField', tsx);
    expect(tsx).not.toMatch(/"progressField":/);
  });
});
