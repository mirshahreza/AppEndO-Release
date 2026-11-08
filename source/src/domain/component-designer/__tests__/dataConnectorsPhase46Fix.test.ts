/**
 * Bug found (gap analysis #31 / Phase 46): sanitizeDataSourceDefinition dropped pollingIntervalMs
 * and had no connectorType/connectorRef — draft reload wiped polling and could not persist external
 * connector bindings. Fixed in bindingLovRegistry.ts + dataConnectorBinding.ts.
 */

import { describe, expect, it } from 'vitest';
import { sanitizeDataSourceDefinition } from '../bindingLovRegistry';
import { buildDataSourceFromConnector } from '../dataConnectorBinding';
import {
  buildDesignerConnectorQueryEndpoint,
  resolveDesignerConnectorType,
} from '../dataConnectorTypes';

describe('Phase 46 - DataSource connector fields + sanitize', () => {
  it('defaults missing connectorType to internal-api (backward compatible)', () => {
    expect(resolveDesignerConnectorType(undefined)).toBe('internal-api');
    expect(resolveDesignerConnectorType(null)).toBe('internal-api');
    expect(resolveDesignerConnectorType('rest-external')).toBe('rest-external');
  });

  it('preserves connectorType, connectorRef, graphql, staticFile, and pollingIntervalMs on sanitize', () => {
    const sanitized = sanitizeDataSourceDefinition({
      id: 'ds_ext',
      name: 'External customers',
      endpoint: '/api/component-designer/connectors/c1/query?path=%2Fv1%2Fcustomers',
      fields: ['id', 'name'],
      primaryKey: 'id',
      pollingIntervalMs: 5000,
      connectorType: 'rest-external',
      connectorRef: 'c1',
      graphql: { query: 'query { x }', variables: { a: 'store.a' } },
      staticFile: { path: 'rows.json', format: 'json' },
      responseMapping: { arrayPath: 'data', totalPath: 'total' },
    }, 'fallback');

    expect(sanitized).not.toBeNull();
    expect(sanitized?.pollingIntervalMs).toBe(5000);
    expect(sanitized?.connectorType).toBe('rest-external');
    expect(sanitized?.connectorRef).toBe('c1');
    expect(sanitized?.graphql).toEqual({ query: 'query { x }', variables: { a: 'store.a' } });
    expect(sanitized?.staticFile).toEqual({ path: 'rows.json', format: 'json' });
    expect(sanitized?.responseMapping).toEqual({ arrayPath: 'data', totalPath: 'total' });
  });

  it('omitting connectorType on sanitize leaves it undefined (≡ internal-api at runtime)', () => {
    const sanitized = sanitizeDataSourceDefinition({
      id: 'legacy',
      name: 'Legacy users',
      endpoint: '/api/users',
      fields: ['id'],
    }, 'legacy');

    expect(sanitized?.connectorType).toBeUndefined();
    expect(resolveDesignerConnectorType(sanitized?.connectorType)).toBe('internal-api');
  });

  it('buildDataSourceFromConnector points endpoint at the secure proxy with normalized mapping', () => {
    const dataSource = buildDataSourceFromConnector(
      { id: 'stripe', name: 'Stripe', connectorType: 'rest-external' },
      { path: '/v1/customers', fields: ['id', 'email'] },
    );

    expect(dataSource.connectorType).toBe('rest-external');
    expect(dataSource.connectorRef).toBe('stripe');
    expect(dataSource.endpoint).toBe(
      buildDesignerConnectorQueryEndpoint('stripe', { path: '/v1/customers' }),
    );
    expect(dataSource.responseMapping).toEqual({ arrayPath: 'data', totalPath: 'total' });
    expect(dataSource.fields).toEqual(['id', 'email']);
  });
});
