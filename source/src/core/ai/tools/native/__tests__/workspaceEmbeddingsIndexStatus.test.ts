import { afterEach, describe, expect, it } from 'vitest';
import type { IAiProvider } from '../../../IAiProvider';
import {
  configureWorkspaceEmbeddingsForTests,
  ensureWorkspaceEmbeddingsFill,
  getWorkspaceEmbeddingsIndexStatus,
  waitForWorkspaceEmbeddingsFillForTests,
} from '../workspaceEmbeddingsIndex';

const fakeProvider: IAiProvider = {
  getProviderName: () => 'fake-embedder',
  chat: async () => 'unused',
  embedTexts: async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3, 0.4]),
};

afterEach(() => {
  configureWorkspaceEmbeddingsForTests(null);
});

describe('getWorkspaceEmbeddingsIndexStatus', () => {
  it('reports unavailable when no embeddings provider is configured', () => {
    configureWorkspaceEmbeddingsForTests(() => null);
    expect(getWorkspaceEmbeddingsIndexStatus().state).toBe('unavailable');
  });

  it('returns pending quickly when the chunk index is not warmed yet', () => {
    configureWorkspaceEmbeddingsForTests(() => ({ provider: fakeProvider, modelKey: '__test__' }));
    const status = getWorkspaceEmbeddingsIndexStatus();
    expect(['pending', 'indexing', 'ready']).toContain(status.state);
  });

  it('reports ready after all chunks are embedded', async () => {
    configureWorkspaceEmbeddingsForTests(() => ({ provider: fakeProvider, modelKey: '__test__' }));

    for (let attempt = 0; attempt < 20; attempt += 1) {
      ensureWorkspaceEmbeddingsFill();
      await waitForWorkspaceEmbeddingsFillForTests();
      if (getWorkspaceEmbeddingsIndexStatus().state === 'ready') break;
    }

    const status = getWorkspaceEmbeddingsIndexStatus();
    expect(status.state).toBe('ready');
    expect(status.totalChunks).toBeGreaterThan(0);
    expect(status.indexedChunks).toBe(status.totalChunks);
    expect(status.progressPercent).toBe(100);
  });
});
