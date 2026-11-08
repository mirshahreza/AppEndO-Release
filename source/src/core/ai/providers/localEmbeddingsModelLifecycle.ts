import fs from 'node:fs';
import path from 'node:path';
import { CODE_EMBEDDINGS_ENABLED } from '../../../shared/api/contracts/ai/codeEmbeddingsGate';
import {
  LOCAL_EMBEDDINGS_MODEL_ID,
  type LocalEmbeddingsModelStatus,
} from '../../../shared/api/contracts/ai/localEmbeddingsModel';

const DISABLED_STATUS: LocalEmbeddingsModelStatus = {
  modelId: LOCAL_EMBEDDINGS_MODEL_ID,
  state: 'error',
  progressPercent: null,
  error: 'Code embeddings temporarily disabled.',
};

const EMBEDDINGS_MODELS_DIR = ['workspace', 'models', 'embeddings'];

type FeatureExtractor = (
  texts: string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

type ProgressPayload = {
  progress?: number;
  loaded?: number;
  total?: number;
};

let extractorPromise: Promise<FeatureExtractor> | null = null;

const getModelOnnxPath = (): string => {
  const [org, ...rest] = LOCAL_EMBEDDINGS_MODEL_ID.split('/');
  return path.join(process.cwd(), ...EMBEDDINGS_MODELS_DIR, org, ...rest, 'onnx', 'model_quantized.onnx');
};

export const isLocalEmbeddingsModelOnDisk = (): boolean => {
  try {
    return fs.existsSync(getModelOnnxPath());
  } catch {
    return false;
  }
};

const buildInitialStatus = (): LocalEmbeddingsModelStatus => {
  if (!CODE_EMBEDDINGS_ENABLED) {
    return { ...DISABLED_STATUS };
  }
  return {
    modelId: LOCAL_EMBEDDINGS_MODEL_ID,
    state: isLocalEmbeddingsModelOnDisk() ? 'ready' : 'missing',
    progressPercent: null,
    error: null,
  };
};

let status: LocalEmbeddingsModelStatus = buildInitialStatus();

export const getLocalEmbeddingsModelStatus = (): LocalEmbeddingsModelStatus => (
  CODE_EMBEDDINGS_ENABLED ? { ...status } : { ...DISABLED_STATUS }
);

const setStatus = (patch: Partial<LocalEmbeddingsModelStatus>): void => {
  status = { ...status, ...patch };
};

const resolveProgressPercent = (payload: ProgressPayload): number | null => {
  if (typeof payload.progress === 'number' && Number.isFinite(payload.progress)) {
    return Math.max(0, Math.min(100, Math.round(payload.progress * 100)));
  }
  if (
    typeof payload.loaded === 'number'
    && typeof payload.total === 'number'
    && payload.total > 0
  ) {
    return Math.max(0, Math.min(100, Math.round((payload.loaded / payload.total) * 100)));
  }
  return null;
};

const loadExtractor = async (): Promise<FeatureExtractor> => {
  if (!CODE_EMBEDDINGS_ENABLED) {
    throw new Error(DISABLED_STATUS.error ?? 'Code embeddings temporarily disabled.');
  }
  // Opaque + vite-ignore: keep transformers out of the Vite client scanner/optimizer.
  const transformersSpec = ['@huggingface', 'transformers'].join('/');
  const { pipeline, env } = await import(/* @vite-ignore */ transformersSpec) as {
    pipeline: (...args: unknown[]) => Promise<unknown>;
    env: { cacheDir: string; localModelPath: string; allowLocalModels: boolean };
  };
  const modelsRoot = path.join(process.cwd(), ...EMBEDDINGS_MODELS_DIR);
  env.cacheDir = modelsRoot;
  env.localModelPath = modelsRoot;
  env.allowLocalModels = true;

  const extractor = await pipeline('feature-extraction', LOCAL_EMBEDDINGS_MODEL_ID, {
    dtype: 'q8',
    progress_callback: (payload: ProgressPayload) => {
      const progressPercent = resolveProgressPercent(payload);
      if (progressPercent === null) {
        return;
      }
      setStatus({
        state: 'downloading',
        progressPercent,
        error: null,
      });
    },
  });

  return extractor as unknown as FeatureExtractor;
};

const getExtractor = (): Promise<FeatureExtractor> => {
  if (!CODE_EMBEDDINGS_ENABLED) {
    setStatus({ ...DISABLED_STATUS });
    return Promise.reject(new Error(DISABLED_STATUS.error ?? 'Code embeddings temporarily disabled.'));
  }

  if (!extractorPromise) {
    const hadFilesOnDisk = isLocalEmbeddingsModelOnDisk();
    if (!hadFilesOnDisk) {
      setStatus({ state: 'downloading', progressPercent: 0, error: null });
    }

    extractorPromise = loadExtractor()
      .then((extractor) => {
        setStatus({ state: 'ready', progressPercent: 100, error: null });
        return extractor;
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        setStatus({
          state: 'error',
          progressPercent: null,
          error: message,
        });
        extractorPromise = null;
        throw error;
      });
  }
  return extractorPromise;
};

/**
 * Refresh on-disk status only. Do NOT load the ONNX / transformers.js pipeline here —
 * eager load pinned multi‑GB RAM in the main Node process and made every subsequent
 * restart thrash under memory pressure. The extractor stays lazy until first embed.
 */
export const warmLocalEmbeddingsModelInBackground = (): void => {
  if (!CODE_EMBEDDINGS_ENABLED) {
    setStatus({ ...DISABLED_STATUS });
    return;
  }
  if (isLocalEmbeddingsModelOnDisk()) {
    setStatus({ state: 'ready', progressPercent: 100, error: null });
    return;
  }
  setStatus({ state: 'missing', progressPercent: null, error: null });
};

export const getLocalEmbeddingsExtractor = (): Promise<FeatureExtractor> => getExtractor();
