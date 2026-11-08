import { afterEach, describe, expect, it } from 'vitest';
import {
  listIndexedChunks,
  lookupExportedSymbol,
  resetCodeChunkIndexForTests,
  searchCodeChunks,
  tokenizeCode,
} from '../codeChunkIndex';

afterEach(() => {
  resetCodeChunkIndexForTests();
});

describe('codeChunkIndex', () => {
  it('finds chunks by token overlap when exact path terms are present', () => {
    const hits = searchCodeChunks('AgentImplementGate draft', ['src/core/ai/agent'], 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.path).toContain('agentImplementGate');
  });

  it('matches camelCase identifiers from space-separated query words', () => {
    // The old lowercase-first tokenizer collapsed AgentImplementGate into one opaque term;
    // "implement gate" must now reach it through content terms, not just path substrings.
    const hits = searchCodeChunks('implement gate decision', ['src/core/ai/agent'], 10);
    expect(hits.some((hit) => hit.path.includes('agentImplementGate'))).toBe(true);
  });

  it('scoped search does not poison the global index for later unscoped searches', () => {
    const scoped = searchCodeChunks('AgentImplementGate', ['src/core/ai/agent'], 5);
    expect(scoped.length).toBeGreaterThan(0);
    // Old behavior cached the scoped build globally; a follow-up search in another area
    // then found nothing until the TTL expired.
    const other = searchCodeChunks('AnthropicProvider chatWithTools', ['src/core/ai/providers'], 5);
    expect(other.some((hit) => hit.path.includes('AnthropicProvider'))).toBe(true);
  });

  it('ranks an exact symbol match above incidental term overlap', () => {
    const hits = searchCodeChunks('applyFastApplyPatch', ['src/shared/lib/appendoo'], 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.path).toContain('fastApplyPatch');
  });
});

describe('tokenizeCode', () => {
  it('splits camelCase and PascalCase identifiers into parts plus the whole', () => {
    expect(tokenizeCode('ApiClientInterface')).toEqual(
      expect.arrayContaining(['apiclientinterface', 'api', 'client', 'interface']),
    );
  });

  it('splits snake_case identifiers', () => {
    expect(tokenizeCode('draft_file_patch')).toEqual(
      expect.arrayContaining(['draft_file_patch', 'draft', 'file', 'patch']),
    );
  });

  it('handles consecutive uppercase acronyms', () => {
    expect(tokenizeCode('parseHTMLResponse')).toEqual(
      expect.arrayContaining(['html', 'parse', 'response']),
    );
  });
});

describe('lookupExportedSymbol', () => {
  it('resolves an exported symbol to its file location', () => {
    const hits = lookupExportedSymbol('applyFastApplyPatch');
    expect(hits.some((hit) => hit.path.includes('fastApplyPatch'))).toBe(true);
  });

  it('returns nothing for unknown symbols', () => {
    expect(lookupExportedSymbol('definitelyNotARealExportName')).toEqual([]);
  });
});

describe('listIndexedChunks', () => {
  it('exposes chunk text with line ranges for the embeddings index', () => {
    const chunks = listIndexedChunks();
    expect(chunks.length).toBeGreaterThan(0);
    const sample = chunks[0]!;
    expect(sample.path).toBeTruthy();
    expect(sample.text.length).toBeGreaterThan(0);
    expect(sample.endLine).toBeGreaterThanOrEqual(sample.startLine);
  });
});
