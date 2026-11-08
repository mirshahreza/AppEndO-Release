/**
 * @vitest-environment jsdom
 *
 * Bug found (gap analysis #1 + #23 / Phase 51): no `triggerWorkflow` Dynamic Action to start the
 * existing Workflow Engine, and no CSV/Excel → Data Source onboarding path (Generate menu was
 * API-only). Fixed in triggerWorkflowAction.ts / bindingDynamicActions* / bindingDiagnostics /
 * validation.ts / InspectorDynamicActionsField / csvExcelImport.ts /
 * import-tabular route + xlsxImport.ts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import {
  createDynamicActionsEventBindingDefinition,
  eventBindingKeyForEvent,
} from '../bindingEngine';
import {
  createDynamicAction,
  resolveDynamicActions,
} from '../bindingDynamicActionsEngine';
import { executeDynamicActions } from '../bindingDynamicActionsRuntime';
import {
  collectTriggerWorkflowDiagnostics,
} from '../bindingDiagnostics';
import { validateDesignerDocument } from '../validation';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderBindingComponentPreamble } from '../bindingCodegen';
import {
  buildTabularImportPreviewFromCsv,
  guessTabularColumnSchema,
  inferColumnType,
  parseCsvText,
} from '../csvExcelImport';
import {
  buildWorkflowStartEndpoint,
  isValidWorkflowDefinitionId,
  resolveWorkflowInputFromStore,
} from '../triggerWorkflowAction';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Phase 51.1 — triggerWorkflow helpers', () => {
  it('accepts only positive integer definition ids', () => {
    expect(isValidWorkflowDefinitionId('42')).toBe(true);
    expect(isValidWorkflowDefinitionId('0')).toBe(false);
    expect(isValidWorkflowDefinitionId('-1')).toBe(false);
    expect(isValidWorkflowDefinitionId('abc')).toBe(false);
    expect(isValidWorkflowDefinitionId('')).toBe(false);
  });

  it('builds the workflow-runtime start endpoint', () => {
    expect(buildWorkflowStartEndpoint('7')).toBe('/api/workflow-runtime/definitions/7/start');
  });

  it('resolves payload mapping from designerStore paths', () => {
    const input = resolveWorkflowInputFromStore(
      { selection: { id: 99 }, customer: { email: 'a@b.co' } },
      { orderId: 'selection.id', email: 'customer.email' },
    );
    expect(input).toEqual({ orderId: 99, email: 'a@b.co' });
  });
});

describe('Phase 51.1 — triggerWorkflow resolve + runtime + diagnostics', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('resolves a valid workflow action with endpoint + payload mapping', () => {
    const action = createDynamicAction('triggerWorkflow');
    action.workflowDefinitionId = '12';
    action.payloadMapping = { orderId: 'selection.id' };

    const definition = createDynamicActionsEventBindingDefinition('onClick', [action]);
    const resolved = resolveDynamicActions(definition, createInitialDesignerState().bindingDefinitions);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({
      type: 'triggerWorkflow',
      workflowDefinitionId: '12',
      endpoint: '/api/workflow-runtime/definitions/12/start',
      payloadMapping: { orderId: 'selection.id' },
    });
  });

  it('drops invalid workflow ids at resolve time (diagnostics catch them)', () => {
    const action = createDynamicAction('triggerWorkflow');
    action.workflowDefinitionId = 'not-a-number';
    const definition = createDynamicActionsEventBindingDefinition('onClick', [action]);
    expect(resolveDynamicActions(definition, createInitialDesignerState().bindingDefinitions)).toHaveLength(0);
  });

  it('POSTs to the workflow start endpoint with mapped input (mock fetch)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    const patchStore = vi.fn();
    await executeDynamicActions(
      [
        {
          id: 'da_wf',
          type: 'triggerWorkflow',
          workflowDefinitionId: '5',
          endpoint: '/api/workflow-runtime/definitions/5/start',
          payloadMapping: { orderId: 'selection.id' },
        },
        {
          id: 'da_after',
          type: 'setValue',
          targetNodeId: 'n1',
          storePath: 'ranAfterWorkflow',
          valueSource: 'static',
          staticValue: 'yes',
        },
      ],
      { designerStore: { selection: { id: 77 } }, patchStore },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/workflow-runtime/definitions/5/start',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ input: { orderId: 77 }, startType: 'MANUAL_API' }),
      }),
    );
    expect(patchStore).toHaveBeenCalledWith('ranAfterWorkflow', 'yes');
  });

  it('stops the success chain when workflow start fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ error: 'WorkflowDefinition not found.' }),
    } as unknown as Response);

    const patchStore = vi.fn();
    await executeDynamicActions(
      [
        {
          id: 'da_wf',
          type: 'triggerWorkflow',
          workflowDefinitionId: '5',
          endpoint: '/api/workflow-runtime/definitions/5/start',
        },
        {
          id: 'da_after',
          type: 'setValue',
          targetNodeId: 'n1',
          storePath: 'ranAfterWorkflow',
          valueSource: 'static',
          staticValue: 'yes',
        },
      ],
      { designerStore: {}, patchStore },
    );

    expect(patchStore).not.toHaveBeenCalled();
  });

  it('emits Diagnostics for missing / invalid workflowDefinitionId (never silent)', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.button-solid',
      parentId: state.document.rootNodeId,
    });
    const buttonId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;

    const missing = createDynamicAction('triggerWorkflow');
    missing.workflowDefinitionId = '';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [missing]),
    });

    const missingIssues = collectTriggerWorkflowDiagnostics(state.document);
    expect(missingIssues.some((issue) => issue.message.includes('no Workflow Definition ID'))).toBe(true);

    const docDiagnostics = validateDesignerDocument(state.document);
    expect(docDiagnostics.some((item) => item.code === 'binding-invalid' && item.nodeId === buttonId)).toBe(true);

    const invalid = createDynamicAction('triggerWorkflow');
    invalid.workflowDefinitionId = 'abc';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [invalid]),
    });
    const invalidIssues = collectTriggerWorkflowDiagnostics(state.document);
    expect(invalidIssues.some((issue) => issue.message.includes('invalid'))).toBe(true);
  });
});

describe('Phase 51.1 — triggerWorkflow codegen', () => {
  it('emits a real POST to the workflow endpoint gated on success', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.button-solid',
      parentId: state.document.rootNodeId,
    });
    const buttonId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;

    const workflowAction = createDynamicAction('triggerWorkflow');
    workflowAction.workflowDefinitionId = '9';
    workflowAction.payloadMapping = { orderId: 'selection.id' };
    const toastAction = createDynamicAction('showToast');
    toastAction.toastTitle = 'Started';

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [workflowAction, toastAction]),
    });

    const preamble = renderBindingComponentPreamble(state.document, state.bindingDefinitions).join('\n');
    expect(preamble).toContain('/api/workflow-runtime/definitions/9/start');
    expect(preamble).toContain("startType: 'MANUAL_API'");
    expect(preamble).toMatch(/let workflowOk_\w+ = true;/);
    expect(preamble).toMatch(/if \(workflowOk_\w+\) \{\s*\n\s*toast\("Started"/);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('/api/workflow-runtime/definitions/9/start');
  });
});

describe('Phase 51.2 — CSV schema guess', () => {
  const SAMPLE_CSV = [
    'id,name,active,joined',
    '1,Ada,true,2024-01-15',
    '2,Grace,false,2024-02-01',
    '3,Alan,true,2024-03-10',
  ].join('\n');

  it('parses CSV headers/rows and guesses column types matching file content', () => {
    const rows = parseCsvText(SAMPLE_CSV);
    expect(rows).toEqual([
      { id: '1', name: 'Ada', active: 'true', joined: '2024-01-15' },
      { id: '2', name: 'Grace', active: 'false', joined: '2024-02-01' },
      { id: '3', name: 'Alan', active: 'true', joined: '2024-03-10' },
    ]);

    const schema = guessTabularColumnSchema(rows);
    expect(schema.map((column) => ({ name: column.name, inferredType: column.inferredType }))).toEqual([
      { name: 'id', inferredType: 'number' },
      { name: 'name', inferredType: 'string' },
      { name: 'active', inferredType: 'boolean' },
      { name: 'joined', inferredType: 'date' },
    ]);

    const preview = buildTabularImportPreviewFromCsv(SAMPLE_CSV, 'people.csv');
    expect(preview.suggestedName).toBe('people');
    expect(preview.columns).toHaveLength(4);
    expect(preview.rows).toHaveLength(3);
  });

  it('infers types for homogeneous samples', () => {
    expect(inferColumnType(['1', '2', '3.5'])).toBe('number');
    expect(inferColumnType(['yes', 'NO', 'true'])).toBe('boolean');
    expect(inferColumnType(['hello', 'world'])).toBe('string');
  });
});
