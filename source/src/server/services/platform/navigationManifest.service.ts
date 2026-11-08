import {
  deleteNavigationFile,
  listNavigationFiles,
  listShellFiles,
  readNavigationFile,
  writeNavigationFile,
  writeShellFile,
} from '../../../core/platform-registry/PlatformRegistryFileStore';
import {
  compareNavigationManifestSummaries,
  isBuiltInNavigationId,
  navigationBelongsToPortal,
  toNavigationManifestSummary,
  validateNavigationManifest,
  type NavigationManifest,
  type NavigationManifestSummary,
} from '../../../shared/api/contracts/platform/navigation';
import { validateLatinSlug } from '../../../shared/lib/latinSlug';
import { invalidatePlatformRuntimeConfig } from './platformRuntimeConfig.service';

export type NavigationManifestMutationResult =
  | { ok: true; manifest: NavigationManifestSummary }
  | { ok: false; statusCode: number; error: string; errors?: string[] };

export function listNavigationManifestSummaries(
  portalSegment?: string,
): NavigationManifestSummary[] {
  const normalizedSegment = portalSegment?.trim();
  return listNavigationFiles()
    .filter((manifest) => {
      if (!normalizedSegment) {
        return true;
      }
      return navigationBelongsToPortal(manifest, normalizedSegment);
    })
    .map(toNavigationManifestSummary)
    .sort(compareNavigationManifestSummaries);
}

export function getNavigationManifestSummary(id: string): NavigationManifestSummary | null {
  const manifest = readNavigationFile(id.trim());
  return manifest ? toNavigationManifestSummary(manifest) : null;
}

export async function createNavigationManifest(
  input: unknown,
): Promise<NavigationManifestMutationResult> {
  const validation = validateNavigationManifest(input);
  if (!validation.valid) {
    return { ok: false, statusCode: 400, error: 'Invalid navigation manifest.', errors: validation.errors };
  }

  const manifest = validation.manifest;
  if (isBuiltInNavigationId(manifest.id)) {
    return {
      ok: false,
      statusCode: 403,
      error: `Navigation "${manifest.id}" is built-in and cannot be created via the UI.`,
    };
  }

  if (!manifest.portalSegment?.trim()) {
    return {
      ok: false,
      statusCode: 400,
      error: 'portalSegment is required. Navigations belong to a portal.',
    };
  }

  if (readNavigationFile(manifest.id)) {
    return {
      ok: false,
      statusCode: 409,
      error: `Navigation "${manifest.id}" already exists.`,
    };
  }

  writeNavigationFile(manifest);
  await invalidatePlatformRuntimeConfig();

  return { ok: true, manifest: toNavigationManifestSummary(manifest) };
}

export async function updateNavigationManifest(
  id: string,
  input: unknown,
): Promise<NavigationManifestMutationResult> {
  const normalizedId = id.trim();
  const existing = readNavigationFile(normalizedId);
  if (!existing) {
    return { ok: false, statusCode: 404, error: `Navigation "${normalizedId}" not found.` };
  }

  const validation = validateNavigationManifest(input);
  if (!validation.valid) {
    return { ok: false, statusCode: 400, error: 'Invalid navigation manifest.', errors: validation.errors };
  }

  if (validation.manifest.id !== normalizedId) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Navigation id cannot be changed. Delete and recreate instead.',
    };
  }

  writeNavigationFile(validation.manifest);
  await invalidatePlatformRuntimeConfig();

  return { ok: true, manifest: toNavigationManifestSummary(validation.manifest) };
}

export async function renameNavigationManifest(
  oldId: string,
  newId: string,
): Promise<NavigationManifestMutationResult> {
  const normalizedOld = oldId.trim();
  const normalizedNew = newId.trim();

  if (!normalizedNew) {
    return { ok: false, statusCode: 400, error: 'Navigation id is required.' };
  }

  if (normalizedOld === normalizedNew) {
    const unchanged = readNavigationFile(normalizedOld);
    if (!unchanged) {
      return { ok: false, statusCode: 404, error: `Navigation "${normalizedOld}" not found.` };
    }
    return { ok: true, manifest: toNavigationManifestSummary(unchanged) };
  }

  if (isBuiltInNavigationId(normalizedOld)) {
    return {
      ok: false,
      statusCode: 403,
      error: `Navigation "${normalizedOld}" is built-in and cannot be renamed via the UI.`,
    };
  }

  const existing = readNavigationFile(normalizedOld);
  if (!existing) {
    return { ok: false, statusCode: 404, error: `Navigation "${normalizedOld}" not found.` };
  }

  const slugError = validateLatinSlug(normalizedNew, { fieldLabel: 'Navigation id' });
  if (slugError) {
    return { ok: false, statusCode: 400, error: slugError };
  }

  if (readNavigationFile(normalizedNew)) {
    return {
      ok: false,
      statusCode: 409,
      error: `Navigation "${normalizedNew}" already exists.`,
    };
  }

  const renamed: NavigationManifest = { ...existing, id: normalizedNew };
  writeNavigationFile(renamed);

  for (const shell of listShellFiles()) {
    if (shell.navigationRef?.trim() === normalizedOld) {
      writeShellFile({ ...shell, navigationRef: normalizedNew });
    }
  }

  deleteNavigationFile(normalizedOld);
  await invalidatePlatformRuntimeConfig();

  return { ok: true, manifest: toNavigationManifestSummary(renamed) };
}

export type DeleteNavigationManifestOptions = {
  /** Shell navigationRef after detach. Omit or null clears the ref. */
  replacementNavigationRef?: string | null;
};

export async function deleteNavigationManifest(
  id: string,
  options?: DeleteNavigationManifestOptions,
): Promise<NavigationManifestMutationResult> {
  const normalizedId = id.trim();
  const existing = readNavigationFile(normalizedId);
  if (!existing) {
    deleteNavigationFile(normalizedId);
    await invalidatePlatformRuntimeConfig();
    return {
      ok: true,
      manifest: toNavigationManifestSummary({
        id: normalizedId,
        version: '1',
        groups: [],
      }),
    };
  }

  if (isBuiltInNavigationId(normalizedId)) {
    return {
      ok: false,
      statusCode: 403,
      error: `Navigation "${normalizedId}" is built-in and cannot be deleted via the UI.`,
    };
  }

  const replacement = options?.replacementNavigationRef === undefined
    ? null
    : (typeof options.replacementNavigationRef === 'string'
      ? options.replacementNavigationRef.trim() || null
      : null);

  if (replacement) {
    if (replacement === normalizedId) {
      return {
        ok: false,
        statusCode: 400,
        error: 'replacementNavigationRef cannot be the navigation being deleted.',
      };
    }
    if (!readNavigationFile(replacement)) {
      return {
        ok: false,
        statusCode: 400,
        error: `Replacement navigation "${replacement}" not found.`,
      };
    }
  }

  for (const shell of listShellFiles()) {
    if (shell.navigationRef?.trim() === normalizedId) {
      writeShellFile({ ...shell, navigationRef: replacement });
    }
  }

  deleteNavigationFile(normalizedId);
  await invalidatePlatformRuntimeConfig();

  return { ok: true, manifest: toNavigationManifestSummary(existing) };
}
