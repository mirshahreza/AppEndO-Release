import fs from 'fs';
import path from 'path';
import type { AccessAssistantPageManifest } from '../../../shared/api/contracts/access-assistant/types';

const PAGES_DIR = path.join(process.cwd(), 'workspace', 'access-assistant', 'pages');

const parseManifest = (raw: unknown, pageKey: string): AccessAssistantPageManifest | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const root = record.root as AccessAssistantPageManifest['root'] | undefined;
  if (!root || typeof root.surfaceId !== 'string' || !Array.isArray(root.functionIds)) {
    return null;
  }
  const linked = Array.isArray(record.linkedSurfaces)
    ? record.linkedSurfaces as AccessAssistantPageManifest['linkedSurfaces']
    : [];

  return {
    pageKey: typeof record.pageKey === 'string' ? record.pageKey : pageKey,
    root,
    linkedSurfaces: linked,
  };
};

export function readAccessAssistantPageManifest(pageKey: string): AccessAssistantPageManifest | null {
  const trimmed = pageKey.trim();
  if (!trimmed) {
    return null;
  }
  const filePath = path.join(PAGES_DIR, `${trimmed}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    return parseManifest(parsed, trimmed);
  } catch {
    return null;
  }
}

export function listAccessAssistantManifestFunctionIds(manifest: AccessAssistantPageManifest): string[] {
  const ids = new Set<string>();
  for (const id of manifest.root.functionIds) {
    ids.add(id);
  }
  for (const surface of manifest.linkedSurfaces) {
    for (const id of surface.functionIds) {
      ids.add(id);
    }
  }
  return [...ids];
}
