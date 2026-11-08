import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/data-api/edgeApiStore', () => ({
  getEdgeApiDefinitionByKey: vi.fn((key: string) => (
    key === 'cms-contents'
      ? { id: 'ea_test', key: 'cms-contents', edgeModelId: 'em_test', status: 'published', operations: [] }
      : null
  )),
}));

vi.mock('../../../services/data-api/edgeModelStore', () => ({
  getEdgeModelById: vi.fn((id: string) => (
    id === 'em_test'
      ? {
          id: 'em_test',
          dataSourceId: 'ds_test',
          primaryKey: 'id',
          columns: [
            { name: 'id', field: 'id', dataType: 'bigint', sequelizeType: 'INTEGER', allowNull: false, isPrimaryKey: true, isForeignKey: false },
            { name: 'title', field: 'title', dataType: 'text', sequelizeType: 'STRING', allowNull: false, isPrimaryKey: false, isForeignKey: false },
            { name: 'body', field: 'body', dataType: 'text', sequelizeType: 'TEXT', allowNull: true, isPrimaryKey: false, isForeignKey: false },
          ],
        }
      : null
  )),
}));

import { listWorkflowRecordFieldsForEdgeApiKey } from '../workflowRecordFieldsLookup';

describe('listWorkflowRecordFieldsForEdgeApiKey', () => {
  it('returns writable columns, excluding the primary key', () => {
    const fields = listWorkflowRecordFieldsForEdgeApiKey('cms-contents');
    expect(fields).toEqual([
      { field: 'title', name: 'title', dataType: 'text', allowNull: false },
      { field: 'body', name: 'body', dataType: 'text', allowNull: true },
    ]);
  });

  it('returns null for an unknown Data API key', () => {
    expect(listWorkflowRecordFieldsForEdgeApiKey('does-not-exist')).toBeNull();
  });

  it('trims whitespace before looking up the key', () => {
    const fields = listWorkflowRecordFieldsForEdgeApiKey('  cms-contents  ');
    expect(fields).not.toBeNull();
    expect(fields).toHaveLength(2);
  });
});
