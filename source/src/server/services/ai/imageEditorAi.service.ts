import { aiManager } from '../../../core/ai/AiManager';
import {
  runOpenAiImageEditor,
  runOpenAiResponsesImageEditor,
  shouldUseDedicatedOpenAiImageApi,
  shouldUseOpenAiResponsesImageApi,
  supportsOpenAiImageEditsForEntry,
} from '../../../core/ai/imageEdit/openAiImageEdit';
import { resolveAiProviderConfig } from '../../../shared/api/contracts/ai/validators';
import { HttpError } from '../../errors/HttpError';
import { resolveImageEditorOutputModel } from './imageEditorModelResolver';

const DALL_E_2_MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const GPT_IMAGE_MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const OPENAI_EDIT_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

type ParsedDataUrl = {
  mime: string;
  buffer: Buffer;
};

const validateDataUrlFormat = (imageDataUrl: string): void => {
  const trimmed = imageDataUrl.trim();
  if (!/^data:[^;]+;base64,.+$/i.test(trimmed)) {
    throw new HttpError(400, 'imageDataUrl must be a base64 data URL.');
  }
};

const parseDataUrl = (imageDataUrl: string, maxBytes: number): ParsedDataUrl => {
  validateDataUrlFormat(imageDataUrl);
  const trimmed = imageDataUrl.trim();
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
  if (!match?.[1] || !match[2]) {
    throw new HttpError(400, 'imageDataUrl must be a base64 data URL.');
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) {
    throw new HttpError(400, 'imageDataUrl is empty.');
  }
  if (buffer.length > maxBytes) {
    throw new HttpError(400, `Image exceeds ${maxBytes} byte limit.`);
  }

  return { mime: match[1].toLowerCase(), buffer };
};

const resolveMaxImageBytes = (entry: { modelId: string; deploymentName?: string | null }): number => (
  supportsOpenAiImageEditsForEntry(entry) && !/^dall-e-2$/i.test(entry.modelId.trim())
    ? GPT_IMAGE_MAX_IMAGE_BYTES
    : DALL_E_2_MAX_IMAGE_BYTES
);

export class ImageEditorAiService {
  async edit(params: {
    prompt: unknown;
    imageDataUrl: unknown;
    modelId?: unknown;
    history?: unknown;
  }) {
    const prompt = typeof params.prompt === 'string' ? params.prompt.trim() : '';
    if (!prompt) {
      throw new HttpError(400, 'prompt is required.');
    }

    if (typeof params.imageDataUrl !== 'string' || !params.imageDataUrl.trim()) {
      throw new HttpError(400, 'imageDataUrl is required.');
    }
    validateDataUrlFormat(params.imageDataUrl);

    const settings = aiManager.getSettings();
    if (!settings?.enabled) {
      throw new HttpError(503, 'AI is disabled in platform settings.');
    }

    const requestedModelId = typeof params.modelId === 'string' ? params.modelId.trim() : '';
    const { entry, usedFallback, requestedName } = resolveImageEditorOutputModel(settings, requestedModelId || undefined);

    const parsedImage = parseDataUrl(params.imageDataUrl, resolveMaxImageBytes(entry));
    if (!OPENAI_EDIT_MIME_TYPES.has(parsedImage.mime)) {
      throw new HttpError(400, 'Image format is not supported for AI editing.');
    }

    const providerConfig = resolveAiProviderConfig(settings, entry.provider);
    if (!providerConfig?.apiKey?.trim()) {
      throw new HttpError(503, `${entry.provider} provider is not configured.`);
    }

    const imageDataUrl = shouldUseDedicatedOpenAiImageApi(entry)
      ? await runOpenAiImageEditor({
        provider: entry.provider,
        apiKey: providerConfig.apiKey,
        baseUrl: entry.baseUrl ?? providerConfig.baseUrl,
        organizationId: providerConfig.organizationId,
        modelId: entry.modelId,
        deploymentName: entry.deploymentName,
        apiVersion: entry.apiVersion,
        prompt,
        imageBuffer: parsedImage.buffer,
        imageMime: parsedImage.mime,
        timeoutMs: entry.timeoutMs,
      })
      : shouldUseOpenAiResponsesImageApi(entry)
        ? await runOpenAiResponsesImageEditor({
          provider: entry.provider,
          apiKey: providerConfig.apiKey,
          baseUrl: entry.baseUrl ?? providerConfig.baseUrl,
          organizationId: providerConfig.organizationId,
          modelId: entry.modelId,
          deploymentName: entry.deploymentName,
          apiVersion: entry.apiVersion,
          prompt,
          imageDataUrl: params.imageDataUrl.trim(),
          timeoutMs: entry.timeoutMs,
        })
        : (() => {
          throw new HttpError(400, `Model "${entry.name}" cannot return edited images.`);
        })();

    const text = usedFallback && requestedName
      ? `Applied AI edit with ${entry.name} (${requestedName} cannot return edited images).`
      : 'Applied AI edit.';

    return {
      body: {
        text,
        imageDataUrl,
        modelId: entry.id,
        canApply: true,
      },
    };
  }
}
