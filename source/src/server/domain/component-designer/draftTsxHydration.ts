import fs from 'fs';
import path from 'path';
import { documentLostContentComparedTo, parseDesignerJson, syncCodeToCanvas } from '../../../domain/component-designer/codegen';
import { resolveDesignerComponentMetaPath } from '../../../domain/component-designer/designerComponentMetaSidecar';
import {
  draftCompanionMetaPath,
  draftCompanionTsxPath,
  draftJsonPath,
  legacyDraftCompanionTsxPath,
  legacyIdBasedDraftCompanionTsxPath,
} from './draftFolderPaths';
import { findLegacyExportFilesForDraftId } from './draftTsxExport';
import type { DesignerDraftRecord } from './draftTypes';

export type DraftTsxSource = {
  path: string;
  content: string;
  metaPath: string;
  metaContent: string;
  mtimeMs: number;
};

export type DraftTsxHydrationResult = {
  record: DesignerDraftRecord;
  companionTsx: string | null;
  hydratedFromTsx: boolean;
  sourcePath: string | null;
};

const uniqueResolvedPaths = (paths: string[]): string[] => {
  const seen = new Set<string>();
  return paths.filter((candidate) => {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) {
      return false;
    }
    seen.add(resolved);
    return true;
  });
};

export const collectDraftTsxCandidatePaths = (record: DesignerDraftRecord): string[] =>
  uniqueResolvedPaths([
    draftCompanionTsxPath(record.name, record.folder),
    legacyIdBasedDraftCompanionTsxPath(record.id, record.folder),
    legacyDraftCompanionTsxPath(record.id),
    ...findLegacyExportFilesForDraftId(record.id),
  ]);

const readDraftTsxSource = (tsxPath: string): DraftTsxSource | null => {
  if (!fs.existsSync(tsxPath)) {
    return null;
  }

  const metaPath = resolveDesignerComponentMetaPath(tsxPath);
  if (!fs.existsSync(metaPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(tsxPath, 'utf8');
    const metaContent = fs.readFileSync(metaPath, 'utf8');
    const mtimeMs = Math.max(fs.statSync(tsxPath).mtimeMs, fs.statSync(metaPath).mtimeMs);

    return {
      path: tsxPath,
      content,
      metaPath,
      metaContent,
      mtimeMs,
    };
  } catch {
    return null;
  }
};

export const readNewestDraftTsxSource = (record: DesignerDraftRecord): DraftTsxSource | null => {
  let newest: DraftTsxSource | null = null;

  for (const candidatePath of collectDraftTsxCandidatePaths(record)) {
    const source = readDraftTsxSource(candidatePath);
    if (!source) {
      continue;
    }

    if (!newest || source.mtimeMs > newest.mtimeMs) {
      newest = source;
    }
  }

  return newest;
};

const readDraftJsonMtimeMs = (record: DesignerDraftRecord): number => {
  const jsonPath = draftJsonPath(record.name, record.folder);
  if (!fs.existsSync(jsonPath)) {
    return 0;
  }

  try {
    return fs.statSync(jsonPath).mtimeMs;
  } catch {
    return 0;
  }
};

const documentsEquivalent = (left: DesignerDraftRecord['document'], right: DesignerDraftRecord['document']): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export const hydrateDraftRecordFromTsxSources = (record: DesignerDraftRecord): DraftTsxHydrationResult => {
  const tsxSource = readNewestDraftTsxSource(record);
  if (!tsxSource) {
    return {
      record,
      companionTsx: null,
      hydratedFromTsx: false,
      sourcePath: null,
    };
  }

  const jsonMtimeMs = readDraftJsonMtimeMs(record);
  const tsxIsNewerThanJson = tsxSource.mtimeMs > jsonMtimeMs + 250;

  let metaParsed;
  try {
    metaParsed = parseDesignerJson(tsxSource.metaContent);
  } catch {
    return {
      record,
      companionTsx: tsxSource.content,
      hydratedFromTsx: false,
      sourcePath: tsxSource.path,
    };
  }

  const syncResult = syncCodeToCanvas({
    format: 'tsx',
    code: tsxSource.content,
    currentDocument: metaParsed.document,
    currentBindingDefinitions: metaParsed.bindingDefinitions,
  });

  if (syncResult.ok !== true) {
    return {
      record,
      companionTsx: tsxSource.content,
      hydratedFromTsx: false,
      sourcePath: tsxSource.path,
    };
  }

  const documentChanged = !documentsEquivalent(record.document, syncResult.document);
  const isUnsafeContentLoss = documentLostContentComparedTo(record.document, syncResult.document);
  const shouldHydrateDocument = tsxIsNewerThanJson && documentChanged && !isUnsafeContentLoss;

  if (!shouldHydrateDocument) {
    return {
      record,
      companionTsx: tsxSource.content,
      hydratedFromTsx: false,
      sourcePath: tsxSource.path,
    };
  }

  return {
    record: {
      ...record,
      document: syncResult.document,
      bindingDefinitions: syncResult.bindingDefinitions,
    },
    companionTsx: tsxSource.content,
    hydratedFromTsx: true,
    sourcePath: tsxSource.path,
  };
};

export const readDraftCompanionMetaPath = (record: Pick<DesignerDraftRecord, 'name' | 'folder'>): string =>
  draftCompanionMetaPath(record.name, record.folder);
