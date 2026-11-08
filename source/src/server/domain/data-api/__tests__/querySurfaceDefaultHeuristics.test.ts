import { describe, expect, it } from 'vitest';
import {
  inferColumnFilterRole,
  inferColumnSearchRole,
} from '../querySurfaceDefaultHeuristics';

describe('querySurfaceDefaultHeuristics', () => {
  it('marks title as basic search and public filter', () => {
    const column = {
      name: 'title',
      field: 'title',
      sequelizeType: 'STRING',
      type: 'string',
      sqlType: 'nvarchar(200)',
    };
    expect(inferColumnSearchRole(column)).toBe('basic');
    expect(inferColumnFilterRole(column)).toBe('public');
  });

  it('excludes password hash from search and list filter', () => {
    const column = {
      name: 'password_hash',
      field: 'password_hash',
      sequelizeType: 'STRING',
      type: 'string',
      sqlType: 'nvarchar(200)',
    };
    expect(inferColumnSearchRole(column)).toBe('none');
    expect(inferColumnFilterRole(column)).toBe('none');
  });
});
