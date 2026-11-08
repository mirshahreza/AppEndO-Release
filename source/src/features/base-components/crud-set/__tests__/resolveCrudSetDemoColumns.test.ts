import { describe, expect, it } from 'vitest';
import { resolveCrudSetDemoColumns } from '../CrudSetBaseComponentsWorkspace';

describe('resolveCrudSetDemoColumns', () => {
  it('preserves the order stored in config.columns', () => {
    const columns = resolveCrudSetDemoColumns({
      columns: [
        { field: 'title', label: 'Title' },
        { field: 'code', label: 'Code' },
      ],
      relations: {
        parent: true,
        status: true,
        owner: true,
        detail: true,
        comments: true,
        tags: true,
      },
    });

    expect(columns.map((column) => column.field)).toEqual(['title', 'code']);
  });
});
