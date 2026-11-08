export type WorkspaceEmbeddingsIndexState =
  | 'unavailable'
  | 'empty'
  | 'pending'
  | 'indexing'
  | 'ready'
  | 'error';

export type WorkspaceEmbeddingsIndexStatus = {
  state: WorkspaceEmbeddingsIndexState;
  totalChunks: number;
  indexedChunks: number;
  /** 0–100 while indexing; null when not applicable. */
  progressPercent: number | null;
  isFillInFlight: boolean;
  error: string | null;
};

export type WorkspaceEmbeddingsIndexStatusResponse = {
  success: boolean;
  status: WorkspaceEmbeddingsIndexStatus;
};
