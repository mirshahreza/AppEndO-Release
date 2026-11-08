import { describe, expect, it } from 'vitest';
import type { EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';
import {
  deriveStructureFromFields,
  needsExplorerStructureHydration,
  resolveExplorerObjectStructure,
} from '../explorerObjectStructure';

const sampleModel = {
  columns: [
    { name: 'id', isPrimaryKey: true },
    { name: 'title', isPrimaryKey: false },
  ],
} as EdgeModelDefinition;

describe('explorerObjectStructure', () => {
  it('derives structure from live fields', () => {
    expect(deriveStructureFromFields([
      { name: 'id', dataType: 'int', suggestedFieldType: 'integer', nullable: false, isPrimaryKey: true },
      { name: 'name', dataType: 'text', suggestedFieldType: 'string', nullable: true, isPrimaryKey: false },
    ])).toEqual({
      columnCount: 2,
      primaryKey: 'id',
    });
  });

  it('detects legacy API rows that need hydration', () => {
    expect(needsExplorerStructureHydration([
      { name: 'users', columnCount: 0, primaryKey: null },
      { name: 'orders', columnCount: 0, primaryKey: null },
    ])).toBe(true);

    expect(needsExplorerStructureHydration([
      { name: 'users', columnCount: 5, primaryKey: 'id' },
      { name: 'orders', columnCount: 0, primaryKey: null },
    ])).toBe(false);
  });

  it('prefers hydrated structure, then API summary, then edge model', () => {
    expect(resolveExplorerObjectStructure(
      { name: 'users', columnCount: 0, primaryKey: null },
      sampleModel,
      { columnCount: 9, primaryKey: 'uuid' },
    )).toEqual({ columnCount: 9, primaryKey: 'uuid' });

    expect(resolveExplorerObjectStructure(
      { name: 'users', columnCount: 4, primaryKey: 'id' },
      sampleModel,
    )).toEqual({ columnCount: 4, primaryKey: 'id' });

    expect(resolveExplorerObjectStructure(
      { name: 'users', columnCount: 0, primaryKey: null },
      sampleModel,
    )).toEqual({ columnCount: 2, primaryKey: 'id' });
  });
});
