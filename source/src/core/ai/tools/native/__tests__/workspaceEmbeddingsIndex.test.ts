import { afterEach, describe, expect, it } from 'vitest';
import type { IAiProvider } from '../../../IAiProvider';
import {
  configureWorkspaceEmbeddingsForTests,
  ensureWorkspaceEmbeddingsFill,
  searchWorkspaceEmbeddings,
  waitForWorkspaceEmbeddingsFillForTests,
} from '../workspaceEmbeddingsIndex';

/**
 * Deterministic fake embedder: maps text to a 8-dim vector from character-class counts,
 * so "interface"-heavy chunks land near an "interface" query without any network.
 */
const fakeVector = (text: string): number[] => {
  const lower = text.toLowerCase();
  const features = ['interface', 'workflow', 'provider', 'chunk', 'render', 'patch', 'agent', 'index'];
  return features.map((feature) => {
    let count = 0;
    let position = lower.indexOf(feature);
    while (position >= 0) {
      count += 1;
      position = lower.indexOf(feature, position + feature.length);
    }
    return count + 0.001;
  });
};

const fakeProvider: IAiProvider = {
  getProviderName: () => 'fake-embedder',
  chat: async () => 'unused',
  embedTexts: async (texts: string[]) => texts.map(fakeVector),
};

const failingProvider: IAiProvider = {
  getProviderName: () => 'broken-embedder',
  chat: async () => 'unused',
  embedTexts: async () => {
    throw new Error('404 no embeddings endpoint');
  },
};

afterEach(() => {
  configureWorkspaceEmbeddingsForTests(null);
});

describe('workspaceEmbeddingsIndex', () => {
  it('returns no hits before any fill has completed', async () => {
    configureWorkspaceEmbeddingsForTests(() => ({ provider: fakeProvider, modelKey: '__test__' }));
    const hits = await searchWorkspaceEmbeddings('interface for the api', undefined, 5);
    // First call sees an empty index (fill just started in background) — lexical covers it.
    expect(hits).toEqual([]);
  });

  it('ranks semantically related chunks after a background fill', async () => {
    configureWorkspaceEmbeddingsForTests(() => ({ provider: fakeProvider, modelKey: '__test__' }));
    ensureWorkspaceEmbeddingsFill();
    await waitForWorkspaceEmbeddingsFillForTests();

    const hits = await searchWorkspaceEmbeddings('interface definitions', undefined, 10);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.score).toBeGreaterThan(0);
    for (let i = 1; i < hits.length; i += 1) {
      expect(hits[i - 1]!.score).toBeGreaterThanOrEqual(hits[i]!.score);
    }
  });

  it('respects scope filtering', async () => {
    configureWorkspaceEmbeddingsForTests(() => ({ provider: fakeProvider, modelKey: '__test__' }));
    ensureWorkspaceEmbeddingsFill();
    await waitForWorkspaceEmbeddingsFillForTests();

    // Derive the scope from an actual indexed hit so the test is independent of which
    // chunks land in the first budget-capped fill pass.
    const unscoped = await searchWorkspaceEmbeddings('agent provider', undefined, 10);
    expect(unscoped.length).toBeGreaterThan(0);
    const scopeDir = unscoped[0]!.path.split('/').slice(0, -1).join('/');

    const hits = await searchWorkspaceEmbeddings('agent provider', [scopeDir], 10);
    expect(hits.length).toBeGreaterThan(0);
    hits.forEach((hit) => {
      expect(hit.path === scopeDir || hit.path.startsWith(`${scopeDir}/`)).toBe(true);
    });
  });

  it('degrades to no hits with a cooldown when the provider fails', async () => {
    configureWorkspaceEmbeddingsForTests(() => ({ provider: failingProvider, modelKey: '__test__' }));
    ensureWorkspaceEmbeddingsFill();
    await waitForWorkspaceEmbeddingsFillForTests();

    const hits = await searchWorkspaceEmbeddings('anything at all', undefined, 5);
    expect(hits).toEqual([]);
  });

  it('is a silent no-op when no embeddings model is configured', async () => {
    configureWorkspaceEmbeddingsForTests(() => null);
    ensureWorkspaceEmbeddingsFill();
    const hits = await searchWorkspaceEmbeddings('anything', undefined, 5);
    expect(hits).toEqual([]);
  });
});
