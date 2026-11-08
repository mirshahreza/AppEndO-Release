import {
  validateNavigationManifest,
  type NavigationManifest,
} from '../../../shared/api/contracts/platform/navigation';

export function serializeNavigationManifest(manifest: NavigationManifest): string {
  return JSON.stringify(manifest, null, 2);
}

export type NavigationManifestJsonParseResult =
  | { ok: true; manifest: NavigationManifest }
  | { ok: false; error: string };

export function parseNavigationManifestJson(
  text: string,
  expectedId?: string | null,
): NavigationManifestJsonParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: 'Navigation manifest JSON cannot be empty.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: 'Invalid JSON syntax.' };
  }

  const validation = validateNavigationManifest(parsed);
  if (!validation.valid) {
    return { ok: false, error: validation.errors.join('\n') };
  }

  const normalizedId = expectedId?.trim();
  if (normalizedId && validation.manifest.id !== normalizedId) {
    return {
      ok: false,
      error: `Manifest id must remain "${normalizedId}".`,
    };
  }

  return { ok: true, manifest: validation.manifest };
}
