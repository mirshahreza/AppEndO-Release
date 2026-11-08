import { describe, expect, it } from 'vitest';
import type { EdgeApiDefinition } from '../../../../shared/api/contracts/data-api';
import {
  buildConfigureDataApiOperation,
  hydrateConfigureDataApiFormFromOperation,
  mergeOperationIntoDefinition,
} from '../configureDataApi';
import { sampleModel } from './configureDataApi.test.shared';

const definition: EdgeApiDefinition = {
  id: 'def_users',
  edgeModelId: sampleModel.id,
  key: 'list',
  label: 'List',
  basePath: '/api/users/list',
  operations: [{
    id: 'op_list',
    method: 'GET',
    kind: 'list',
    pathPattern: '/api/users/list',
    enabled: true,
    fields: { read: ['id', 'email'] },
    enrichments: [{
      id: 'en1',
      sourceField: 'gender_code',
      kind: 'base_info_title',
      joinTableSource: 'base_info',
      rootId: '100.1',
      outputField: 'gender_code_Title',
      langSource: 'query:lang',
    }],
    includeConfigs: [{ as: 'orders', enabled: true, limit: 3, separate: true }],
    computedFields: [{
      id: 'c1',
      outputField: 'orderCount',
      kind: 'scalar_subquery',
      expression: '(SELECT COUNT(*) FROM orders)',
    }],
    query: {
      allowFilter: true,
      allowSort: true,
      maxPageSize: 50,
      defaultPageSize: 10,
      allowLangParam: true,
      includes: ['orders'],
    },
  }],
  accessControl: {
    accessMode: 'authenticated',
    allowRoles: [],
    allowUsers: [],
    denyRoles: [],
    denyUsers: [],
  },
  openapi: { tags: ['Users'] },
  publishedAt: '2026-01-01T00:00:00.000Z',
  version: 1,
  runtime: { useGlobalConfig: true },
};

describe('configureDataApi hydration', () => {
  it('hydrates advanced operation settings into form state', () => {
    const operation = definition.operations[0];
    const form = hydrateConfigureDataApiFormFromOperation(
      definition,
      operation,
      'users',
      'TABLE',
      sampleModel,
      sampleModel.columns.map((column) => ({
        name: column.name,
        dataType: column.dataType,
        suggestedFieldType: 'string',
        nullable: column.allowNull,
        isPrimaryKey: column.isPrimaryKey,
      })),
      'id',
    );

    expect(form.operationId).toBe('op_list');
    expect(form.enrichments).toHaveLength(1);
    expect(form.includeConfigs[0]?.limit).toBe(3);
    expect(form.computedFields[0]?.outputField).toBe('orderCount');
    expect(form.queryOptions.defaultPageSize).toBe(10);
    // SEA-4.1: accessControl/runtime must carry over from the definition, not silently
    // reset to defaults, since ConfigureDataApiDialog now edits them via the Access/
    // Runtime & Cache/Hooks tabs.
    expect(form.accessControl).toEqual(definition.accessControl);
    expect(form.runtime).toEqual(definition.runtime);
    expect(form.changeReason.reasonAsk).toBe('off');
  });

  it('round-trips advanced settings through buildConfigureDataApiOperation', () => {
    const operation = definition.operations[0];
    const form = hydrateConfigureDataApiFormFromOperation(
      definition,
      operation,
      'users',
      'TABLE',
      sampleModel,
      sampleModel.columns.map((column) => ({
        name: column.name,
        dataType: column.dataType,
        suggestedFieldType: 'string',
        nullable: column.allowNull,
        isPrimaryKey: column.isPrimaryKey,
      })),
      'id',
    );

    const rebuilt = buildConfigureDataApiOperation('users', 'TABLE', form, 'id', sampleModel);
    expect(rebuilt.enrichments?.[0]?.outputField).toBe('gender_code_Title');
    expect(rebuilt.includeConfigs?.[0]?.separate).toBe(true);
    expect(rebuilt.computedFields?.[0]?.outputField).toBe('orderCount');
    expect(rebuilt.query?.includes).toEqual(['orders']);
  });

  it('merges operations by id when reconfiguring', () => {
    const updated = mergeOperationIntoDefinition(definition.operations, {
      ...definition.operations[0],
      enabled: false,
    });
    expect(updated[0]?.enabled).toBe(false);
  });
});
