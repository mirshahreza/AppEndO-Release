import { describe, expect, it, beforeEach } from 'vitest';
import {
  findReferences,
  findSymbol,
  getSourceSlice,
  indexStructuralFile,
  queryStructuralIntelligence,
  resetCodebaseStructuralIndexForTests,
} from '../codebaseStructuralScaffold';

const SAMPLE = `
export function buildContextPackScaffold(input: unknown) {
  return input;
}

export const CONTEXT_PACK_BUILDER_VERSION = '1.0.0';
`.trim();

describe('codebaseStructuralScaffold', () => {
  beforeEach(() => {
    resetCodebaseStructuralIndexForTests();
  });

  it('indexes symbols and skips unchanged file hash', () => {
    const first = indexStructuralFile('src/shared/lib/appendoo/contextPackBuilder.ts', SAMPLE);
    const second = indexStructuralFile('src/shared/lib/appendoo/contextPackBuilder.ts', SAMPLE);

    expect(first.skipped).toBe(false);
    expect(second.skipped).toBe(true);
    expect(findSymbol('buildContextPackScaffold')).toHaveLength(1);
  });

  it('finds references and source slices', () => {
    indexStructuralFile('src/shared/lib/appendoo/contextPackBuilder.ts', SAMPLE);

    const references = findReferences('buildContextPackScaffold');
    expect(references.length).toBeGreaterThan(0);

    const slice = getSourceSlice('src/shared/lib/appendoo/contextPackBuilder.ts', 1, 2);
    expect(slice?.text).toContain('buildContextPackScaffold');
  });

  it('queries structural intelligence by symbol name', () => {
    indexStructuralFile('src/shared/lib/appendoo/contextPackBuilder.ts', SAMPLE);
    const result = queryStructuralIntelligence('buildContextPackScaffold');
    expect(result.symbols[0]?.name).toBe('buildContextPackScaffold');
  });
});
