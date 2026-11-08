import os from 'os';
import path from 'path';
import { prepareDesignerDocumentForPersist } from '../../../domain/component-designer/documentPersist';
import { createInitialDesignerState } from '../../../domain/component-designer/state';
import type { DesignerDocument } from '../../../domain/component-designer/types';
import type {
  RuntimeActivationBatchResult,
  RuntimeActivationRecord,
} from '../../../shared/api/contracts/appendoo/runtimeActivation.types';
import type { RuntimeActivationTarget } from '../../../shared/lib/appendoo/runtimeActivationScaffold';
import { isAppendooTestEnvironment } from '../../../shared/lib/appendoo/appendooCutover';
import { workspaceArtifactStore } from '../../../shared/lib/appendoo/workspaceArtifactStore';
import {
  sanitizeDraftFolderName,
  sanitizeDraftId,
  upsertDraftIndexSummary,
  writeDraftFile,
} from '../../domain/component-designer/draftIo';
import type { DesignerDraftRecord } from '../../domain/component-designer/draftTypes';
import { publishDesignerComponent } from '../component-designer/publishCoordinator.service';
import { compileExperienceRegistryFromDesignerPublish } from './runtimeActivationExperienceLive.service';
import { isLiveExperienceRegistryEnabled } from '../../../shared/lib/appendoo/appendooIntegrationFlags';
import {
  buildServerFunctionUiDesignerDraft,
  extractFunctionIdFromWorkspaceDraftJson,
  inferFunctionIdFromDraftSlug,
  resolveServerFunctionUiFolder,
} from '../../../shared/lib/appendoo/serverFunctionUiDraftScaffold';
import { scaffoldToDesignerDraftRecord } from '../../../shared/lib/appendoo/serverFunctionUiDesignerRecord';

type WorkspaceDesignerDraft = {
  schema?: string;
  draftId?: string;
  id?: string;
  title?: string;
  name?: string;
  folder?: string;
  document?: DesignerDocument;
  bindingDefinitions?: DesignerDraftRecord['bindingDefinitions'];
  metadata?: DesignerDraftRecord['metadata'];
};

const parseWorkspaceDesignerDraft = (content: string): DesignerDraftRecord | null => {
  try {
    const parsed = JSON.parse(content) as WorkspaceDesignerDraft;
    if (parsed.schema !== 'component-designer-draft' || !parsed.document || !parsed.bindingDefinitions) {
      return null;
    }

    const draftId = sanitizeDraftId(parsed.id?.trim() || parsed.draftId?.trim() || 'appendoo-draft');
    const title = parsed.name?.trim() || parsed.title?.trim() || draftId;
    const folder = sanitizeDraftFolderName(parsed.folder?.trim() || 'general');
    const now = new Date().toISOString();
    const document = prepareDesignerDocumentForPersist(parsed.document, {
      draftId,
      draftName: title,
    });

    return {
      schema: 'component-designer-draft',
      id: draftId,
      name: title,
      folder,
      document,
      bindingDefinitions: parsed.bindingDefinitions,
      metadata: {
        createdAt: parsed.metadata?.createdAt ?? now,
        updatedAt: now,
        createdBy: parsed.metadata?.createdBy ?? 'appendoo-live-activation',
        updatedBy: 'appendoo-live-activation',
      },
    };
  } catch {
    return null;
  }
};

const designerDraftHasRenderableContent = (draft: DesignerDraftRecord): boolean => {
  const nodes = Object.values(draft.document?.nodes ?? {});
  if (nodes.length <= 1) {
    return false;
  }

  return nodes.some((node) => {
    const paletteItemId = node.props?._designerPaletteItemId;
    return paletteItemId === 'html.form'
      || paletteItemId === 'heroui.input-text'
      || paletteItemId === 'heroui.number-input'
      || paletteItemId === 'layout.flex-column'
      || paletteItemId === 'html.text';
  });
};

const inferFunctionIdFromDraftId = (draftId: string): string | undefined => (
  inferFunctionIdFromDraftSlug(draftId)
);

const resolveDesignerFallbackFolder = (
  parsed: WorkspaceDesignerDraft,
  draftId: string,
): string => {
  if (parsed.folder?.trim()) {
    return sanitizeDraftFolderName(parsed.folder);
  }
  const boundFunctionId = typeof (parsed as { boundFunctionId?: string }).boundFunctionId === 'string'
    ? (parsed as { boundFunctionId?: string }).boundFunctionId?.trim()
    : '';
  if (boundFunctionId) {
    return sanitizeDraftFolderName(resolveServerFunctionUiFolder(boundFunctionId));
  }
  const inferredFunctionId = inferFunctionIdFromDraftId(draftId);
  if (inferredFunctionId) {
    return sanitizeDraftFolderName(resolveServerFunctionUiFolder(inferredFunctionId));
  }
  return 'general';
};

const failRecord = (
  record: RuntimeActivationRecord,
  message: string,
): RuntimeActivationRecord => ({
  ...record,
  status: 'FAILED',
  errors: [...record.errors, message],
});

/** Tests must chdir into a temp workspace before live designer publish. */
const isIsolatedTestCwd = (): boolean => {
  const cwd = path.resolve(process.cwd());
  const tmpRoot = path.resolve(os.tmpdir());
  return cwd === tmpRoot || cwd.startsWith(`${tmpRoot}${path.sep}`);
};

const shouldSkipOperatorCatalogPublish = (): boolean => (
  isAppendooTestEnvironment() && !isIsolatedTestCwd()
);

const buildDesignerDraftRecord = (
  draftId: string,
  title: string,
  folder = 'general',
): DesignerDraftRecord => {
  const now = new Date().toISOString();
  const state = createInitialDesignerState(title);
  const folderName = sanitizeDraftFolderName(folder);
  const document = prepareDesignerDocumentForPersist(state.document, {
    draftId,
    draftName: title,
  });

  return {
    schema: 'component-designer-draft',
    id: draftId,
    name: title,
    folder: folderName,
    document,
    bindingDefinitions: state.bindingDefinitions,
    metadata: {
      createdAt: now,
      updatedAt: now,
      createdBy: 'appendoo-live-activation',
      updatedBy: 'appendoo-live-activation',
    },
  };
};

const resolveDesignerRecordFromWorkspace = (
  content: string,
  target: RuntimeActivationTarget,
): DesignerDraftRecord => {
  const functionId = extractFunctionIdFromWorkspaceDraftJson(content, {
    workspacePath: target.workspacePath,
    fallbackTargetId: target.targetId,
  });

  if (functionId) {
    let title: string | undefined;
    try {
      const parsed = JSON.parse(content) as WorkspaceDesignerDraft;
      title = parsed.name?.trim() || parsed.title?.trim();
    } catch {
      title = undefined;
    }

    const scaffold = buildServerFunctionUiDesignerDraft(functionId, title);
    return scaffoldToDesignerDraftRecord(scaffold, 'appendoo-live-activation');
  }

  const fullRecord = parseWorkspaceDesignerDraft(content);
  if (fullRecord && designerDraftHasRenderableContent(fullRecord)) {
    return fullRecord;
  }

  let parsed: WorkspaceDesignerDraft;
  try {
    parsed = JSON.parse(content) as WorkspaceDesignerDraft;
  } catch {
    parsed = {};
  }

  const draftId = sanitizeDraftId(
    parsed.id?.trim() || parsed.draftId?.trim() || target.targetId,
  );
  const title = parsed.name?.trim() || parsed.title?.trim() || draftId;
  const folder = resolveDesignerFallbackFolder(parsed, draftId);
  return buildDesignerDraftRecord(draftId, title, folder);
};

const persistDesignerDraftTarget = async (
  target: RuntimeActivationTarget,
  record: RuntimeActivationRecord,
): Promise<RuntimeActivationRecord> => {
  if (record.status !== 'ACTIVATED' || !target.workspacePath.endsWith('/draft.json')) {
    return record;
  }

  if (shouldSkipOperatorCatalogPublish()) {
    return record;
  }

  const draftPath = target.workspacePath;
  const draft = workspaceArtifactStore.read(draftPath);
  if (!draft) {
    return failRecord(record, `Missing designer draft artifact: ${draftPath}`);
  }

  try {
    const designerRecord = resolveDesignerRecordFromWorkspace(draft.content, target);
    writeDraftFile(designerRecord);
    upsertDraftIndexSummary({
      id: designerRecord.id,
      name: designerRecord.name,
      folder: designerRecord.folder,
      createdAt: designerRecord.metadata.createdAt,
      updatedAt: designerRecord.metadata.updatedAt,
      createdBy: designerRecord.metadata.createdBy,
      updatedBy: designerRecord.metadata.updatedBy,
    });

    const publishState = publishDesignerComponent(designerRecord.id, 'appendoo-live-activation');
    if (publishState.lifecycle !== 'published') {
      return failRecord(record, 'Designer publish did not reach published lifecycle.');
    }

    if (isLiveExperienceRegistryEnabled()) {
      await compileExperienceRegistryFromDesignerPublish({
        componentPath: publishState.componentPath,
        title: designerRecord.name,
        folder: designerRecord.folder,
      });
    }

    return {
      ...record,
      activationRef: designerRecord.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failRecord(record, `ComponentDesigner publish failed: ${message}`);
  }
};

const persistDesignerDraftTargetSync = (
  target: RuntimeActivationTarget,
  record: RuntimeActivationRecord,
): RuntimeActivationRecord => {
  if (record.status !== 'ACTIVATED' || !target.workspacePath.endsWith('/draft.json')) {
    return record;
  }

  if (shouldSkipOperatorCatalogPublish()) {
    return record;
  }

  const draftPath = target.workspacePath;
  const draft = workspaceArtifactStore.read(draftPath);
  if (!draft) {
    return failRecord(record, `Missing designer draft artifact: ${draftPath}`);
  }

  try {
    const designerRecord = resolveDesignerRecordFromWorkspace(draft.content, target);
    writeDraftFile(designerRecord);
    upsertDraftIndexSummary({
      id: designerRecord.id,
      name: designerRecord.name,
      folder: designerRecord.folder,
      createdAt: designerRecord.metadata.createdAt,
      updatedAt: designerRecord.metadata.updatedAt,
      createdBy: designerRecord.metadata.createdBy,
      updatedBy: designerRecord.metadata.updatedBy,
    });

    const publishState = publishDesignerComponent(designerRecord.id, 'appendoo-live-activation');
    if (publishState.lifecycle !== 'published') {
      return failRecord(record, 'Designer publish did not reach published lifecycle.');
    }

    return {
      ...record,
      activationRef: designerRecord.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failRecord(record, `ComponentDesigner publish failed: ${message}`);
  }
};

/** AE-9.7 — sync designer publish for production pipeline path (experience registry deferred). */
export const persistLiveDesignerActivationsSync = (
  targets: RuntimeActivationTarget[],
  batch: RuntimeActivationBatchResult,
): RuntimeActivationBatchResult => {
  const records = batch.records.map((record, index) => {
    const target = targets[index];
    if (!target || target.kind !== 'designer_draft') {
      return record;
    }
    return persistDesignerDraftTargetSync(target, record);
  });

  return {
    records,
    activatedCount: records.filter((item) => item.status === 'ACTIVATED').length,
    validatedCount: records.filter((item) => item.status === 'VALIDATED').length,
    failedCount: records.filter((item) => item.status === 'FAILED').length,
  };
};

/** AE-9.7 — persist validated workspace designer drafts through ComponentDesigner publish. */
export const persistLiveDesignerActivations = async (
  targets: RuntimeActivationTarget[],
  batch: RuntimeActivationBatchResult,
): Promise<RuntimeActivationBatchResult> => {
  const records: RuntimeActivationRecord[] = [];

  for (let index = 0; index < batch.records.length; index += 1) {
    const record = batch.records[index];
    const target = targets[index];
    if (!target || target.kind !== 'designer_draft') {
      records.push(record);
      continue;
    }
    records.push(await persistDesignerDraftTarget(target, record));
  }

  return {
    records,
    activatedCount: records.filter((item) => item.status === 'ACTIVATED').length,
    validatedCount: records.filter((item) => item.status === 'VALIDATED').length,
    failedCount: records.filter((item) => item.status === 'FAILED').length,
  };
};
