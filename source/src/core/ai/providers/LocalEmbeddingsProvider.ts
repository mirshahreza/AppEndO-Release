import type { ChatMessage, IAiProvider } from '../IAiProvider';
import { LOCAL_EMBEDDINGS_MODEL_ID } from '../../../shared/api/contracts/ai/localEmbeddingsModel';
import { getLocalEmbeddingsExtractor } from './localEmbeddingsModelLifecycle';

/**
 * In-process embeddings via Transformers.js (ONNX on CPU) — zero external services.
 *
 * Model files live inside the app under `workspace/models/embeddings/<repo-id>/` and are
 * downloaded on first server start (or first use). `jina-embeddings-v2-base-code` is a
 * code-specialized embedding model (768-dim, long-context) — the strongest local option
 * for code retrieval. A hard failure surfaces to the caller, whose cooldown degrades
 * search to lexical-only.
 */
export { LOCAL_EMBEDDINGS_MODEL_ID };

/** ONNX inference sub-batch — bounds peak memory for long code chunks. */
const INFERENCE_BATCH_SIZE = 8;

export class LocalEmbeddingsProvider implements IAiProvider {
  getProviderName(): string {
    return `local-embeddings (${LOCAL_EMBEDDINGS_MODEL_ID})`;
  }

  async chat(_messages: ChatMessage[], _systemContext?: string): Promise<string> {
    throw new Error('Local embeddings provider does not support chat.');
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extractor = await getLocalEmbeddingsExtractor();
    const vectors: number[][] = [];
    for (let offset = 0; offset < texts.length; offset += INFERENCE_BATCH_SIZE) {
      const batch = texts.slice(offset, offset + INFERENCE_BATCH_SIZE);
      const output = await extractor(batch, { pooling: 'mean', normalize: true });
      vectors.push(...output.tolist());
    }
    if (vectors.length !== texts.length) {
      throw new Error(`Local embeddings produced ${vectors.length} vectors for ${texts.length} inputs.`);
    }
    return vectors;
  }
}

export const localEmbeddingsProvider = new LocalEmbeddingsProvider();
