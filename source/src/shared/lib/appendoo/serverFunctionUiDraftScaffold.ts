import { listManagedFunctionsFromStore } from '../../../core/functions/FunctionFileStore';
import { createInitialDesignerState, designerReducer } from '../../../domain/component-designer/state';
import type { DesignerBindingDefinitions, DesignerDocument } from '../../../domain/component-designer/types';
import {
  REGION_DATA_SOURCE_BINDING_KEY,
  createRegionColumnBindingDefinition,
  createRegionDataSourceBindingDefinition,
  createRegionSubmitEventBindingDefinition,
} from '../../../domain/component-designer/bindingRegionEngine';
import { eventBindingKeyForEvent, propertyBindingKeyForProp } from '../../../domain/component-designer/bindingEngine';
import type { ChangeNode } from '../../api/contracts/appendoo/changeGraph.types';

export type ServerFunctionUiDraftRecord = {
  schema: 'component-designer-draft';
  id: string;
  name: string;
  folder: string;
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  boundFunctionId: string;
};

export const resolveServerFunctionApiPath = (functionId: string): string => {
  const trimmed = functionId.trim();
  const dot = trimmed.indexOf('.');
  if (dot > 0) {
    const folder = trimmed.slice(0, dot);
    const name = trimmed.slice(dot + 1);
    if (folder && name) {
      return `/api/${folder}/${name}`;
    }
  }
  return `/api/${trimmed}`;
};

export const extractBoundFunctionIdFromChangeNode = (node: ChangeNode): string | null => {
  const evidenceIds = node.inputs?.evidenceIds ?? [];
  for (const evidenceId of evidenceIds) {
    if (typeof evidenceId === 'string' && evidenceId.startsWith('function:')) {
      const functionId = evidenceId.slice('function:'.length).trim();
      if (functionId) return functionId;
    }
  }
  return null;
};

const slugifyDraftId = (functionId: string): string => (
  functionId.trim().toLowerCase().replace(/\./g, '-').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
);

export const resolveServerFunctionUiFolder = (functionId: string): string => {
  const trimmed = functionId.trim();
  const dot = trimmed.indexOf('.');
  if (dot > 0) {
    const folder = trimmed.slice(0, dot).trim();
    if (folder) return folder;
  }
  return 'general';
};

export const resolveServerFunctionUiDisplayName = (
  functionId: string,
  title?: string,
): string => {
  if (title?.trim()) return title.trim();
  const shortName = functionId.trim().split('.').pop() || functionId.trim();
  return `UI for ${shortName}`;
};

/** Minimal calculator-style UI for a managed POST server function (a + b). */
export const buildServerFunctionUiDesignerDraft = (
  functionId: string,
  title?: string,
): ServerFunctionUiDraftRecord => {
  const trimmedFunctionId = functionId.trim();
  const folder = resolveServerFunctionUiFolder(trimmedFunctionId);
  const shortName = trimmedFunctionId.split('.').pop() || trimmedFunctionId;
  const displayName = resolveServerFunctionUiDisplayName(trimmedFunctionId, title);
  const draftId = `${slugifyDraftId(trimmedFunctionId)}-calculator`;
  const dataSourceId = slugifyDraftId(trimmedFunctionId);
  const endpoint = resolveServerFunctionApiPath(trimmedFunctionId);

  let state = createInitialDesignerState(displayName);

  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'layout.flex-column',
    parentId: state.document.rootNodeId,
  });
  const columnId = state.document.nodes[state.document.rootNodeId].children[0]!;

  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'html.text',
    parentId: columnId,
  });
  const headingId = state.document.nodes[columnId].children[0]!;
  state = designerReducer(state, {
    type: 'set-node-prop',
    nodeId: headingId,
    key: 'text',
    value: displayName,
  });

  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'html.form',
    parentId: columnId,
  });
  const formId = state.document.nodes[columnId].children[1]!;

  state = designerReducer(state, {
    type: 'set-data-source',
    dataSourceId,
    dataSource: {
      id: dataSourceId,
      name: shortName,
      endpoint,
      fields: ['a', 'b', 'sum'],
      kind: 'collection',
      operations: {
        create: { method: 'POST', endpoint },
      },
    },
  });

  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: formId,
    bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
    definition: createRegionDataSourceBindingDefinition(dataSourceId),
  });

  const insertNumberField = (field: 'a' | 'b', label: string) => {
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.number-input',
      parentId: formId,
    });
    const inputId = state.document.nodes[formId].children[state.document.nodes[formId].children.length - 1]!;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: inputId,
      key: 'label',
      value: label,
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: inputId,
      bindingKey: propertyBindingKeyForProp('value'),
      definition: createRegionColumnBindingDefinition('value', field),
    });
  };

  insertNumberField('a', 'First number');
  insertNumberField('b', 'Second number');

  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'heroui.button-solid',
    parentId: formId,
  });
  const buttonId = state.document.nodes[formId].children[state.document.nodes[formId].children.length - 1]!;
  state = designerReducer(state, {
    type: 'set-node-prop',
    nodeId: buttonId,
    key: 'text',
    value: 'Calculate',
  });
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: buttonId,
    bindingKey: eventBindingKeyForEvent('onClick'),
    definition: createRegionSubmitEventBindingDefinition('onClick'),
  });

  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'html.text',
    parentId: columnId,
  });
  const hintId = state.document.nodes[columnId].children[2]!;
  state = designerReducer(state, {
    type: 'set-node-prop',
    nodeId: hintId,
    key: 'text',
    value: 'Press Calculate to call the server function and view the response.',
  });

  const document: DesignerDocument = {
    ...state.document,
    id: draftId,
    name: displayName,
  };

  return {
    schema: 'component-designer-draft',
    id: draftId,
    name: displayName,
    folder,
    document,
    bindingDefinitions: state.bindingDefinitions,
    boundFunctionId: trimmedFunctionId,
  };
};

export const tryBuildServerFunctionUiDraftFromChangeNode = (
  node: ChangeNode,
): ServerFunctionUiDraftRecord | null => {
  if (node.operationType !== 'CREATE_PAGE' && node.operationType !== 'MODIFY_PAGE') {
    return null;
  }

  const functionId = extractBoundFunctionIdFromChangeNode(node);
  if (!functionId) {
    return null;
  }

  return buildServerFunctionUiDesignerDraft(functionId, node.expectedOutputs[0]);
};

export const inferFunctionIdFromDraftSlug = (draftSlug: string): string | undefined => {
  const normalized = draftSlug.trim().replace(/-calculator$/i, '').replace(/-ui$/i, '');
  const dash = normalized.indexOf('-');
  if (dash <= 0) {
    return undefined;
  }
  const folder = normalized.slice(0, dash);
  const name = normalized.slice(dash + 1);
  if (!folder || !name) {
    return undefined;
  }
  return `${folder}.${name}`;
};

export const resolveKnownFunctionIdFromDraftSlug = (draftSlug: string): string | undefined => {
  const inferred = inferFunctionIdFromDraftSlug(draftSlug);
  if (!inferred) {
    return undefined;
  }

  try {
    const functions = listManagedFunctionsFromStore();
    if (functions.some((item) => item.id === inferred)) {
      return inferred;
    }
  } catch {
    // Best-effort resolution.
  }

  return undefined;
};

export const inferDraftSlugFromWorkspacePath = (workspacePath: string): string | undefined => {
  const match = workspacePath.match(/\/workspace\/designer\/drafts\/([^/]+)\/draft\.json$/i);
  return match?.[1]?.trim() || undefined;
};

type WorkspaceDraftJson = {
  boundFunctionId?: string;
  draftId?: string;
  id?: string;
  title?: string;
  name?: string;
};

/** Resolve a managed function id from workspace draft JSON and/or its storage path. */
export const extractFunctionIdFromWorkspaceDraftJson = (
  content: string,
  options?: {
    workspacePath?: string;
    fallbackTargetId?: string;
  },
): string | null => {
  let parsed: WorkspaceDraftJson = {};
  try {
    parsed = JSON.parse(content) as WorkspaceDraftJson;
  } catch {
    parsed = {};
  }

  if (parsed.boundFunctionId?.trim()) {
    return parsed.boundFunctionId.trim();
  }

  const slugCandidates = [
    parsed.id,
    parsed.draftId,
    options?.fallbackTargetId,
    options?.workspacePath ? inferDraftSlugFromWorkspacePath(options.workspacePath) : undefined,
  ].filter((value): value is string => Boolean(value?.trim()));

  for (const slug of slugCandidates) {
    const known = resolveKnownFunctionIdFromDraftSlug(slug);
    if (known) {
      return known;
    }
  }

  return null;
};
