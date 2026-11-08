import { describe, expect, it } from 'vitest';
import { APPENDOO_CODEBASE_EXTRACTORS, getCodebaseExtractorRegistry } from '../codebaseExtractorRegistry';

describe('codebaseExtractorRegistry', () => {
  it('registers required AppEndO-aware extractors', () => {
    const registry = getCodebaseExtractorRegistry();
    expect(registry.extractors).toHaveLength(APPENDOO_CODEBASE_EXTRACTORS.length);
    expect(registry.extractors.length).toBeGreaterThanOrEqual(8);
    expect(registry.extractors.some((extractor) => extractor.kind === 'server_function_registration')).toBe(true);
  });
});
