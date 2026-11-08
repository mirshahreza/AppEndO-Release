import { fetchWithTimeout, readResponseError } from '../providers/providerUtils';
import {
  extractResponsesImageGenerationDataUrl,
  requiresOpenAiImagesApi,
  supportsOpenAiResponsesImageGeneration,
  type OpenAiResponsesPayload,
} from '../providers/openAiModelRouting';
import type { AiProviderKind } from '../../../shared/api/contracts/ai/types';

type OpenAiImagesPayload = {
  data?: Array<{ b64_json?: string; url?: string }>;
};

export type OpenAiImageApiRequest = {
  provider: AiProviderKind;
  apiKey: string;
  baseUrl?: string;
  organizationId?: string;
  modelId: string;
  deploymentName?: string;
  apiVersion?: string;
  prompt: string;
  timeoutMs?: number;
};

export type OpenAiImageEditRequest = OpenAiImageApiRequest & {
  imageBuffer: Buffer;
  imageMime?: string;
};

export type OpenAiResponsesImageEditRequest = OpenAiImageApiRequest & {
  imageDataUrl: string;
};
const isDallE2EditModel = (modelId: string): boolean => /^dall-e-2$/i.test(modelId.trim());

const isGptImageEditModel = (modelId: string): boolean => {
  const normalized = modelId.trim().toLowerCase();
  if (isDallE2EditModel(modelId)) return false;
  return /^gpt-image(?:-|\.|$)/.test(normalized) || /^chatgpt-image(?:-|$)/.test(normalized);
};

export const supportsOpenAiImageEdits = (modelId: string): boolean => (
  isDallE2EditModel(modelId) || isGptImageEditModel(modelId)
);

export const supportsOpenAiImageEditsForEntry = (
  entry: { modelId: string; deploymentName?: string | null },
): boolean => (
  supportsOpenAiImageEdits(entry.modelId)
  || Boolean(entry.deploymentName?.trim() && supportsOpenAiImageEdits(entry.deploymentName))
);

export const shouldUseDedicatedOpenAiImageApi = (
  entry: { provider: AiProviderKind; modelId: string; deploymentName?: string | null },
): boolean => (
  isOpenAiImageEditProvider(entry.provider)
  && (
    requiresOpenAiImagesApi(entry.modelId)
    || Boolean(entry.deploymentName?.trim() && requiresOpenAiImagesApi(entry.deploymentName))
    || supportsOpenAiImageEditsForEntry(entry)
  )
);

export const shouldUseOpenAiResponsesImageApi = (
  entry: { provider: AiProviderKind; modelId: string; deploymentName?: string | null },
): boolean => {
  if (!isOpenAiImageEditProvider(entry.provider)) return false;
  const modelRef = entry.deploymentName?.trim() || entry.modelId;
  return supportsOpenAiResponsesImageGeneration(modelRef) && !supportsOpenAiImageEditsForEntry(entry);
};
export const isOpenAiImageEditProvider = (provider: AiProviderKind): boolean => (
  provider === 'openai' || provider === 'openai-compatible' || provider === 'azure-openai'
);

const extensionForImageMime = (mime: string): string => {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  return 'png';
};

const resolveOpenAiModelId = (params: OpenAiImageApiRequest): string => {
  if (params.provider === 'azure-openai') {
    return params.deploymentName?.trim() || params.modelId.trim();
  }
  return params.modelId.trim();
};

const resolveOpenAiAuthHeaders = (
  params: OpenAiImageApiRequest,
): { headers: Record<string, string>; baseUrl: string } => {
  const apiKey = params.apiKey.trim();
  const headers: Record<string, string> = {};

  if (params.provider === 'azure-openai') {
    if (!params.baseUrl?.trim()) {
      throw new Error('Azure OpenAI image API requires baseUrl.');
    }
    headers['api-key'] = apiKey;
    return {
      headers,
      baseUrl: params.baseUrl.replace(/\/$/, ''),
    };
  }

  headers.Authorization = `Bearer ${apiKey}`;
  if (params.organizationId?.trim()) {
    headers['OpenAI-Organization'] = params.organizationId.trim();
  }

  return {
    headers,
    baseUrl: (params.baseUrl?.trim() || 'https://api.openai.com/v1').replace(/\/$/, ''),
  };
};

const resolveGenerationsEndpoint = (params: OpenAiImageApiRequest): { url: string; headers: Record<string, string> } => {
  const { headers, baseUrl } = resolveOpenAiAuthHeaders(params);

  if (params.provider === 'azure-openai') {
    const deploymentName = params.deploymentName?.trim() || params.modelId.trim();
    const apiVersion = params.apiVersion?.trim() || '2025-04-01-preview';
    return {
      url: `${baseUrl}/openai/deployments/${encodeURIComponent(deploymentName)}/images/generations?api-version=${encodeURIComponent(apiVersion)}`,
      headers: { ...headers, 'Content-Type': 'application/json' },
    };
  }

  return {
    url: `${baseUrl}/images/generations`,
    headers: { ...headers, 'Content-Type': 'application/json' },
  };
};

const resolveResponsesEndpoint = (params: OpenAiImageApiRequest): { url: string; headers: Record<string, string> } => {
  const { headers, baseUrl } = resolveOpenAiAuthHeaders(params);

  if (params.provider === 'azure-openai') {
    const apiVersion = params.apiVersion?.trim();
    const url = apiVersion
      ? `${baseUrl}/openai/v1/responses?api-version=${encodeURIComponent(apiVersion)}`
      : `${baseUrl}/openai/v1/responses`;
    return {
      url,
      headers: { ...headers, 'Content-Type': 'application/json' },
    };
  }

  return {
    url: `${baseUrl}/responses`,
    headers: { ...headers, 'Content-Type': 'application/json' },
  };
};

const resolveEditEndpoint = (params: OpenAiImageEditRequest): { url: string; headers: Record<string, string> } => {
  const { headers, baseUrl } = resolveOpenAiAuthHeaders(params);

  if (params.provider === 'azure-openai') {
    const deploymentName = params.deploymentName?.trim();
    if (!deploymentName) {
      throw new Error('Azure OpenAI image edit requires deploymentName.');
    }
    const apiVersion = params.apiVersion?.trim() || '2025-04-01-preview';
    return {
      url: `${baseUrl}/openai/deployments/${encodeURIComponent(deploymentName)}/images/edits?api-version=${encodeURIComponent(apiVersion)}`,
      headers,
    };
  }

  return {
    url: `${baseUrl}/images/edits`,
    headers,
  };
};

const resolveGeneratedImageDataUrl = async (
  data: OpenAiImagesPayload,
  timeoutMs?: number,
): Promise<string> => {
  const image = data.data?.[0];
  if (image?.b64_json?.trim()) {
    return `data:image/png;base64,${image.b64_json.trim()}`;
  }
  if (image?.url?.trim()) {
    const imageResponse = await fetchWithTimeout(image.url.trim(), { method: 'GET' }, timeoutMs ?? 120000);
    if (!imageResponse.ok) {
      throw new Error('Image API returned a URL that could not be fetched.');
    }
    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    return `data:image/png;base64,${bytes.toString('base64')}`;
  }

  throw new Error('Image API returned no image data.');
};

export async function generateOpenAiImage(params: OpenAiImageApiRequest): Promise<string> {
  const modelId = resolveOpenAiModelId(params);
  const { url, headers } = resolveGenerationsEndpoint(params);
  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId,
        prompt: params.prompt.trim(),
        n: 1,
        size: '1024x1024',
      }),
    },
    params.timeoutMs ?? 120000,
  );

  if (!response.ok) {
    throw new Error(await readResponseError(response));
  }

  return resolveGeneratedImageDataUrl(await response.json() as OpenAiImagesPayload, params.timeoutMs);
};

export async function runOpenAiResponsesImageEditor(params: OpenAiResponsesImageEditRequest): Promise<string> {
  const modelId = resolveOpenAiModelId(params);
  if (!supportsOpenAiResponsesImageGeneration(modelId) && !supportsOpenAiResponsesImageGeneration(params.modelId)) {
    throw new Error(`Model "${params.modelId}" does not support OpenAI Responses image generation.`);
  }

  const { url, headers } = resolveResponsesEndpoint(params);
  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: params.prompt.trim() },
            { type: 'input_image', image_url: params.imageDataUrl.trim() },
          ],
        }],
        tools: [{ type: 'image_generation', action: 'edit' }],
        tool_choice: { type: 'image_generation' },
      }),
    },
    params.timeoutMs ?? 180000,
  );

  if (!response.ok) {
    throw new Error(await readResponseError(response));
  }

  const data = await response.json() as OpenAiResponsesPayload;
  const imageDataUrl = extractResponsesImageGenerationDataUrl(data);
  if (!imageDataUrl) {
    throw new Error('Responses API returned no edited image.');
  }

  return imageDataUrl;
}

export async function runOpenAiImageEditor(params: OpenAiImageEditRequest): Promise<string> {
  const editModelId = resolveOpenAiModelId(params);
  const canEdit = supportsOpenAiImageEdits(editModelId)
    || supportsOpenAiImageEdits(params.modelId)
    || Boolean(params.deploymentName?.trim() && supportsOpenAiImageEdits(params.deploymentName));
  const canGenerate = requiresOpenAiImagesApi(params.modelId)
    || Boolean(params.deploymentName?.trim() && requiresOpenAiImagesApi(params.deploymentName));

  if (!canEdit && !canGenerate) {
    throw new Error(`Model "${params.modelId}" does not support OpenAI image edit or generation APIs.`);
  }

  if (canEdit) {
    try {
      return await editOpenAiImage(params);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!canGenerate) {
        throw error;
      }
      if (!/invalid|unsupported|not supported|must be/i.test(message)) {
        throw error;
      }
    }
  }

  return generateOpenAiImage(params);
};
export async function editOpenAiImage(params: OpenAiImageEditRequest): Promise<string> {
  const editModelId = resolveOpenAiModelId(params);
  const isDallE2 = isDallE2EditModel(editModelId) || isDallE2EditModel(params.modelId);
  const imageMime = isDallE2 ? 'image/png' : (params.imageMime?.trim().toLowerCase() || 'image/png');
  const extension = extensionForImageMime(imageMime);

  const form = new FormData();
  if (params.provider !== 'azure-openai') {
    form.append('model', editModelId);
  }
  form.append('prompt', params.prompt.trim());
  form.append('n', '1');
  form.append(
    'image',
    new Blob([params.imageBuffer], { type: imageMime }),
    `image.${extension}`,
  );

  if (isDallE2) {
    form.append('size', '1024x1024');
  }

  const { url, headers } = resolveEditEndpoint(params);
  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers,
      body: form,
    },
    params.timeoutMs ?? 120000,
  );

  if (!response.ok) {
    throw new Error(await readResponseError(response));
  }

  return resolveGeneratedImageDataUrl(await response.json() as OpenAiImagesPayload, params.timeoutMs);
}