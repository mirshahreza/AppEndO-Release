import { describe, expect, it } from 'vitest';
import type { ApiFormField } from '../apiFieldSchema';
import {
  isInternalCrudSetField,
  suggestCrudSetColumnFromField,
  suggestCrudSetColumns,
  suggestCrudSetFilterBar,
  suggestCrudSetListBody,
  suggestCrudSetPieces,
} from '../crudSetSuggestions';

const field = (name: string, type: ApiFormField['type'] = 'string'): ApiFormField => ({
  name,
  type,
  location: 'body',
  required: false,
});

describe('crudSetSuggestions', () => {
  it('skips internals and does not dump every field into columns', () => {
    const columns = suggestCrudSetColumns([
      field('id'),
      field('email'),
      field('full_name'),
      field('status'),
      field('created_at'),
      field('updated_at'),
      field('password'),
      field('token'),
      field('bio'),
      field('city'),
      field('country'),
      field('timezone'),
    ]);
    const names = columns.map((column) => column.field);
    expect(names).toContain('id');
    expect(names).toContain('email');
    expect(names).not.toContain('created_at');
    expect(names).not.toContain('password');
    expect(names.length).toBeLessThanOrEqual(6);
    const locked = suggestCrudSetColumnFromField(field('locked', 'boolean'));
    expect(locked.cellKind).toBe('lock-status');
    expect(locked.formPlacement).toBe('side');
    expect(locked.sortable).toBe(true);
    expect(locked.filterable).toBe(true);
    const website = suggestCrudSetColumnFromField(field('website'));
    expect(website.cellKind).toBe('link');
    expect(website.transform).toBe('link-domain');
    const roles = suggestCrudSetColumnFromField({
      name: 'roles',
      type: 'array',
      location: 'body',
      required: false,
      itemType: 'string',
    });
    expect(roles.cellKind).toBe('chips');
    expect(roles.sortable).toBe(false);
    expect(roles.filterable).toBe(false);
  });

  it('suggests search plus a few enum toolbar filters, not every field', () => {
    const bar = suggestCrudSetFilterBar([
      field('id'),
      { ...field('status'), enum: ['open', 'closed', 'archived'] },
      field('email'),
      field('bio'),
    ]);
    expect(bar.search).not.toBe(false);
    expect(bar.enabled).not.toBe(false);
    expect(bar.filters?.map((filter) => filter.field)).toEqual(['status']);
    expect(bar.filters?.[0]?.controlType).toBe('radio-group');
    expect(bar.filters?.[0]?.options).toHaveLength(3);
  });

  it('suggests tree-grid when parent_id is present', () => {
    expect(suggestCrudSetListBody([field('id'), field('parent_id')])).toBe('tree-grid');
    expect(suggestCrudSetListBody([field('id'), field('email')])).toBe('grid');
  });

  it('only suggests sibling APIs that already exist', () => {
    const suggested = suggestCrudSetPieces({
      listPath: '/api/users',
      listFields: [field('id'), field('email'), field('locked', 'boolean')],
      routes: [
        { id: '1', name: 'List users', method: 'GET', path: '/api/users' },
        { id: '2', name: 'Get user', method: 'GET', path: '/api/users/:id' },
        { id: '3', name: 'Add user', method: 'POST', path: '/api/users' },
        { id: '4', name: 'Edit user', method: 'PATCH', path: '/api/users/:id' },
        { id: '5', name: 'Lock user', method: 'PATCH', path: '/api/users/:id/lock' },
        { id: '6', name: 'Delete user', method: 'DELETE', path: '/api/users/:id' },
        { id: '7', name: 'Orders', method: 'POST', path: '/api/orders' },
      ],
    });
    expect(suggested.createApis.map((item) => item.endpointId)).toEqual(['/api/users']);
    expect(suggested.readOneApi?.endpointId).toBe('/api/users/:id');
    expect(suggested.deleteApi?.endpointId).toBe('/api/users/:id');
    expect(suggested.patches.some((patch) => patch.kind === 'content' && patch.endpointId === '/api/users/:id')).toBe(true);
    const lock = suggested.patches.find((patch) => patch.endpointId === '/api/users/:id/lock');
    expect(lock?.kind).toBe('purpose');
    expect(lock?.interaction).toBe('boolean-toggle');
    expect(lock?.toggleConfirm).toBe(true);
    expect(suggested.createApis.some((item) => item.endpointId === '/api/orders')).toBe(false);
    expect(suggested.export.enabled).not.toBe(false);
    expect(suggested.export.formats).toEqual(['xlsx', 'csv']);
    expect(suggested.refresh).toBe(true);
    expect(suggested.paging.pattern).toBe('numbered');
    expect(suggested.paging.defaultPageSize).toBe(50);
    expect(suggested.sorting.footer).not.toBe(false);
    expect(suggested.sorting.defaultDirection).toBe('asc');
    expect(suggested.grid.chrome).toBe('classic');
    expect(suggested.actions.maxVisible).toBe(3);
    expect(suggested.dialogs.formSize).toBe('lg');
    expect(suggested.columns[0]?.cardRole).toBe('title');
    expect(suggested.filterBar.searchClear).not.toBe(false);
  });

  it('marks created_at as internal', () => {
    expect(isInternalCrudSetField('created_at')).toBe(true);
    expect(isInternalCrudSetField('email')).toBe(false);
  });
});
