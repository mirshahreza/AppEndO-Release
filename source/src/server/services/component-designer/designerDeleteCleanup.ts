import fs from 'fs';
import path from 'path';
import {
  deletePageModuleFile,
  deleteRouteBindingFile,
  listPageModuleFiles,
  listRouteBindingFiles,
} from '../../../core/platform-registry/PlatformRegistryFileStore';
import { listDesignerDrafts } from '../../domain/component-designer/draftIo';
import { removeDraftSnapshotDirectories } from '../../domain/component-designer/draftFolderPaths';
import { designerStoragePaths } from '../../domain/component-designer/storage';
import {
  listDesignerPublishEntriesForDraft,
  readDesignerPublishIndex,
  removeDesignerPublishEntriesForDraft,
  removeDesignerStagingTokensForDraft,
  writeDesignerPublishIndex,
} from '../../domain/component-designer/publishIo';
import {
  canonicalizeDesignerItemSlug,
  parseDesignerComponentPath,
} from '../../../shared/lib/designerComponentPath';
import { DESIGNER_ROUTE_SOURCE } from '../platform/designerRoutePropagation.service';
import { invalidatePlatformRuntimeConfig } from '../platform/platformRuntimeConfig.service';

const addCanonicalPageKey = (keys: Set<string>, value?: string): void => {
  const slug = canonicalizeDesignerItemSlug(value ?? '');
  if (slug) {
    keys.add(slug);
  }
};

export const collectDesignerResiduePageKeys = (input: {
  draftId: string;
  name?: string;
}): string[] => {
  const keys = new Set<string>();
  addCanonicalPageKey(keys, input.draftId);
  addCanonicalPageKey(keys, input.name);
  for (const { componentPath, entry } of listDesignerPublishEntriesForDraft(input.draftId)) {
    addCanonicalPageKey(keys, componentPath);
    addCanonicalPageKey(keys, entry.componentPath);
    const parsed = parseDesignerComponentPath(componentPath);
    if (parsed) {
      addCanonicalPageKey(keys, parsed.componentName);
    }
  }
  return [...keys];
};

const removeDesignerRoutesForPageKeys = (pageKeys: readonly string[]): void => {
  let changed = false;
  const wanted = new Set(pageKeys);
  for (const binding of listRouteBindingFiles()) {
    if (!wanted.has(binding.pageKey) || binding.source !== DESIGNER_ROUTE_SOURCE) {
      continue;
    }
    deleteRouteBindingFile(binding.id);
    changed = true;
  }
  for (const pageModule of listPageModuleFiles()) {
    if (!wanted.has(pageModule.pageKey) || pageModule.source !== DESIGNER_ROUTE_SOURCE) {
      continue;
    }
    deletePageModuleFile(pageModule.pageKey);
    changed = true;
  }
  if (changed) {
    invalidatePlatformRuntimeConfig();
  }
};

export const purgeDesignerDraftResidues = (input: {
  draftId: string;
  name?: string;
  folder?: string;
}): void => {
  const pageKeys = collectDesignerResiduePageKeys(input);
  removeDraftSnapshotDirectories(input.draftId, input.folder ?? 'general');
  removeDesignerPublishEntriesForDraft(input.draftId);
  removeDesignerStagingTokensForDraft(input.draftId);
  removeDesignerRoutesForPageKeys(pageKeys);
};

const pruneOrphanDesignerSnapshots = (liveDraftIds: ReadonlySet<string>): number => {
  const snapshotsRoot = designerStoragePaths.snapshots;
  if (!fs.existsSync(snapshotsRoot)) {
    return 0;
  }

  let removed = 0;
  for (const folderEntry of fs.readdirSync(snapshotsRoot, { withFileTypes: true })) {
    if (!folderEntry.isDirectory()) {
      continue;
    }
    const folderPath = path.join(snapshotsRoot, folderEntry.name);
    for (const draftEntry of fs.readdirSync(folderPath, { withFileTypes: true })) {
      if (!draftEntry.isDirectory()) {
        continue;
      }
      if (liveDraftIds.has(draftEntry.name)) {
        continue;
      }
      fs.rmSync(path.join(folderPath, draftEntry.name), { recursive: true, force: true });
      removed += 1;
    }
    const leftover = fs.existsSync(folderPath)
      ? fs.readdirSync(folderPath).filter((name) => name !== '.gitkeep')
      : [];
    if (leftover.length === 0 && fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true, force: true });
    }
  }
  return removed;
};

const pruneOrphanDesignerPublishEntries = (liveDraftIds: ReadonlySet<string>): number => {
  const index = readDesignerPublishIndex();
  let removed = 0;
  for (const [componentPath, entry] of Object.entries(index.components)) {
    if (liveDraftIds.has(entry.draftId)) {
      continue;
    }
    delete index.components[componentPath];
    removed += 1;
  }
  if (removed > 0) {
    writeDesignerPublishIndex(index);
  }
  return removed;
};

const pruneOrphanDesignerPageModules = (livePageKeys: ReadonlySet<string>): void => {
  const leftoverKeys = listPageModuleFiles()
    .filter((pageModule) => (
      pageModule.loaderKind === 'designer'
      && pageModule.source === DESIGNER_ROUTE_SOURCE
      && !livePageKeys.has(pageModule.pageKey)
    ))
    .map((pageModule) => pageModule.pageKey);
  removeDesignerRoutesForPageKeys(leftoverKeys);
};

export const reconcileDeletedDesignerArtifacts = (): void => {
  const drafts = listDesignerDrafts();
  const liveDraftIds = new Set(drafts.map((draft) => draft.id));
  const livePageKeys = new Set<string>();
  for (const draft of drafts) {
    addCanonicalPageKey(livePageKeys, draft.id);
    addCanonicalPageKey(livePageKeys, draft.name);
  }

  pruneOrphanDesignerSnapshots(liveDraftIds);
  pruneOrphanDesignerPublishEntries(liveDraftIds);
  pruneOrphanDesignerPageModules(livePageKeys);
};
