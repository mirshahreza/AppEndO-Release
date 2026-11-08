import type { DesignerBindingDefinition } from './types';

const URL_PARAM_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;

export const extractUrlTemplateParamNames = (template: string): string[] => {
  const names = new Set<string>();
  for (const match of template.matchAll(URL_PARAM_PATTERN)) {
    const name = match[1]?.trim();
    if (name) {
      names.add(name);
    }
  }
  return Array.from(names);
};

const extractTemplateParamNamesFromHeaders = (
  headers: Record<string, string> | undefined,
): string[] => {
  if (!headers) {
    return [];
  }

  const names = new Set<string>();
  for (const value of Object.values(headers)) {
    for (const name of extractUrlTemplateParamNames(value)) {
      names.add(name);
    }
  }
  return Array.from(names);
};

export const collectTemplateParamNames = (
  endpointTemplate: string,
  headers?: Record<string, string>,
): string[] => {
  const names = new Set<string>([
    ...extractUrlTemplateParamNames(endpointTemplate),
    ...extractTemplateParamNamesFromHeaders(headers),
  ]);
  return Array.from(names);
};

export const resolveBindingRequestHeaders = (
  definition: DesignerBindingDefinition,
): Record<string, string> => {
  const headers = definition.requestConfig?.headers;
  if (!headers) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(headers).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
  ) as Record<string, string>;
};

export const resolveBindingUrlParams = (
  definition: DesignerBindingDefinition,
): Record<string, string> => {
  if (!definition.urlParams) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(definition.urlParams).filter(
      ([key, value]) => key.trim().length > 0 && typeof value === 'string' && value.trim().length > 0,
    ),
  ) as Record<string, string>;
};

export const isNestedPayloadPath = (path: string): boolean => path.includes('.');

export const createFetchConfigKey = (
  endpointTemplate: string,
  urlParams: Record<string, string>,
  headers: Record<string, string>,
): string => JSON.stringify({ endpointTemplate, urlParams, headers });
