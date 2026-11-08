import fs from 'fs';
import path from 'path';
import {
  draftExportDirectory,
  draftFolderDirectory,
  sanitizeDraftFolderName,
} from './draftFolderPaths';
import { listDesignerDrafts } from './draftIo';
import { designerStoragePaths } from './storage';

const isIgnorableDirectoryEntry = (entryName: string): boolean => entryName === '.gitkeep';

const isDirectoryEmptyForCleanup = (directoryPath: string): boolean => {
  if (!fs.existsSync(directoryPath)) {
    return true;
  }

  const stat = fs.statSync(directoryPath);
  if (!stat.isDirectory()) {
    return false;
  }

  const entries = fs.readdirSync(directoryPath).filter((entry) => !isIgnorableDirectoryEntry(entry));
  return entries.length === 0;
};

const removeDirectoryIfEmpty = (directoryPath: string): void => {
  if (!isDirectoryEmptyForCleanup(directoryPath)) {
    return;
  }

  try {
    fs.rmSync(directoryPath, { recursive: true, force: true });
  } catch {
    return;
  }
};

export const countDesignerDraftsInFolder = (folder: unknown): number => {
  const normalizedFolder = sanitizeDraftFolderName(folder);
  return listDesignerDrafts().filter(
    (draft) => sanitizeDraftFolderName(draft.folder) === normalizedFolder,
  ).length;
};

export const cleanupDesignerFolderDirectoriesIfEmpty = (folder: unknown): void => {
  const normalizedFolder = sanitizeDraftFolderName(folder);

  if (countDesignerDraftsInFolder(normalizedFolder) > 0) {
    return;
  }

  removeDirectoryIfEmpty(path.join(designerStoragePaths.drafts, normalizedFolder));
  removeDirectoryIfEmpty(draftFolderDirectory(normalizedFolder));
  removeDirectoryIfEmpty(path.join(designerStoragePaths.exports, normalizedFolder));
  removeDirectoryIfEmpty(draftExportDirectory(normalizedFolder));
  removeDirectoryIfEmpty(path.join(designerStoragePaths.snapshots, normalizedFolder));
};
