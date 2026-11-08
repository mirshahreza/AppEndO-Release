import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';

export type PackageInstallHookExportZipEntry = {
  path: string;
  content: Buffer;
};

export type PackageInstallHookExportResult = {
  capability: PackageManifest['capabilities']['install_hooks'][number];
  zipEntry: PackageInstallHookExportZipEntry;
};

/**
 * Wraps author-provided hook TS source text into a manifest capability entry + zip entry.
 * There is no discovery mechanism (unlike managed functions or edge data) — install hooks are
 * hand-authored, so the caller supplies the source directly (e.g. from a builder-UI text input
 * or a file on disk for scripted package builds).
 */
export function buildPackageInstallHookExportEntry(input: {
  id: string;
  source: string;
  timeoutMs?: number;
}): PackageInstallHookExportResult {
  const entry = `hooks/${input.id}.ts`;
  return {
    capability: { id: input.id, entry, timeoutMs: input.timeoutMs },
    zipEntry: { path: entry, content: Buffer.from(input.source, 'utf8') },
  };
}
