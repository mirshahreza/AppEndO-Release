import type { ServerFunctionItem } from '../types';
import { sanitizeLatinSlugInput } from '../../../shared/lib/latinSlug';

export function normalizeServerFunctionFolder(folder: string): string {
  return sanitizeLatinSlugInput(folder.trim());
}

export function normalizeServerFunctionName(name: string): string {
  return sanitizeLatinSlugInput(name.trim());
}

export function isServerFunctionIdentityTaken(
  functions: ServerFunctionItem[],
  folder: string,
  name: string,
  excludeId?: string,
): boolean {
  const folderSlug = normalizeServerFunctionFolder(folder);
  const nameSlug = normalizeServerFunctionName(name);
  return functions.some(
    (fn) => (excludeId ? fn.id !== excludeId : true)
      && normalizeServerFunctionFolder(fn.folder) === folderSlug
      && normalizeServerFunctionName(fn.name) === nameSlug,
  );
}

export function suggestDuplicateServerFunctionName(
  folder: string,
  baseName: string,
  functions: ServerFunctionItem[],
): string {
  const folderSlug = normalizeServerFunctionFolder(folder);
  const normalizedBase = normalizeServerFunctionName(baseName);
  const isTaken = (name: string) => functions.some(
    (fn) => normalizeServerFunctionFolder(fn.folder) === folderSlug
      && normalizeServerFunctionName(fn.name) === name,
  );

  const primary = `${normalizedBase}-copy`;
  if (!isTaken(primary)) {
    return primary;
  }

  for (let index = 2; index < 100; index += 1) {
    const candidate = `${normalizedBase}-copy-${index}`;
    if (!isTaken(candidate)) {
      return candidate;
    }
  }

  return `${normalizedBase}-copy-${Date.now().toString(36)}`;
}

export function buildServerFunctionPreviewPath(folder: string, name: string): string {
  const folderSlug = normalizeServerFunctionFolder(folder) || 'general';
  const nameSlug = normalizeServerFunctionName(name) || 'action-name';
  return `/api/${folderSlug}/${nameSlug}`;
}

/** Flat catalog path for new custom APIs (folder remains storage-only as `general`). */
export function buildServerFunctionCatalogPath(name: string): string {
  const nameSlug = normalizeServerFunctionName(name) || 'action-name';
  return `/api/${nameSlug}`;
}
