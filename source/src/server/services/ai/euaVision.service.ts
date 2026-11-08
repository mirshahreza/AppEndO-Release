import type { AiModelEntry, AiSettings } from '../../../shared/api/contracts/ai/types';
import { resolveAiProviderConfig } from '../../../shared/api/contracts/ai/validators';
import { HttpError } from '../../errors/HttpError';
import { aiManager } from '../../../core/ai/AiManager';
import { fetchWithTimeout } from '../../../core/ai/providers/providerUtils';
import { resolveEuaVisionModelId } from './euaSettingsResolver';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function parseDataUrl(imageDataUrl: string): { mime: string; base64: string } {
  const trimmed = imageDataUrl.trim();
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match?.[1] || !match[2]) {
    throw new HttpError(400, 'imageDataUrl must be a base64 data URL.');
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) {
    throw new HttpError(400, 'imageDataUrl is empty.');
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new HttpError(400, `Image exceeds ${MAX_IMAGE_BYTES} byte limit.`);
  }

  return { mime: match[1].toLowerCase(), base64: match[2] };
}

async function runGeminiVisionPrompt(
  entry: AiModelEntry,
  settings: AiSettings,
  imageDataUrl: string,
  prompt: string,
): Promise<string> {
  const providerConfig = resolveAiProviderConfig(settings, entry.provider);
  if (!providerConfig?.apiKey?.trim()) {
    throw new HttpError(503, `${entry.provider} provider is not configured.`);
  }

  const baseUrl = (entry.baseUrl ?? providerConfig.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
  const modelId = entry.deploymentName?.trim() || entry.modelId;
  const { mime, base64 } = parseDataUrl(imageDataUrl);

  const response = await fetchWithTimeout(
    `${baseUrl}/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(providerConfig.apiKey.trim())}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mime, data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0.2 },
      }),
    },
    entry.timeoutMs ?? 90000,
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new HttpError(502, detail || 'Vision request failed.');
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
  if (!text) {
    throw new HttpError(502, 'Vision model returned empty text.');
  }
  return text;
}

async function runOllamaVisionPrompt(
  entry: AiModelEntry,
  settings: AiSettings,
  imageDataUrl: string,
  prompt: string,
): Promise<string> {
  const providerConfig = resolveAiProviderConfig(settings, entry.provider);
  const baseUrl = (entry.baseUrl ?? providerConfig?.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '');
  const { base64 } = parseDataUrl(imageDataUrl);

  const response = await fetchWithTimeout(
    `${baseUrl}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: entry.modelId,
        stream: false,
        messages: [{ role: 'user', content: prompt, images: [base64] }],
      }),
    },
    entry.timeoutMs ?? 90000,
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new HttpError(502, detail || 'Vision request failed.');
  }

  const data = await response.json() as { message?: { content?: string } };
  const text = data.message?.content?.trim();
  if (!text) {
    throw new HttpError(502, 'Vision model returned empty text.');
  }
  return text;
}

async function runOpenAiVisionPrompt(
  entry: AiModelEntry,
  settings: AiSettings,
  imageDataUrl: string,
  prompt: string,
): Promise<string> {
  const providerConfig = resolveAiProviderConfig(settings, entry.provider);
  if (!providerConfig?.apiKey?.trim()) {
    throw new HttpError(503, `${entry.provider} provider is not configured.`);
  }

  const baseUrl = (entry.baseUrl ?? providerConfig.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${providerConfig.apiKey.trim()}`,
    'Content-Type': 'application/json',
  };
  if (providerConfig.organizationId?.trim()) {
    headers['OpenAI-Organization'] = providerConfig.organizationId.trim();
  }

  const response = await fetchWithTimeout(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: entry.deploymentName?.trim() || entry.modelId,
        temperature: 0.2,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageDataUrl.trim() } },
          ],
        }],
      }),
    },
    entry.timeoutMs ?? 90000,
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new HttpError(502, detail || 'Vision request failed.');
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new HttpError(502, 'Vision model returned empty text.');
  }
  return text;
}

export class EuaVisionService {
  async runImageTask(params: {
    imageDataUrl: string;
    systemPrompt: string;
    userPrompt: string;
    modelId?: string;
  }): Promise<{ text: string; modelId: string }> {
    const settings = aiManager.getSettings();
    if (!settings?.enabled) {
      throw new HttpError(503, 'AI is disabled in platform settings.');
    }

    const resolvedModelId = resolveEuaVisionModelId(settings, params.modelId);
    if (!resolvedModelId) {
      throw new HttpError(503, 'No vision-capable AI model is configured.');
    }

    const entry = settings.models.find((model) => model.id === resolvedModelId);
    if (!entry?.enabled) {
      throw new HttpError(503, 'Vision model is not enabled.');
    }

    const prompt = `${params.systemPrompt.trim()}\n\n${params.userPrompt.trim()}`;
    const provider = entry.provider;

    const text = provider === 'google-gemini'
      ? await runGeminiVisionPrompt(entry, settings, params.imageDataUrl, prompt)
      : provider === 'ollama'
        ? await runOllamaVisionPrompt(entry, settings, params.imageDataUrl, prompt)
        : await runOpenAiVisionPrompt(entry, settings, params.imageDataUrl, prompt);

    return { text, modelId: resolvedModelId };
  }
}
