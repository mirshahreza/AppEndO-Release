export const LOCAL_EMBEDDINGS_MODEL_ID = 'jinaai/jina-embeddings-v2-base-code';

export type LocalEmbeddingsModelState = 'missing' | 'downloading' | 'ready' | 'error';

export type LocalEmbeddingsModelStatus = {
  modelId: string;
  state: LocalEmbeddingsModelState;
  /** 0–100 while downloading; null otherwise. */
  progressPercent: number | null;
  error: string | null;
};

export type LocalEmbeddingsModelStatusResponse = {
  success: boolean;
  status: LocalEmbeddingsModelStatus;
};
