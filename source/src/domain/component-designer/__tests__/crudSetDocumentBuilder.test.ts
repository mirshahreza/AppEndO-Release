import { describe, expect, it } from 'vitest';
import { GRID_LIST_RESOURCE_BINDING_KEY } from '../bindingGridEngine';
import { generateDesignerTsx } from '../codegen';
import { buildCrudSetDocument, findCrudSetNodeId } from '../crudSetDocumentBuilder';
import { CRUD_SET_PALETTE_ITEM_ID, parseCrudSetSpec, type CrudSetSpec } from '../crudSetSpec';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../propRegistry';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';

const spec: CrudSetSpec = {
  name: 'users-admin',
  listApi: { endpointId: '/api/users' },
  listBody: 'grid',
  pagination: true,
  columns: [
    { field: 'id', label: 'Id' },
    { field: 'email', label: 'Email' },
  ],
  createApis: [{
    id: 'add-user',
    label: 'Add user',
    endpointId: '/api/users',
    acceptedFields: ['email'],
  }],
  patches: [{
    id: 'edit',
    label: 'Edit record',
    endpointId: '/api/users/:id',
    kind: 'content',
    acceptedFields: ['email'],
    interaction: 'form',
  }],
  readOneApi: { endpointId: '/api/users/:id' },
  deleteApi: { endpointId: '/api/users/:id' },
  export: { enabled: true, formats: ['xlsx', 'csv'], defaultFormat: 'xlsx', defaultIncludeHeader: true },
};

describe('buildCrudSetDocument', () => {
  it('places exactly one CrudSet node with the spec as props', () => {
    const built = buildCrudSetDocument(spec);
    const crudSetIds = Object.values(built.document.nodes)
      .filter((node) => node.props[DESIGNER_PALETTE_ITEM_ID_PROP] === CRUD_SET_PALETTE_ITEM_ID)
      .map((node) => node.id);
    expect(crudSetIds).toHaveLength(1);

    const nodeId = findCrudSetNodeId(built.document);
    expect(nodeId).toBe(crudSetIds[0]);
    const node = built.document.nodes[nodeId ?? ''];
    expect(node).toBeDefined();
    const parsed = parseCrudSetSpec(node.props.spec);
    expect(parsed?.listApi.endpointId).toBe('/api/users');
    expect(parsed?.columns.map((column) => column.field)).toEqual(['id', 'email']);
    expect(parsed?.createApis).toHaveLength(1);
    expect(node.binding[GRID_LIST_RESOURCE_BINDING_KEY]?.dataSourceRef).toBeTruthy();
    expect(built.preferredSelectedNodeId).toBe(nodeId);
  });

  it('does not insert a parallel toolbar or grid palette node', () => {
    const built = buildCrudSetDocument(spec);
    const paletteIds = Object.values(built.document.nodes)
      .map((node) => node.props[DESIGNER_PALETTE_ITEM_ID_PROP])
      .filter((value): value is string => typeof value === 'string');
    expect(paletteIds).not.toContain('heroui.app-table-grid');
    expect(paletteIds).not.toContain('heroui.toolbar');
    expect(paletteIds).not.toContain('heroui.modal');
    expect(paletteIds.filter((id) => id === CRUD_SET_PALETTE_ITEM_ID)).toHaveLength(1);
  });

  it('exports TSX that renders one CrudSet', () => {
    const built = buildCrudSetDocument(spec);
    const tsx = generateDesignerTsx(built.document, built.bindingDefinitions);
    expect(tsx).toContain('<CrudSet');
    expect(tsx).toContain('/api/users');
    assertValidTsxSyntax('crud-set-document', tsx);
  });
});
