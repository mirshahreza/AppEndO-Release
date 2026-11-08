import { describe, expect, it, vi } from 'vitest';
import { buildDataApiOpenApiOperation, isDataApiMetadata } from '../buildDataApiOpenApi';

describe('buildDataApiOpenApi', () => {
  it('detects data-api metadata', () => {
    expect(isDataApiMetadata({ origin: 'data-api' }, 'DATA_API')).toBe(true);
    expect(isDataApiMetadata({ origin: 'sandbox' }, 'SANDBOX_JS')).toBe(false);
  });

  it('builds list operation parameters for data-api routes', () => {
    const operation = buildDataApiOpenApiOperation(
      {
        id: 'fn_data_api_list',
        name: 'widgets-list-get',
        folder: 'data-api',
        method: 'GET',
        path: '/api/widgets',
        engine_type: 'DATA_API',
        metadata_json: JSON.stringify({
          origin: 'data-api',
          operation: { kind: 'list', query: { allowFilter: true, allowSort: true } },
          model: { objectName: 'widgets' },
          openapi: { tags: ['Widgets'], summary: 'List widgets' },
          derived: {
            docHints: {
              outputFields: ['id', 'name'],
            },
          },
        }),
      },
      {
        origin: 'data-api',
        operation: { kind: 'list', query: { allowFilter: true, allowSort: true } },
        model: { objectName: 'widgets' },
        openapi: { tags: ['Widgets'], summary: 'List widgets' },
        derived: {
          docHints: {
            outputFields: ['id', 'name'],
          },
        },
      },
    );

    const parameters = operation.parameters as Array<{ name: string }>;
    expect(parameters.some((item) => item.name === 'page')).toBe(true);
    expect(parameters.some((item) => item.name === 'sort')).toBe(true);
    expect(operation.summary).toBe('List widgets');
    expect(operation.tags).toEqual(['Widgets']);
  });

  it('uses actual path params instead of a hardcoded pk name', () => {
    const operation = buildDataApiOpenApiOperation(
      {
        id: 'fn_data_api_get',
        name: 'read-by-key',
        folder: 'data-api',
        method: 'GET',
        path: '/api/widgets/:id',
        engine_type: 'DATA_API',
        metadata_json: JSON.stringify({
          origin: 'data-api',
          operation: { kind: 'getOne' },
          model: { objectName: 'widgets' },
          openapi: { tags: ['Widgets'] },
        }),
      },
      {
        origin: 'data-api',
        operation: { kind: 'getOne' },
        model: { objectName: 'widgets' },
        openapi: { tags: ['Widgets'] },
      },
    );

    const parameters = operation.parameters as Array<{ name: string; in: string }>;
    expect(parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'id', in: 'path' }),
    ]));
    expect(parameters.some((item) => item.name === 'pk')).toBe(false);
  });

  it('documents history envelope headers on write operations', () => {
    const operation = buildDataApiOpenApiOperation(
      {
        id: 'fn_data_api_patch',
        name: 'widgets-patch',
        folder: 'data-api',
        method: 'PATCH',
        path: '/api/widgets/:id',
        engine_type: 'DATA_API',
        metadata_json: JSON.stringify({
          origin: 'data-api',
          operation: { kind: 'update', fields: { write: ['name'] } },
          model: { objectName: 'widgets' },
        }),
      },
      {
        origin: 'data-api',
        operation: { kind: 'update', fields: { write: ['name'] } },
        model: { objectName: 'widgets' },
      },
    );

    const parameters = operation.parameters as Array<{ name: string; in: string }>;
    expect(parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'X-AppEndO-Client', in: 'header' }),
      expect.objectContaining({ name: 'X-AppEndO-Change-Reason-Code', in: 'header' }),
      expect.objectContaining({ name: 'X-AppEndO-Change-Reason-Text', in: 'header' }),
    ]));
  });
});
