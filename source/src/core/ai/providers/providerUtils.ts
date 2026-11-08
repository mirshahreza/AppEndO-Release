export type ProviderRuntimeConfig = {
  displayName: string;
  modelId: string;
  baseUrl?: string;
  apiKey?: string;
  apiVersion?: string;
  deploymentName?: string;
  organizationId?: string;
  timeoutMs?: number;
  /** Provider-specific API body overrides merged at request time. */
  requestParams?: Record<string, unknown>;
};

export const mergeRequestParams = (
  body: Record<string, unknown>,
  requestParams?: Record<string, unknown>,
): Record<string, unknown> => {
  if (!requestParams || Object.keys(requestParams).length === 0) {
    return body;
  }
  return { ...body, ...requestParams };
};

export const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs = 60000,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export const readResponseError = async (response: Response): Promise<string> => {
  const text = await response.text().catch(() => '');
  if (!text) return `${response.status} ${response.statusText}`;
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    if (typeof parsed.error === 'string') return parsed.error;
    if (parsed.error && typeof parsed.error === 'object' && parsed.error.message) {
      return parsed.error.message;
    }
    if (parsed.message) return parsed.message;
  } catch {
    // fall through
  }
  return text.slice(0, 240);
};
