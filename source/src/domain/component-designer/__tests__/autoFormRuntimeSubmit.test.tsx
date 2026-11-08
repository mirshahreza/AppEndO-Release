/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DesignerDocumentPreview } from '../designerRuntimePreview';
import { buildAutoFormDocument } from '../autoFormTemplateBuilder';
import { mapApiFieldToControl } from '../apiFieldToControl';
import { buildDataSourceFromEndpoint } from '../bindingResourceModel';
import type { ApiFormField } from '../apiFieldSchema';

const makeField = (overrides: Partial<ApiFormField> & { name: string }): ApiFormField => ({
  type: 'string',
  location: 'body',
  required: false,
  ...overrides,
});

const buildCreateUserForm = () => {
  const nameField = makeField({ name: 'name', required: true });
  const dataSource = buildDataSourceFromEndpoint('/api/users', {
    fields: ['id', 'name'],
    primaryKey: 'id',
    method: 'POST',
  });
  return buildAutoFormDocument({
    title: 'Create user',
    includeTitle: true,
    dataSource,
    scenario: 'create',
    fields: [{
      field: nameField,
      enabled: true,
      label: 'Name',
      controlPaletteItemId: mapApiFieldToControl(nameField).paletteItemId,
    }],
    submitLabel: 'Create',
    successBehavior: 'refresh',
    layout: 'single',
  });
};

describe('auto-form generated Save button', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fires the API mutation when the generated Save button is clicked', async () => {
    const result = buildCreateUserForm();

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <DesignerDocumentPreview document={result.document} bindingDefinitions={result.bindingDefinitions} interactive />,
    );

    const input = document.querySelector('form input') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { value: 'Ada Lovelace' } });

    fireEvent.click(screen.getByText('Create'));

    await vi.waitFor(() => {
      const hasPost = fetchMock.mock.calls.some(
        ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(hasPost).toBe(true);
    });

    const mutationCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    ) as [string, RequestInit];
    expect(mutationCall[0]).toContain('/api/users');
    expect(JSON.parse(String(mutationCall[1].body))).toMatchObject({ name: 'Ada Lovelace' });
  });
});
