import type { PackageRepackDescriptionMode } from '../api/contracts/package/repack';

export const PACKAGE_DESCRIPTION_MAX_LENGTH = 1000;

function formatAppendBlock(version: string, nextDescription: string): string {
  const trimmedVersion = version.trim();
  const next = nextDescription.trim();
  return `v${trimmedVersion}\n\n${next}`;
}

export function resolveRepackDescriptionText(
  baseDescription: string | undefined,
  version: string,
  nextDescription: string | undefined,
  mode: PackageRepackDescriptionMode,
): string | undefined {
  const base = baseDescription?.trim() || '';
  const next = nextDescription?.trim() || '';

  if (mode === 'append') {
    if (!next) return base || undefined;
    const appendBlock = formatAppendBlock(version, next);
    if (!base) return appendBlock;
    return `${base}\n\n${appendBlock}`;
  }

  if (next) return next;
  return base || undefined;
}
