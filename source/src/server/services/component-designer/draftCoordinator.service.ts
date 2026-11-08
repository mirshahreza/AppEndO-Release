import fs from 'fs';
import { resolveCanonicalDesignerDraftFolder } from '../../../shared/lib/designerShellEntry';
import { acquirePackageLock, releasePackageLock } from '../../../core/packages/PackageFileStore';
import {
  assertValidDocument,
  ensureDesignerStorageDirs,
  readDraftIndex,
  readDraftRecord,
  readDraftRecordByPath,
  removeDraftFromIndex,
  sanitizeDraftFolderName,
  sanitizeDraftId,
  toSummary,
  writeDraftFile,
  writeDraftIndex,
} from '../../domain/component-designer/draftIo';
import { draftJsonPath, resolveDraftJsonPath } from '../../domain/component-designer/draftFolderPaths';
import {
  purgeDraftStorageArtifacts,
  purgeDraftStorageArtifactsAtFolder,
  writeDesignerDraftTsxExport,
} from '../../domain/component-designer/draftTsxExport';
import { cleanupDesignerFolderDirectoriesIfEmpty } from '../../domain/component-designer/draftFolderCleanup';
import {
  assertPersistableDesignerDocument,
  prepareDesignerDocumentForPersist,
} from '../../../domain/component-designer/documentPersist';
import { resolveDesignerDocumentPageAccess } from '../../../domain/component-designer/designerPageAccess';
import type { DesignerDraftRecord, SaveDraftInput } from '../../domain/component-designer/draftTypes';
import {
  getBuiltInComponentRecord,
  isBuiltInComponentId,
} from '../../../domain/component-designer/layout-presets/builtInComponents';
import {
  disableDesignerLayoutRoutes,
  propagateDesignerLayoutRoutes,
} from '../platform/designerRoutePropagation.service';
import { purgeDesignerDraftResidues } from './designerDeleteCleanup';
import { syncInstalledPackageUiRuntimeFromDraftRecord } from '../package-runtime/packageUiCatalog.service';
import { ShellDesignerContractError } from '../../../shared/api/contracts/shell-designer/errors';
import type { DesignerBindingDefinition } from '../../../domain/component-designer/types';
import { normalizeCatalogTags } from '../../../shared/lib/catalogTags';
import {
  parseCatalogKind,
  resolveOperatorCatalogKind,
} from '../../../domain/component-designer/layout-presets/catalogSystemTags';

const DESIGNER_LOCK_NAME = 'component-designer-drafts';

const allocatePersistableDraftId = (requestedId: string, previousId?: string): string => {
  if (previousId && !isBuiltInComponentId(previousId)) {
    return sanitizeDraftId(previousId);
  }

  const sanitized = sanitizeDraftId(requestedId);
  if (!isBuiltInComponentId(sanitized)) {
    return sanitized;
  }

  return sanitizeDraftId(`draft-${sanitized.replace(/^builtin-/, '')}-${Date.now().toString(36)}`);
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const assertValidDraftPayload = (input: SaveDraftInput): void => {
  if (!input.name.trim()) {
    throw new Error('Draft name is required.');
  }

  assertValidDocument(input.document);

  if (!isRecord(input.bindingDefinitions)) {
    throw new Error('Binding definitions payload is invalid.');
  }
};

const normalizeRecord = (input: SaveDraftInput, previous?: DesignerDraftRecord): DesignerDraftRecord => {
  assertValidDraftPayload(input);

  const now = new Date().toISOString();
  const id = allocatePersistableDraftId(
    input.id ?? previous?.id ?? input.document.id ?? input.name,
    previous?.id,
  );
  const createdAt = previous?.metadata.createdAt ?? now;
  const createdBy = previous?.metadata.createdBy ?? input.actor;
  const folder = resolveCanonicalDesignerDraftFolder(
    input.folder !== undefined ? input.folder : previous?.folder,
  );
  const tags = input.tags !== undefined
    ? normalizeCatalogTags(input.tags)
    : (previous?.tags ?? []);
  const catalogKind = input.catalogKind !== undefined
    ? parseCatalogKind(input.catalogKind)
    : parseCatalogKind(previous?.catalogKind);
  const isManaged = input.document.metadata.shellDesigner?.owner === 'shell-designer'
    || input.document.metadata.creativeLanding?.owner === 'creative-landing'
    || previous?.document.metadata.shellDesigner?.owner === 'shell-designer'
    || previous?.document.metadata.creativeLanding?.owner === 'creative-landing';
  if (previous && isManaged && !input.preserveStateVersion && input.expectedStateVersion !== previous.metadata.stateVersion) {
    throw new ShellDesignerContractError(
      'SHELL_STALE_VERSION',
      'The Designer draft state version is missing or stale.',
      'expectedStateVersion',
    );
  }
  const stateVersion = isManaged
    ? (input.preserveStateVersion
      ? previous?.metadata.stateVersion
      : (previous?.metadata.stateVersion ?? 0) + 1)
    : previous?.metadata.stateVersion;

  return {
    schema: 'component-designer-draft',
    id,
    name: input.name.trim(),
    folder,
    catalogKind,
    tags,
    document: (() => {
      const document = prepareDesignerDocumentForPersist(input.document, {
        draftId: id,
        draftName: input.name.trim(),
      });
      assertPersistableDesignerDocument(document);
      return {
        ...document,
        metadata: {
          ...document.metadata,
          createdAt: previous?.document.metadata.createdAt ?? input.document.metadata.createdAt ?? createdAt,
          updatedAt: now,
        },
      };
    })(),
    bindingDefinitions: structuredClone(input.bindingDefinitions),
    workspace: input.workspace ?? previous?.workspace,
    metadata: {
      createdAt,
      updatedAt: now,
      createdBy,
      updatedBy: input.actor,
      stateVersion,
    },
  };
};

const withDraftLock = <T>(operation: () => T): T => {
  ensureDesignerStorageDirs();
  if (!acquirePackageLock(DESIGNER_LOCK_NAME)) {
    throw new Error('Component designer draft storage is busy.');
  }

  try {
    return operation();
  } finally {
    releasePackageLock(DESIGNER_LOCK_NAME);
  }
};

const saveDesignerDraftUnlocked = (input: SaveDraftInput): DesignerDraftRecord => {
  const existing = input.id ? readDraftRecord(input.id) : null;
  const record = normalizeRecord(input, existing ?? undefined);

  if (!existing) {
    const collisionPath = draftJsonPath(record.name, record.folder);
    if (fs.existsSync(collisionPath)) {
      const occupant = readDraftRecordByPath(collisionPath);
      if (occupant && occupant.id !== record.id) {
        throw new Error(`A component named "${record.name}" already exists.`);
      }
    }
  }

  writeDraftFile(record);
  writeDesignerDraftTsxExport(record);
  syncInstalledPackageUiRuntimeFromDraftRecord(record);

  if (existing) {
    const nameChanged = existing.name !== record.name;
    const folderChanged = sanitizeDraftFolderName(existing.folder) !== record.folder;

    if (nameChanged || folderChanged) {
      purgeDraftStorageArtifactsAtFolder({
        id: existing.id,
        name: existing.name,
        folder: existing.folder,
      });

      if (folderChanged) {
        cleanupDesignerFolderDirectoriesIfEmpty(existing.folder);
      }

      if (nameChanged) {
        void disableDesignerLayoutRoutes(existing.name).catch((error) => {
          console.error('Designer route disable failed:', error);
        });
      }
    }
  }

  const index = readDraftIndex();
  if (existing && existing.id !== record.id) {
    index.drafts = index.drafts.filter((item) => item.id !== existing.id);
  }
  const summary = toSummary(record);
  const draftIndex = index.drafts.findIndex((item) => item.id === record.id);
  if (draftIndex >= 0) {
    index.drafts[draftIndex] = summary;
  } else {
    index.drafts.push(summary);
  }
  writeDraftIndex(index);

  void propagateDesignerLayoutRoutes({
    slug: record.name,
    folder: record.folder,
    title: record.name,
    pageAccess: resolveDesignerDocumentPageAccess(record.document),
  }).catch((error) => {
    console.error('Designer route propagation failed:', error);
  });

  return record;
};

export const saveDesignerDraft = (input: SaveDraftInput): DesignerDraftRecord =>
  withDraftLock(() => saveDesignerDraftUnlocked(input));

export const renameDesignerDraft = (draftId: string, name: string, actor?: string): DesignerDraftRecord =>
  withDraftLock(() => {
    const existing = readDraftRecord(draftId);
    if (!existing) {
      throw new Error('Draft not found.');
    }

    return saveDesignerDraftUnlocked({
      id: existing.id,
      name,
      folder: existing.folder,
      catalogKind: existing.catalogKind,
      tags: existing.tags,
      document: existing.document,
      bindingDefinitions: structuredClone(existing.bindingDefinitions) as Record<string, DesignerBindingDefinition>,
      actor,
      expectedStateVersion: existing.metadata.stateVersion,
    });
  });

export const duplicateDesignerDraft = (
  draftId: string,
  name?: string,
  actor?: string,
  folder?: string,
  tags?: string[],
): DesignerDraftRecord =>
  withDraftLock(() => {
    const existing = readDraftRecord(draftId) ?? getBuiltInComponentRecord(draftId);
    if (!existing) {
      throw new Error('Draft not found.');
    }

    return saveDesignerDraftUnlocked({
      name: name?.trim() || `${existing.name} Copy`,
      folder: folder?.trim() ? sanitizeDraftFolderName(folder) : existing.folder,
      catalogKind: resolveOperatorCatalogKind({
        name: existing.name,
        folder: existing.folder,
        catalogKind: existing.catalogKind,
        isBuiltIn: isBuiltInComponentId(draftId),
      }),
      tags: tags !== undefined ? tags : existing.tags,
      document: {
        ...existing.document,
        id: `${existing.id}-copy`,
      },
      bindingDefinitions: structuredClone(existing.bindingDefinitions) as Record<string, DesignerBindingDefinition>,
      actor,
    });
  });

export const duplicateShellLayoutDraft = (
  sourceShellKey: string,
  targetShellKey: string,
  actor?: string,
): DesignerDraftRecord =>
  withDraftLock(() => {
    const source = readDraftRecordByPath(draftJsonPath(sourceShellKey.trim()));
    if (!source) {
      throw new Error(`Shell layout "${sourceShellKey}" not found.`);
    }

    return duplicateDesignerDraft(
      source.id,
      targetShellKey.trim(),
      actor,
    );
  });

export const deleteDesignerDraft = (draftId: string): boolean =>
  withDraftLock(() => {
    if (isBuiltInComponentId(draftId)) {
      return false;
    }

    const targetId = sanitizeDraftId(draftId);
    const indexFolder = readDraftIndex().drafts.find((item) => item.id === targetId)?.folder;
    const existing = readDraftRecord(targetId);
    const resolvedPath = resolveDraftJsonPath(targetId, indexFolder);
    const folderToCleanup = existing?.folder ?? indexFolder ?? 'general';
    const displayName = existing?.name ?? targetId;
    if (!existing && !resolvedPath) {
      purgeDesignerDraftResidues({ draftId: targetId, name: displayName, folder: folderToCleanup });
      return false;
    }

    if (existing) {
      purgeDraftStorageArtifacts(existing);
    } else {
      purgeDraftStorageArtifacts({ id: targetId, name: displayName, folder: folderToCleanup });
    }
    purgeDesignerDraftResidues({
      draftId: existing?.id ?? targetId,
      name: displayName,
      folder: folderToCleanup,
    });

    removeDraftFromIndex(targetId);
    cleanupDesignerFolderDirectoriesIfEmpty(folderToCleanup);

    return true;
  });
