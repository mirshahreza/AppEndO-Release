import fs from 'fs';
import path from 'path';
import { atomicWriteText } from '../../../core/runtime/RuntimeFileStore';
import { runtimeDirs } from '../../../core/runtime/runtimePaths';
import { generateDesignerTsx, generateDesignerTsxMeta, generateDesignerTypesTs } from '../../../domain/component-designer/codegen';
import {
  draftIdFromDesignerMetaContent,
  resolveDesignerComponentMetaPath,
} from '../../../domain/component-designer/designerComponentMetaSidecar';
import {
  draftCompanionMetaPath,
  draftCompanionTsxPath,
  draftCompanionTypesPath,
  draftExportDirectory,
  ensureDirectory,
  legacyIdBasedDraftCompanionTsxPath,
  legacyDraftCompanionTsxPath,
  listExportMetaFilePaths,
  listDraftJsonFilePathsForDraftId,
  removeDraftCompanionFiles,
  removeDraftJsonAndCompanionFiles,
  removeDraftSnapshotDirectories,
  sanitizeDraftFolderName,
} from './draftFolderPaths';
import { designerStoragePaths } from './storage';
import type { DesignerDraftRecord } from './draftTypes';

export { sanitizeComponentFileBaseName as sanitizeComponentExportFileName } from './draftFolderPaths';

export const DESIGNER_EXPORTS_DIR = designerStoragePaths.exports;

const readMetaDraftIds = (metaPath: string, draftId: string): boolean => {
  try {
    const content = fs.readFileSync(metaPath, 'utf8');
    return draftIdFromDesignerMetaContent(content, draftId);
  } catch {
    return false;
  }
};

/** Legacy `exports/` artifacts from before name-based draft storage. */
export const findLegacyExportFilesForDraftId = (draftId: string): string[] =>
  listExportMetaFilePaths()
    .filter((filePath) => readMetaDraftIds(filePath, draftId))
    .map((metaPath) => metaPath.replace(/\.meta\.json$/, '.tsx'))
    .filter((tsxPath) => fs.existsSync(tsxPath));

const findLegacyExportFilesForDraftIdInFolder = (draftId: string, folder: unknown): string[] => {
  const exportDirectory = draftExportDirectory(folder);
  if (!fs.existsSync(exportDirectory)) {
    return [];
  }

  return fs
    .readdirSync(exportDirectory)
    .filter((fileName) => fileName.endsWith('.meta.json'))
    .map((fileName) => path.join(exportDirectory, fileName))
    .filter((metaPath) => readMetaDraftIds(metaPath, draftId))
    .map((metaPath) => metaPath.replace(/\.meta\.json$/, '.tsx'))
    .filter((tsxPath) => fs.existsSync(tsxPath));
};

const writeTsxPair = (
  tsxPath: string,
  metaPath: string,
  record: DesignerDraftRecord,
): void => {
  const tsx = generateDesignerTsx(record.document, record.bindingDefinitions);
  const meta = generateDesignerTsxMeta(record.document, record.bindingDefinitions);
  const types = generateDesignerTypesTs(record.document, record.bindingDefinitions);

  atomicWriteText(tsxPath, tsx, runtimeDirs.workspaceTemp);
  atomicWriteText(metaPath, meta, runtimeDirs.workspaceTemp);
  atomicWriteText(draftCompanionTypesPath(record.name, record.folder), types, runtimeDirs.workspaceTemp);
};

const removeTsxArtifactPair = (tsxPath: string): void => {
  const metaPath = resolveDesignerComponentMetaPath(tsxPath);

  for (const candidate of [tsxPath, metaPath]) {
    try {
      if (fs.existsSync(candidate)) {
        fs.unlinkSync(candidate);
      }
    } catch {
      return;
    }
  }
};

const removeEmptyDesignerFolder = (directoryPath: string): void => {
  if (!fs.existsSync(directoryPath)) {
    return;
  }

  try {
    const entries = fs.readdirSync(directoryPath).filter((entry) => entry !== '.gitkeep');
    if (entries.length === 0) {
      fs.rmSync(directoryPath, { recursive: true, force: true });
    }
  } catch {
    return;
  }
};

export const writeDesignerDraftTsxExport = (
  record: DesignerDraftRecord,
): void => {
  ensureDirectory(path.dirname(draftCompanionTsxPath(record.name, record.folder)));

  const tsxPath = draftCompanionTsxPath(record.name, record.folder);
  const metaPath = draftCompanionMetaPath(record.name, record.folder);

  writeTsxPair(tsxPath, metaPath, record);
};

export const removeDesignerDraftTsxExport = (
  record: Pick<DesignerDraftRecord, 'id' | 'name' | 'folder'>,
): void => {
  removeDraftCompanionFiles(record);

  findLegacyExportFilesForDraftId(record.id).forEach((filePath) => {
    removeTsxArtifactPair(filePath);
  });
};

const removeLegacyIdBasedCompanionArtifacts = (
  record: Pick<DesignerDraftRecord, 'id' | 'folder'>,
): void => {
  removeTsxArtifactPair(legacyIdBasedDraftCompanionTsxPath(record.id, record.folder));
  removeTsxArtifactPair(legacyDraftCompanionTsxPath(record.id));
};

const unlinkDraftJsonStem = (jsonPath: string): void => {
  const stem = path.basename(jsonPath, '.json');
  const directory = path.dirname(jsonPath);
  unlinkIfExistsLocal(path.join(directory, `${stem}.json`));
  unlinkIfExistsLocal(path.join(directory, `${stem}.tsx`));
  unlinkIfExistsLocal(path.join(directory, `${stem}.meta.json`));
  unlinkIfExistsLocal(path.join(directory, `${stem}.types.ts`));
};

const unlinkIfExistsLocal = (filePath: string): void => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    return;
  }
};

const purgeLeftoverDraftJsonById = (draftId: string): void => {
  for (const jsonPath of listDraftJsonFilePathsForDraftId(draftId)) {
    unlinkDraftJsonStem(jsonPath);
  }
};

export const purgeDraftStorageArtifactsAtFolder = (
  record: Pick<DesignerDraftRecord, 'id' | 'name' | 'folder'>,
): void => {
  removeDraftJsonAndCompanionFiles(record);
  removeDraftSnapshotDirectories(record.id, record.folder);
  removeLegacyIdBasedCompanionArtifacts(record);
  findLegacyExportFilesForDraftIdInFolder(record.id, sanitizeDraftFolderName(record.folder)).forEach((filePath) => {
    removeTsxArtifactPair(filePath);
  });
};

export const purgeDraftStorageArtifacts = (
  record: Pick<DesignerDraftRecord, 'id' | 'name' | 'folder'>,
): void => {
  removeDraftJsonAndCompanionFiles(record);
  removeDraftSnapshotDirectories(record.id, record.folder);
  removeLegacyIdBasedCompanionArtifacts(record);
  findLegacyExportFilesForDraftId(record.id).forEach((filePath) => {
    removeTsxArtifactPair(filePath);
  });
  purgeLeftoverDraftJsonById(record.id);
};
