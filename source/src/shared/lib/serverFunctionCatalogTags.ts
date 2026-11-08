import type { ServerFunctionMetadataJson } from '../api/contracts/server-functions/types';
import { normalizeCatalogTags } from './catalogTags';

export function readServerFunctionCatalogTags(
  metadata: ServerFunctionMetadataJson | null | undefined,
): string[] {
  return normalizeCatalogTags(metadata?.catalogTags);
}

export function withServerFunctionCatalogTags(
  metadata: ServerFunctionMetadataJson | null | undefined,
  tags: string[],
): ServerFunctionMetadataJson {
  const nextTags = normalizeCatalogTags(tags);
  const base: ServerFunctionMetadataJson = metadata && typeof metadata === 'object'
    ? { ...metadata }
    : {};
  if (nextTags.length === 0) {
    delete base.catalogTags;
    return base;
  }
  return { ...base, catalogTags: nextTags };
}
