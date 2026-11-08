import { describe, expect, it, vi, beforeEach } from 'vitest';

const existsSync = vi.fn();
const join = vi.fn((...parts: string[]) => parts.join('/'));
const codeEmbeddingsEnabled = vi.hoisted(() => ({ value: true }));

vi.mock('node:fs', () => ({
  default: { existsSync },
  existsSync,
}));

vi.mock('node:path', () => ({
  default: { join },
  join,
}));

vi.mock('../../../../shared/api/contracts/ai/codeEmbeddingsGate', () => ({
  get CODE_EMBEDDINGS_ENABLED() {
    return codeEmbeddingsEnabled.value;
  },
}));

describe('localEmbeddingsModelLifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    codeEmbeddingsEnabled.value = true;
    existsSync.mockReset();
    join.mockImplementation((...parts: string[]) => parts.join('/'));
    existsSync.mockReturnValue(false);
  });

  it('reports missing when the onnx file is not on disk', async () => {
    const { getLocalEmbeddingsModelStatus } = await import('../localEmbeddingsModelLifecycle');
    expect(getLocalEmbeddingsModelStatus().state).toBe('missing');
  });

  it('reports ready when the onnx file is already on disk', async () => {
    existsSync.mockReturnValue(true);
    const { getLocalEmbeddingsModelStatus } = await import('../localEmbeddingsModelLifecycle');
    expect(getLocalEmbeddingsModelStatus().state).toBe('ready');
  });

  it('checks the expected onnx path under workspace/models', async () => {
    await import('../localEmbeddingsModelLifecycle');
    expect(existsSync).toHaveBeenCalledWith(
      expect.stringContaining('workspace/models/embeddings/jinaai/jina-embeddings-v2-base-code/onnx/model_quantized.onnx'),
    );
  });

  it('warm refreshes status without loading the extractor when model files exist', async () => {
    existsSync.mockReturnValue(true);
    const mod = await import('../localEmbeddingsModelLifecycle');
    mod.warmLocalEmbeddingsModelInBackground();
    expect(mod.getLocalEmbeddingsModelStatus().state).toBe('ready');
    // No pipeline import should have been triggered by warm alone.
    expect(mod.getLocalEmbeddingsModelStatus().error).toBeNull();
  });

  it('reports disabled and rejects extractor load when the kill switch is off', async () => {
    codeEmbeddingsEnabled.value = false;
    const mod = await import('../localEmbeddingsModelLifecycle');
    expect(mod.getLocalEmbeddingsModelStatus()).toMatchObject({
      state: 'error',
      error: 'Code embeddings temporarily disabled.',
    });
    await expect(mod.getLocalEmbeddingsExtractor()).rejects.toThrow(/temporarily disabled/i);
  });
});
