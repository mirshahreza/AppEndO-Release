/**
 * Builds a Client Components document that contains exactly one `CrudSet`.
 * The wizard only writes CrudSetSpec onto that node — no extra chrome tree.
 */

import {
  createGridListResourceBindingDefinition,
  GRID_LIST_RESOURCE_BINDING_KEY,
} from './bindingGridEngine';
import {
  buildDataSourceFromEndpoint,
  type DataSourceDefinition,
} from './bindingResourceModel';
import { cloneTemplateSeedsToNodes } from './builtInTemplateClone';
import {
  CRUD_SET_PALETTE_ITEM_ID,
  serializeCrudSetSpec,
  type CrudSetSpec,
} from './crudSetSpec';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import { createInitialDesignerState } from './state';
import type {
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerNode,
  TemplateNodeSeed,
} from './types';

export type CrudSetBuildResult = {
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  preferredSelectedNodeId: string | null;
};

const mergeDataSourceIntoBindings = (
  bindingDefinitions: DesignerBindingDefinitions,
  dataSource: DataSourceDefinition,
): DesignerBindingDefinitions => ({
  ...bindingDefinitions,
  dataSources: {
    ...bindingDefinitions.dataSources,
    [dataSource.id]: dataSource,
  },
});

const resolveNodePaletteItemId = (node: DesignerNode): string | undefined => {
  const stored = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  return typeof stored === 'string' && stored.trim().length > 0 ? stored.trim() : undefined;
};

export const findCrudSetNodeId = (
  document: DesignerDocument,
  candidateIds: readonly string[] = Object.keys(document.nodes),
): string | null => {
  const queue = [...candidateIds];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) {
      continue;
    }
    const node = document.nodes[id];
    if (!node) {
      continue;
    }
    if (resolveNodePaletteItemId(node) === CRUD_SET_PALETTE_ITEM_ID) {
      return node.id;
    }
    queue.push(...node.children);
  }
  return null;
};

export const buildCrudSetDataSource = (spec: CrudSetSpec): DataSourceDefinition => {
  const fields = spec.columns.map((column) => column.field);
  const dataSource = buildDataSourceFromEndpoint(spec.listApi.endpointId, {
    fields: fields.length > 0 ? fields : ['id'],
    primaryKey: 'id',
    method: 'GET',
  });

  const operations = { ...dataSource.operations };
  if (spec.readOneApi?.endpointId.trim()) {
    operations.detail = { method: 'GET', endpoint: spec.readOneApi.endpointId.trim() };
  }
  if (spec.createApis[0]?.endpointId.trim()) {
    operations.create = { method: 'POST', endpoint: spec.createApis[0].endpointId.trim() };
  }
  const contentPatch = spec.patches.find((patch) => patch.kind === 'content');
  if (contentPatch?.endpointId.trim()) {
    operations.update = { method: 'PATCH', endpoint: contentPatch.endpointId.trim() };
  }
  if (spec.deleteApi?.endpointId.trim()) {
    operations.delete = { method: 'DELETE', endpoint: spec.deleteApi.endpointId.trim() };
  }

  const custom: NonNullable<DataSourceDefinition['operations']['custom']> = {
    ...(operations.custom ?? {}),
  };
  for (const create of spec.createApis.slice(1)) {
    if (create.endpointId.trim()) {
      custom[create.id] = { method: 'POST', endpoint: create.endpointId.trim() };
    }
  }
  for (const patch of spec.patches) {
    if (patch.kind === 'content') {
      continue;
    }
    if (patch.endpointId.trim()) {
      custom[patch.id] = { method: 'PATCH', endpoint: patch.endpointId.trim() };
    }
  }
  operations.custom = Object.keys(custom).length > 0 ? custom : operations.custom;

  return {
    ...dataSource,
    operations,
  };
};

export const buildCrudSetSeeds = (spec: CrudSetSpec, dataSourceId: string): TemplateNodeSeed[] => {
  const listBinding = createGridListResourceBindingDefinition(dataSourceId);
  return [{
    type: 'container',
    paletteItemId: CRUD_SET_PALETTE_ITEM_ID,
    props: {
      className: 'flex h-full min-h-0 w-full flex-1 flex-col',
      spec: serializeCrudSetSpec(spec),
    },
    binding: {
      [GRID_LIST_RESOURCE_BINDING_KEY]: listBinding,
    },
  }];
};

/** Fresh document whose only designed widget is one `CrudSet`. */
export const buildCrudSetDocument = (spec: CrudSetSpec): CrudSetBuildResult => {
  const base = createInitialDesignerState();
  const rootId = base.document.rootNodeId;
  const dataSource = buildCrudSetDataSource(spec);
  const seeds = buildCrudSetSeeds(spec, dataSource.id);
  const { nodes, rootNodeIds } = cloneTemplateSeedsToNodes(seeds, rootId, 0);
  const now = new Date().toISOString();

  const document: DesignerDocument = {
    ...base.document,
    nodes: {
      ...base.document.nodes,
      [rootId]: { ...base.document.nodes[rootId], children: rootNodeIds },
      ...nodes,
    },
    metadata: { ...base.document.metadata, updatedAt: now },
  };

  return {
    document,
    bindingDefinitions: mergeDataSourceIntoBindings(base.bindingDefinitions, dataSource),
    preferredSelectedNodeId: findCrudSetNodeId(document, rootNodeIds),
  };
};
