/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit item 108 / Phase 19): Auto Table Builder must produce a grid that
 * actually hydrates list rows in Preview (not only a dead columns JSON).
 * Fixed in autoTableTemplateBuilder.ts: gridListResource + columns wired from day one.
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CultureProvider } from '../../../core/culture/CultureContext';
import { resolveEndpointResponseFormFieldsFromOpenApi } from '../apiFieldSchema';
import {
  buildAutoTableColumnConfigsFromFields,
  buildAutoTableDocument,
} from '../autoTableTemplateBuilder';
import { buildDataSourceFromEndpoint } from '../bindingResourceModel';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { resolveGridListDataVarName } from '../bindingGridEngine';
import { APP_TABLE_GRID_PALETTE_ITEM_ID } from '../designerDataGridColumns';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../propRegistry';

const LIST_SPEC = {
  openapi: '3.1.2',
  paths: {
    '/api/orders': {
      get: {
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          title: { type: 'string' },
                          status: { type: 'string', enum: ['draft', 'paid'] },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const renderWithCulture = (ui: React.ReactElement) => render(
  <CultureProvider cultureId="us">{ui}</CultureProvider>,
);

describe('auto-table generated App Table Grid runtime', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders hydrated API rows for a document produced by buildAutoTableDocument', () => {
    const fields = resolveEndpointResponseFormFieldsFromOpenApi(LIST_SPEC, 'GET');
    const result = buildAutoTableDocument({
      title: 'Orders',
      includeTitle: true,
      dataSource: buildDataSourceFromEndpoint('/api/orders', {
        fields: fields.map((field) => field.name),
        primaryKey: 'id',
        method: 'GET',
      }),
      columns: buildAutoTableColumnConfigsFromFields(fields),
      toolbar: { search: true, refresh: true, createButton: false },
      rowActions: [],
    });

    const gridNode = Object.values(result.document.nodes).find(
      (node) => node.props[DESIGNER_PALETTE_ITEM_ID_PROP] === APP_TABLE_GRID_PALETTE_ITEM_ID,
    );
    expect(gridNode).toBeDefined();
    const gridDataVar = resolveGridListDataVarName(gridNode!.id);

    renderWithCulture(
      <>
        {renderDesignerDocumentPreview(result.document, {
          bindingDefinitions: result.bindingDefinitions,
          hydrationData: {
            [gridDataVar]: [
              { id: 'o-1', title: 'Alpha order', status: 'draft' },
              { id: 'o-2', title: 'Beta order', status: 'paid' },
            ],
          },
        })}
      </>,
    );

    expect(screen.getByText('Orders')).toBeTruthy();
    expect(screen.getByText('Alpha order')).toBeTruthy();
    expect(screen.getByText('Beta order')).toBeTruthy();
    expect(document.querySelector('[data-designer-component="heroui.app-table-grid"]')).toBeTruthy();

    const search = screen.getByLabelText('Search orders…') as HTMLInputElement;
    expect(search).toBeTruthy();
    fireEvent.change(search, { target: { value: 'Alpha' } });
    expect(search.value).toBe('Alpha');
  });
});
