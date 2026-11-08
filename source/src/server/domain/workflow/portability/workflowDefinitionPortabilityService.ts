import { WorkflowDomainError } from '../errors';
import { getWorkflowDefinitionById, findWorkflowDefinitionByScopeAndKey, createWorkflowDefinition } from '../workflowDefinitionRepository';
import { getViewByDraftIdentity, upsertDraftView } from '../workflowDesignerViewRepository';
import type { WorkflowDefinitionRecord, WorkflowActorType } from '../types';
import type { WorkflowModel } from '../awm/types';
import { validateLatinSlug } from '../../../../shared/lib/latinSlug';

/**
 * WFV2-23 — portable workflow definition bundle (Prisma → JSON → Prisma).
 * Authoring-only: draft AWM + optional designer view. Never exports runtime rows,
 * webhook secret hashes, or secret values.
 */

export const WORKFLOW_BUNDLE_FORMAT = 'appendo.workflow.definition' as const;
export const WORKFLOW_BUNDLE_FORMAT_VERSION = 1 as const;

export type WorkflowDefinitionBundle = {
  format: typeof WORKFLOW_BUNDLE_FORMAT;
  formatVersion: typeof WORKFLOW_BUNDLE_FORMAT_VERSION;
  exportedAt: string;
  definition: {
    scopeKey: string;
    key: string;
    name?: string;
    draftModel: WorkflowModel;
    designerViewJson?: string | null;
    designerViewSchemaVersion?: number;
  };
};

export type ExportWorkflowDefinitionResult = {
  bundle: WorkflowDefinitionBundle;
  sourceDefinitionId: number;
};

export type ImportWorkflowDefinitionOptions = {
  /** Override target scope (default: bundle.definition.scopeKey). */
  scopeKey?: string;
  /** Override target key (default: bundle.definition.key). Required when collision + no overwrite. */
  key?: string;
  /** When true and (scopeKey,key) exists, replace the target draft (DRAFT lifecycle only). */
  overwrite?: boolean;
  actor?: { type: WorkflowActorType; id: number | null };
};

export type ImportWorkflowDefinitionResult = {
  definition: WorkflowDefinitionRecord;
  created: boolean;
  overwritten: boolean;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseWorkflowDefinitionBundle(raw: unknown): WorkflowDefinitionBundle {
  if (!isPlainObject(raw)) {
    throw new WorkflowDomainError('WF_DEF_INVALID_REFERENCE', 'Workflow bundle must be an object.');
  }
  if (raw.format !== WORKFLOW_BUNDLE_FORMAT) {
    throw new WorkflowDomainError('WF_DEF_INVALID_REFERENCE', `Unsupported workflow bundle format "${String(raw.format)}".`, { format: raw.format });
  }
  if (raw.formatVersion !== WORKFLOW_BUNDLE_FORMAT_VERSION) {
    throw new WorkflowDomainError('WF_DEF_INVALID_REFERENCE', `Unsupported workflow bundle formatVersion ${String(raw.formatVersion)}.`, { formatVersion: raw.formatVersion });
  }
  if (!isPlainObject(raw.definition)) {
    throw new WorkflowDomainError('WF_DEF_INVALID_REFERENCE', 'Workflow bundle.definition must be an object.');
  }
  const def = raw.definition;
  const scopeKey = typeof def.scopeKey === 'string' && def.scopeKey.trim() ? def.scopeKey.trim() : 'global';
  const key = typeof def.key === 'string' ? def.key.trim() : '';
  const keyError = validateLatinSlug(key, { fieldLabel: 'Workflow key' });
  if (keyError) {
    throw new WorkflowDomainError('WF_DEF_INVALID_REFERENCE', keyError, { key });
  }
  if (!isPlainObject(def.draftModel)) {
    throw new WorkflowDomainError('WF_DEF_INVALID_AWM', 'Workflow bundle.definition.draftModel must be an object.');
  }
  const draftModel = { ...(def.draftModel as WorkflowModel), key };
  return {
    format: WORKFLOW_BUNDLE_FORMAT,
    formatVersion: WORKFLOW_BUNDLE_FORMAT_VERSION,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    definition: {
      scopeKey,
      key,
      name: typeof def.name === 'string' ? def.name : draftModel.name,
      draftModel,
      designerViewJson: typeof def.designerViewJson === 'string' ? def.designerViewJson : null,
      designerViewSchemaVersion: typeof def.designerViewSchemaVersion === 'number' ? def.designerViewSchemaVersion : 1,
    },
  };
}

export async function exportWorkflowDefinition(workflowDefinitionId: number): Promise<ExportWorkflowDefinitionResult> {
  const definition = await getWorkflowDefinitionById(workflowDefinitionId);
  if (!definition) {
    throw new WorkflowDomainError('WF_DEF_INVALID_REFERENCE', 'WorkflowDefinition not found.', { workflowDefinitionId });
  }

  let draftModel: WorkflowModel;
  try {
    draftModel = JSON.parse(definition.draftDefinitionJson) as WorkflowModel;
  } catch {
    throw new WorkflowDomainError('WF_DEF_INVALID_AWM', 'Source draftDefinitionJson is not valid JSON.', { workflowDefinitionId });
  }

  const designerView = await getViewByDraftIdentity(definition.id, definition.draftVersion);

  const bundle: WorkflowDefinitionBundle = {
    format: WORKFLOW_BUNDLE_FORMAT,
    formatVersion: WORKFLOW_BUNDLE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    definition: {
      scopeKey: definition.scopeKey,
      key: definition.key,
      name: draftModel.name,
      draftModel: { ...draftModel, key: definition.key },
      designerViewJson: designerView?.viewJson ?? null,
      designerViewSchemaVersion: designerView?.viewSchemaVersion ?? 1,
    },
  };

  return { bundle, sourceDefinitionId: definition.id };
}

export async function importWorkflowDefinition(
  rawBundle: unknown,
  options: ImportWorkflowDefinitionOptions = {},
): Promise<ImportWorkflowDefinitionResult> {
  const bundle = parseWorkflowDefinitionBundle(rawBundle);
  const scopeKey = (options.scopeKey?.trim() || bundle.definition.scopeKey || 'global').trim();
  const key = (options.key?.trim() || bundle.definition.key).trim();
  const keyError = validateLatinSlug(key, { fieldLabel: 'Workflow key' });
  if (keyError) {
    throw new WorkflowDomainError('WF_DEF_INVALID_REFERENCE', keyError, { key });
  }

  const draftModel: WorkflowModel = {
    ...bundle.definition.draftModel,
    key,
    ...(bundle.definition.name ? { name: bundle.definition.name } : {}),
  };
  const draftDefinitionJson = JSON.stringify(draftModel);
  const actorId = options.actor?.id ?? null;
  const existing = await findWorkflowDefinitionByScopeAndKey(scopeKey, key);

  if (existing) {
    if (!options.overwrite) {
      throw new WorkflowDomainError(
        'WF_DEF_INVALID_REFERENCE',
        `A WorkflowDefinition already exists at scope "${scopeKey}" key "${key}".`,
        { scopeKey, key, existingDefinitionId: existing.id },
      );
    }
    if (existing.lifecycleStatus !== 'DRAFT') {
      throw new WorkflowDomainError(
        'WF_DEF_INVALID_REFERENCE',
        `Cannot overwrite workflow "${key}" while lifecycle is ${existing.lifecycleStatus} (DRAFT only).`,
        { scopeKey, key, lifecycleStatus: existing.lifecycleStatus },
      );
    }

    const overwritten = await overwriteDraftDefinition({
      definitionId: existing.id,
      expectedDraftVersion: existing.draftVersion,
      draftDefinitionJson,
      designerViewJson: bundle.definition.designerViewJson ?? null,
      designerViewSchemaVersion: bundle.definition.designerViewSchemaVersion ?? 1,
      updatedBy: actorId,
    });
    return { definition: overwritten, created: false, overwritten: true };
  }

  const created = await createWorkflowDefinition({
    scopeKey,
    key,
    draftDefinitionJson,
    creationMode: 'IMPORT',
    createdBy: actorId,
  });

  if (bundle.definition.designerViewJson) {
    await upsertDraftView({
      workflowDefinitionId: created.id,
      draftVersion: created.draftVersion,
      viewSchemaVersion: bundle.definition.designerViewSchemaVersion ?? 1,
      viewJson: bundle.definition.designerViewJson,
      updatedBy: actorId,
    });
  }

  return { definition: created, created: true, overwritten: false };
}

async function overwriteDraftDefinition(input: {
  definitionId: number;
  expectedDraftVersion: number;
  draftDefinitionJson: string;
  designerViewJson: string | null;
  designerViewSchemaVersion: number;
  updatedBy: number | null;
}): Promise<WorkflowDefinitionRecord> {
  const { prisma, toId, fromId, toIsoString, toNullableId } = await import('../prismaHelpers');
  const row = await prisma().$transaction(async (tx) => {
    const updated = await tx.workflowDefinition.updateMany({
      where: {
        id: toId(input.definitionId),
        draftVersion: input.expectedDraftVersion,
        lifecycleStatus: 'DRAFT',
      },
      data: {
        draftDefinitionJson: input.draftDefinitionJson,
        draftVersion: { increment: 1 },
        stateVersion: { increment: 1 },
        updatedAt: new Date(),
        updatedBy: input.updatedBy != null ? toId(input.updatedBy) : null,
        creationMode: 'IMPORT',
      },
    });
    if (updated.count === 0) {
      throw new WorkflowDomainError('WF_DEF_STALE_DRAFT_VERSION', 'Target draftVersion is stale or not DRAFT.', {
        workflowDefinitionId: input.definitionId,
        expectedDraftVersion: input.expectedDraftVersion,
      });
    }
    return tx.workflowDefinition.findUniqueOrThrow({ where: { id: toId(input.definitionId) } });
  });

  const definition: WorkflowDefinitionRecord = {
    id: fromId(row.id),
    scopeKey: row.scopeKey,
    key: row.key,
    lifecycleStatus: row.lifecycleStatus as WorkflowDefinitionRecord['lifecycleStatus'],
    draftDefinitionJson: row.draftDefinitionJson,
    draftVersion: row.draftVersion,
    currentPublishedRevisionId: toNullableId(row.currentPublishedRevisionId),
    nextRevisionNumber: row.nextRevisionNumber,
    createdFromDefinitionId: toNullableId(row.createdFromDefinitionId),
    createdFromRevisionId: toNullableId(row.createdFromRevisionId),
    creationMode: row.creationMode as WorkflowDefinitionRecord['creationMode'],
    stateVersion: row.stateVersion,
    createdAt: toIsoString(row.createdAt),
    createdBy: toNullableId(row.createdBy),
    updatedAt: toIsoString(row.updatedAt),
    updatedBy: toNullableId(row.updatedBy),
    lastPublishedAt: toIsoString(row.lastPublishedAt),
    lastPublishedBy: toNullableId(row.lastPublishedBy),
    lastUnpublishedAt: toIsoString(row.lastUnpublishedAt),
    lastUnpublishedBy: toNullableId(row.lastUnpublishedBy),
  };

  if (input.designerViewJson) {
    await upsertDraftView({
      workflowDefinitionId: definition.id,
      draftVersion: definition.draftVersion,
      viewSchemaVersion: input.designerViewSchemaVersion,
      viewJson: input.designerViewJson,
      updatedBy: input.updatedBy,
    });
  }

  return definition;
}
