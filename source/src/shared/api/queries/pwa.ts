import { useQuery } from '@tanstack/react-query';
import type { PwaIconSlot } from '../../lib/pwaAssets';
import { mapPwaSettings } from '../contracts/settings/pwaMappers';
import { resolvePwaFaviconUrl, resolvePwaIcon192Url, type PwaSettings } from '../contracts/settings/pwa';
import { apiFetch, apiGet } from '../client';

export const pwaQueryKeys = {
  all: ['pwa'] as const,
  config: () => [...pwaQueryKeys.all, 'config'] as const,
};

export async function fetchPwaConfig(): Promise<PwaSettings> {
  const { data } = await apiGet<Partial<PwaSettings>>('/api/pwa/config');
  return mapPwaSettings(data);
}

export function usePwaConfigQuery() {
  return useQuery({
    queryKey: pwaQueryKeys.config(),
    queryFn: fetchPwaConfig,
    staleTime: 60_000,
  });
}

export async function uploadPwaIcon(slot: PwaIconSlot, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiFetch(`/api/pwa/icons/${slot}/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json() as {
    success?: boolean;
    error?: string;
    url?: string;
  };

  if (!response.ok || !data?.success || !data.url) {
    throw new Error(data?.error || 'Failed to upload PWA icon.');
  }

  return data.url;
}

export async function deletePwaIcon(slot: PwaIconSlot): Promise<void> {
  const response = await apiFetch(`/api/pwa/icons/${slot}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error || 'Failed to delete PWA icon.');
  }
}

export function applyPwaDocumentMeta(config: PwaSettings): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.title = config.name;

  const setMeta = (selector: string, attr: 'name' | 'property', key: string, value: string) => {
    let element = document.head.querySelector<HTMLMetaElement>(selector);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attr, key);
      document.head.appendChild(element);
    }
    element.setAttribute('content', value);
  };

  setMeta('meta[name="description"]', 'name', 'description', config.description);
  setMeta('meta[name="theme-color"]', 'name', 'theme-color', config.themeColor);
  setMeta('meta[name="apple-mobile-web-app-title"]', 'name', 'apple-mobile-web-app-title', config.shortName);

  const favicon = resolvePwaFaviconUrl(config);
  const icon192 = resolvePwaIcon192Url(config);

  document.head
    .querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')
    .forEach((node) => node.remove());

  const appendLink = (rel: string, href: string, sizes?: string, type?: string) => {
    const element = document.createElement('link');
    element.rel = rel;
    element.href = href;
    if (sizes) {
      element.sizes = sizes;
    }
    if (type) {
      element.type = type;
    }
    document.head.appendChild(element);
  };

  appendLink('icon', favicon, '32x32', 'image/png');
  appendLink('icon', icon192, '192x192', 'image/png');
  appendLink('apple-touch-icon', icon192);
}
