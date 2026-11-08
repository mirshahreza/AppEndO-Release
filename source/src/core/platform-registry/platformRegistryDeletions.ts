import fs from 'fs';
import path from 'path';
import { atomicWriteText } from '../runtime/RuntimeFileStore';
import { platformRegistryDirs } from './platformRegistryPaths';

export const PLATFORM_REGISTRY_ENTITY_DIRS = [
  'mounts',
  'shells',
  'page-modules',
  'shell-rules',
  'route-bindings',
  'navigation',
] as const;

export type PlatformRegistryEntityDir = (typeof PLATFORM_REGISTRY_ENTITY_DIRS)[number];

const PLATFORM_REGISTRY_DEFAULTS_ROOT = path.join(process.cwd(), 'src/config/platform-registry');

/** Built-ins that the operator cannot delete — boot may restore them if the file is missing. */
const PROTECTED_REGISTRY_IDS: Record<PlatformRegistryEntityDir, ReadonlySet<string>> = {
  mounts: new Set(['studio']),
  shells: new Set(['home-shell', 'studio', 'component-alone']),
  'page-modules': new Set(),
  'shell-rules': new Set(),
  'route-bindings': new Set(),
  navigation: new Set(['studio']),
};

type PlatformRegistryDeletionsFile = {
  schema: 'platform-registry-deletions';
  ids: Partial<Record<PlatformRegistryEntityDir, string[]>>;
};

function deletionsFilePath(): string {
  return path.join(platformRegistryDirs.root, 'deleted.json');
}

function isEntityDir(value: string): value is PlatformRegistryEntityDir {
  return (PLATFORM_REGISTRY_ENTITY_DIRS as readonly string[]).includes(value);
}

function readDeletionsFile(): PlatformRegistryDeletionsFile {
  const filePath = deletionsFilePath();
  if (!fs.existsSync(filePath)) {
    return { schema: 'platform-registry-deletions', ids: {} };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as PlatformRegistryDeletionsFile;
    if (parsed?.schema !== 'platform-registry-deletions' || typeof parsed.ids !== 'object' || parsed.ids == null) {
      return { schema: 'platform-registry-deletions', ids: {} };
    }
    return { schema: 'platform-registry-deletions', ids: parsed.ids };
  } catch {
    return { schema: 'platform-registry-deletions', ids: {} };
  }
}

function writeDeletionsFile(value: PlatformRegistryDeletionsFile): void {
  fs.mkdirSync(platformRegistryDirs.root, { recursive: true });
  atomicWriteText(
    deletionsFilePath(),
    `${JSON.stringify(value, null, 2)}\n`,
    platformRegistryDirs.tmp,
  );
}

function hasShippedDefault(kind: PlatformRegistryEntityDir, id: string): boolean {
  return fs.existsSync(path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, kind, `${id}.json`));
}

export function isProtectedRegistryEntity(kind: string, id: string): boolean {
  if (!isEntityDir(kind)) {
    return false;
  }
  return PROTECTED_REGISTRY_IDS[kind].has(id.trim());
}

export function isRegistryEntityDeleted(kind: string, id: string): boolean {
  if (!isEntityDir(kind)) {
    return false;
  }
  const normalized = id.trim();
  if (!normalized || isProtectedRegistryEntity(kind, normalized)) {
    return false;
  }
  const ids = readDeletionsFile().ids[kind] ?? [];
  return ids.includes(normalized);
}

/** Remember an operator delete of a shipped default so boot/sync cannot resurrect it. */
export function markRegistryEntityDeleted(kind: string, id: string): void {
  if (!isEntityDir(kind)) {
    return;
  }
  const normalized = id.trim();
  if (!normalized || isProtectedRegistryEntity(kind, normalized) || !hasShippedDefault(kind, normalized)) {
    return;
  }
  if (isRegistryEntityDeleted(kind, normalized)) {
    return;
  }

  const current = readDeletionsFile();
  const nextIds = [...(current.ids[kind] ?? []), normalized].sort();
  writeDeletionsFile({
    schema: 'platform-registry-deletions',
    ids: { ...current.ids, [kind]: nextIds },
  });
}

/** Recreating the same id clears the tombstone so the record is live again. */
export function clearRegistryEntityDeleted(kind: string, id: string): void {
  if (!isEntityDir(kind)) {
    return;
  }
  const normalized = id.trim();
  if (!normalized) {
    return;
  }

  const current = readDeletionsFile();
  const existing = current.ids[kind] ?? [];
  if (!existing.includes(normalized)) {
    return;
  }

  const nextIds = existing.filter((item) => item !== normalized);
  const next: PlatformRegistryDeletionsFile = {
    schema: 'platform-registry-deletions',
    ids: { ...current.ids },
  };
  if (nextIds.length === 0) {
    delete next.ids[kind];
  } else {
    next.ids[kind] = nextIds;
  }
  writeDeletionsFile(next);
}
