import type { DesignerLovOption } from './useDesignerLovOptions';

const lovOptionsByEndpoint = new Map<string, DesignerLovOption[]>();

export const readDesignerLovOptionsCache = (endpoint: string): DesignerLovOption[] | undefined => {
  const key = endpoint.trim();
  if (!key) {
    return undefined;
  }
  return lovOptionsByEndpoint.get(key);
};

export const writeDesignerLovOptionsCache = (endpoint: string, options: DesignerLovOption[]): void => {
  const key = endpoint.trim();
  if (!key) {
    return;
  }
  lovOptionsByEndpoint.set(key, options);
};

export const clearDesignerLovOptionsCache = (): void => {
  lovOptionsByEndpoint.clear();
};
