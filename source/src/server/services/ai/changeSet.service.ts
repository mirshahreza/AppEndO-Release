import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import type {
  AgentApplyRequest,
  AgentApplyResult,
  AgentLatestApplyResult,
  AgentProposalFeedbackRequest,
  AgentProposalFeedbackResult,
  AgentRollbackRequest,
  AgentRollbackResult,
  AppliedChangeItem,
  ChangeSet,
  FileDiffZone,
} from '../../../shared/api/contracts/ai/agentTypes';
import type { AiAgentSettings } from '../../../shared/api/contracts/ai/types';
import { validateProposal } from '../../../core/ai/validation/proposalValidator';
import { getProposalContext } from '../../../core/ai/validation/proposalContextStore';
import { isPlanModeDocumentPath, resolveAllowlistedPath } from '../../../core/ai/tools/pathAllowlist';
import { deleteDesignerDraft, saveDesignerDraft } from '../component-designer/draftCoordinator.service';
import { getDesignerDraft } from '../../domain/component-designer/drafts';
import { readDraftRecord } from '../../domain/component-designer/draftIo';
import { buildDesignerComponentPath } from '../../../shared/lib/designerComponentPath';
import type { DesignerDocument } from '../../../domain/component-designer/types';
import type { DesignerDraftRecord } from '../../domain/component-designer/draftTypes';
import { appendDesignerPageToPortalMenu } from '../platform/portal.service';
import type { PlatformRegistryActor } from '../../../core/platform-registry/platformRegistryAudit';
import {
  findManagedFunctionById,
  insertManagedFunction,
  deleteManagedFunction,
  updateManagedFunction,
} from '../../domain/functions/functionRepository';
import { refreshOpenApiDocumentationCaches } from '../openApiDocRefresh';
import {
  buildManagedServerFunctionPath,
  resolveManagedFunctionIdFromChangeSet,
} from '../../../core/ai/serverFunctionManualParity';
import { sanitizeFunctionSegment } from '../../../core/functions/functionNaming';
import {
  getAgentApplySnapshotById,
  getLatestAgentApplySnapshot,
  insertAgentApplySnapshot,
  markAgentApplySnapshotRolledBack,
  updateAgentApplySnapshotsJson,
} from '../../domain/ai/agentApplyRepository';
import { HttpError } from '../../errors/HttpError';
import { logger } from '../../../core/logging/Logger';
import { applyGitOperationChangeSet, rollbackGitOperationSnapshot, type GitOperationBeforeSnapshot } from './gitOperationApply';
import { verifyAppliedChangeSets } from './postApplyVerify.service';
import { getChangeSetDisplayLabel } from '../../../shared/lib/changeSetPreview';
import {
  computeLineDiffZones,
  revertDiffZone,
  type DiffZone,
} from '../../../shared/lib/appendoo/diffZones';
import {
  shouldBlockV1ChangeSetApply,
  V1_DIRECT_WRITE_BLOCKED_MESSAGE,
} from '../../../shared/lib/appendoo/appendooCutover';
import { recordProposalOutcome } from '../../../shared/lib/appendoo/proposalOutcomeTelemetry';

type ApplySnapshotEntry = {
  changeSetId: string;
  kind: ChangeSet['kind'];
  target: string;
  before?: unknown;
  rolledBackAt?: string;
  revertedZones?: FileDiffZone[];
};

type ComponentLayoutBeforeSnapshot =
  | { existed: true; record: DesignerDraftRecord }
  | { existed: false; layoutId: string };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const hashContent = (content: string): string => (
  createHash('sha256').update(content).digest('hex').slice(0, 16)
);

const zonesEqual = (left: DiffZone, right: DiffZone): boolean => (
  left.startLine === right.startLine && left.endLine === right.endLine
);

const resolveAppliedDiffZones = (
  changeSet: ChangeSet | undefined,
  revertedZones: FileDiffZone[] = [],
): FileDiffZone[] | undefined => {
  if (changeSet?.kind !== 'file_patch') {
    return undefined;
  }

  const allZones = changeSet.diffZones?.length
    ? changeSet.diffZones
    : (changeSet.beforeContent
      ? computeLineDiffZones(changeSet.beforeContent, changeSet.content)
      : []);

  const pending = allZones.filter((zone) => !revertedZones.some((reverted) => zonesEqual(zone, reverted)));
  return pending.length > 0 ? pending : undefined;
};

const buildAppliedChangeItems = (
  changeSets: ChangeSet[],
  snapshots: ApplySnapshotEntry[],
): AppliedChangeItem[] => {
  const changeSetById = new Map(changeSets.map((changeSet) => [changeSet.id, changeSet]));

  return snapshots.map((snapshot) => {
    const changeSet = changeSetById.get(snapshot.changeSetId);
    const revertedZones = snapshot.revertedZones?.length ? snapshot.revertedZones : undefined;
    return {
      changeSetId: snapshot.changeSetId,
      label: changeSet ? getChangeSetDisplayLabel(changeSet) : snapshot.target,
      kind: snapshot.kind,
      rolledBack: Boolean(snapshot.rolledBackAt),
      diffZones: resolveAppliedDiffZones(changeSet, revertedZones),
      revertedZones,
    };
  });
};

export class ChangeSetService {
  async apply(
    request: AgentApplyRequest,
    userId: number,
    agentSettings: AiAgentSettings,
  ): Promise<AgentApplyResult> {
    if (shouldBlockV1ChangeSetApply()) {
      throw new HttpError(403, V1_DIRECT_WRITE_BLOCKED_MESSAGE);
    }

    const applyMode = request.mode === 'plan'
      ? 'plan'
      : request.changeSets.every((changeSet) => (
        changeSet.kind === 'file_patch' && isPlanModeDocumentPath(changeSet.path)
      ))
        ? 'plan'
        : 'agent';

    // p-98 — validation parity with propose-time (AgentOrchestrator.buildProposalValidationOptions).
    // Recovering the same pageContext/userIntentPaths this proposal was created with re-enables the
    // openFunctionId and file-path scope checks apply-time validation used to silently skip. Falls
    // back to today's behavior (no scope narrowing) when the proposal context wasn't captured.
    const proposalContext = getProposalContext(request.proposalId);
    const validation = validateProposal(request.changeSets, {
      mode: applyMode === 'plan' ? 'plan' : undefined,
      agentSettings,
      pageContext: proposalContext?.pageContext,
      userIntentPaths: proposalContext?.userIntentPaths,
    });
    const hasErrors = validation.violations.some((violation) => violation.severity === 'error');
    if (hasErrors) {
      throw new HttpError(400, 'Proposal validation failed. Resolve errors before applying.');
    }

    const hasWarnings = validation.violations.some((violation) => violation.severity === 'warning');
    if (hasWarnings && !request.confirmOverrideWarnings) {
      throw new HttpError(400, 'Proposal has warnings. Set confirmOverrideWarnings to proceed.');
    }

    if (agentSettings.writeRequiresConfirm !== true) {
      throw new HttpError(400, 'Write requires explicit confirm in agent settings.');
    }

    const snapshots: ApplySnapshotEntry[] = [];
    const applied: string[] = [];
    const designerHandoff: NonNullable<AgentApplyResult['designerHandoff']> = [];

    for (const changeSet of request.changeSets) {
      const snapshot = await this.applyChangeSet(changeSet);
      snapshots.push(snapshot);
      applied.push(changeSet.title);

      if (changeSet.kind === 'component_layout_patch') {
        const patch = isRecord(changeSet.patch) ? changeSet.patch : {};
        const persisted = getDesignerDraft(snapshot.target);
        const name = persisted?.name
          ?? (typeof patch.name === 'string' && patch.name.trim() ? patch.name.trim() : changeSet.title);
        const folder = persisted?.folder
          ?? (typeof patch.folder === 'string' && patch.folder.trim() ? patch.folder.trim() : 'general');
        designerHandoff.push({
          layoutId: snapshot.target,
          name,
          componentPath: buildDesignerComponentPath(folder, name),
        });
      }
    }

    const applyId = await insertAgentApplySnapshot({
      sessionId: request.sessionId,
      userId,
      proposalId: request.proposalId,
      changeSetsJson: JSON.stringify(request.changeSets),
      snapshotsJson: JSON.stringify(snapshots),
      summary: `Applied ${applied.length} change set(s).`,
    });

    logger.info('ChangeSetService', 'Applied agent proposal', {
      applyId,
      proposalId: request.proposalId,
      userId,
      count: applied.length,
    });

    const planPatch = request.changeSets.find(
      (changeSet): changeSet is Extract<ChangeSet, { kind: 'file_patch' }> => (
        changeSet.kind === 'file_patch' && isPlanModeDocumentPath(changeSet.path)
      ),
    );
    const planRevision = planPatch
      ? hashContent(planPatch.content)
      : undefined;
    const planDocUpdated = planPatch && planRevision
      ? { path: planPatch.path, revision: planRevision }
      : undefined;

    const verification = await verifyAppliedChangeSets(request.changeSets);
    const appliedChanges = buildAppliedChangeItems(request.changeSets, snapshots);

    recordProposalOutcome({
      proposalId: request.proposalId,
      applyId,
      outcome: 'accepted',
      changeSetCount: applied.length,
    });

    return {
      applyId,
      proposalId: request.proposalId,
      appliedCount: applied.length,
      summary: `Applied ${applied.length} change set(s): ${applied.join(', ')}`,
      appliedChanges,
      planDocUpdated,
      designerHandoff: designerHandoff.length > 0 ? designerHandoff : undefined,
      verification,
    };
  }

  async rollback(
    request: AgentRollbackRequest,
    userId: number,
  ): Promise<AgentRollbackResult> {
    const row = await getAgentApplySnapshotById(request.applyId, userId);

    if (!row) {
      throw new HttpError(404, 'Apply snapshot not found.');
    }

    if (row.rolled_back_at && !request.diffZoneRollbacks?.length) {
      throw new HttpError(409, 'This apply was already rolled back.');
    }

    const snapshots = JSON.parse(row.snapshots_json) as ApplySnapshotEntry[];
    const changeSets = row.change_sets_json
      ? JSON.parse(row.change_sets_json) as ChangeSet[]
      : [];

    if (request.diffZoneRollbacks?.length) {
      return this.rollbackDiffZones(request, userId, snapshots, changeSets);
    }

    const targetIds = request.changeSetIds?.length
      ? new Set(request.changeSetIds)
      : null;

    const pending = snapshots.filter((snapshot) => !snapshot.rolledBackAt);
    const toRollback = targetIds
      ? pending.filter((snapshot) => targetIds.has(snapshot.changeSetId))
      : pending;

    if (targetIds && toRollback.length === 0) {
      throw new HttpError(404, 'No matching change sets to roll back.');
    }

    for (const snapshot of [...toRollback].reverse()) {
      await this.rollbackSnapshot(snapshot);
      snapshot.rolledBackAt = new Date().toISOString();
    }

    await updateAgentApplySnapshotsJson(request.applyId, userId, JSON.stringify(snapshots));

    const allRolledBack = snapshots.every((snapshot) => snapshot.rolledBackAt);
    if (allRolledBack) {
      await markAgentApplySnapshotRolledBack(request.applyId, userId);
    }

    const appliedChanges = buildAppliedChangeItems(changeSets, snapshots);

    recordProposalOutcome({
      applyId: request.applyId,
      outcome: 'rejected_full',
      changeSetCount: toRollback.length,
    });

    return {
      applyId: request.applyId,
      rolledBackCount: toRollback.length,
      summary: targetIds
        ? `Rejected ${toRollback.length} change(s) from apply #${request.applyId}.`
        : `Rolled back ${toRollback.length} change set(s) from apply #${request.applyId}.`,
      appliedChanges,
      allRolledBack,
    };
  }

  private async rollbackDiffZones(
    request: AgentRollbackRequest,
    userId: number,
    snapshots: ApplySnapshotEntry[],
    changeSets: ChangeSet[],
  ): Promise<AgentRollbackResult> {
    const entries = request.diffZoneRollbacks ?? [];
    let rolledZoneCount = 0;

    for (const entry of entries) {
      const snapshot = snapshots.find((item) => (
        item.changeSetId === entry.changeSetId && !item.rolledBackAt
      ));
      const changeSet = changeSets.find((item) => item.id === entry.changeSetId);

      if (!snapshot || snapshot.kind !== 'file_patch' || changeSet?.kind !== 'file_patch') {
        throw new HttpError(404, `Change set ${entry.changeSetId} not found for zone rollback.`);
      }

      const resolved = resolveAllowlistedPath(snapshot.target);
      if (!resolved.ok) {
        throw new HttpError(400, `Path not allowlisted: ${snapshot.target}`);
      }

      const before = snapshot.before as { content?: string | null } | undefined;
      const baseline = typeof before?.content === 'string' ? before.content : '';
      if (!fs.existsSync(resolved.absolutePath)) {
        throw new HttpError(404, `File not found: ${snapshot.target}`);
      }

      let current = fs.readFileSync(resolved.absolutePath, 'utf8');
      for (const zone of entry.zones) {
        current = revertDiffZone(baseline, current, zone);
        snapshot.revertedZones = [...(snapshot.revertedZones ?? []), zone];
        rolledZoneCount += 1;
      }

      fs.writeFileSync(resolved.absolutePath, current, 'utf8');

      if (current === baseline) {
        snapshot.rolledBackAt = new Date().toISOString();
      }
    }

    await updateAgentApplySnapshotsJson(request.applyId, userId, JSON.stringify(snapshots));

    const allRolledBack = snapshots.every((snapshot) => snapshot.rolledBackAt);
    if (allRolledBack) {
      await markAgentApplySnapshotRolledBack(request.applyId, userId);
    }

    const appliedChanges = buildAppliedChangeItems(changeSets, snapshots);

    recordProposalOutcome({
      applyId: request.applyId,
      outcome: 'rejected_zone',
      changeSetCount: rolledZoneCount,
    });

    return {
      applyId: request.applyId,
      rolledBackCount: rolledZoneCount,
      summary: `Reverted ${rolledZoneCount} diff zone(s) from apply #${request.applyId}.`,
      appliedChanges,
      allRolledBack,
    };
  }

  recordDismissedProposal(request: AgentProposalFeedbackRequest): AgentProposalFeedbackResult {
    const record = recordProposalOutcome({
      proposalId: request.proposalId,
      outcome: 'dismissed_pre_apply',
      changeSetCount: request.changeSetCount,
    });

    return {
      proposalId: request.proposalId,
      outcome: 'dismissed_pre_apply',
      recordedAt: record.recordedAt,
    };
  }

  async getLatestApplyDetails(
    sessionId: number | undefined,
    userId: number,
  ): Promise<AgentLatestApplyResult> {
    const row = await getLatestAgentApplySnapshot(sessionId, userId);
    if (!row) {
      return { applyId: null };
    }

    const changeSets = JSON.parse(row.change_sets_json) as ChangeSet[];
    const snapshots = JSON.parse(row.snapshots_json) as ApplySnapshotEntry[];
    const appliedChanges = buildAppliedChangeItems(changeSets, snapshots)
      .filter((item) => !item.rolledBack);

    if (appliedChanges.length === 0) {
      return { applyId: null };
    }

    return {
      applyId: row.id,
      appliedChanges,
    };
  }

  async getLatestApplyId(sessionId: number | undefined, userId: number): Promise<number | null> {
    const details = await this.getLatestApplyDetails(sessionId, userId);
    return details.applyId;
  }

  private async applyChangeSet(changeSet: ChangeSet): Promise<ApplySnapshotEntry> {
    switch (changeSet.kind) {
      case 'component_layout_patch':
        return this.applyComponentLayoutPatch(changeSet);
      case 'file_patch':
        return this.applyFilePatch(changeSet);
      case 'git_operation':
        return this.applyGitOperation(changeSet);
      case 'function_source_patch':
        return this.applyFunctionSourcePatch(changeSet);
      case 'settings_block_patch':
        throw new HttpError(400, 'settings_block_patch apply is not supported in v1.');
      default:
        throw new HttpError(400, `Unsupported change set kind.`);
    }
  }

  private async applyComponentLayoutPatch(changeSet: Extract<ChangeSet, { kind: 'component_layout_patch' }>): Promise<ApplySnapshotEntry> {
    if (!isRecord(changeSet.patch)) {
      throw new HttpError(400, 'Component layout patch payload is invalid.');
    }

    const patch = changeSet.patch;
    const document = patch.document as DesignerDocument | undefined;
    if (!document) {
      throw new HttpError(400, 'Component layout patch requires document.');
    }

    const name = typeof patch.name === 'string' ? patch.name : changeSet.title;
    const folder = typeof patch.folder === 'string' ? patch.folder : 'general';
    const bindingDefinitions = isRecord(patch.bindingDefinitions)
      ? patch.bindingDefinitions
      : {};

    const existing = readDraftRecord(changeSet.layoutId);
    const before: ComponentLayoutBeforeSnapshot = existing
      ? { existed: true, record: structuredClone(existing) }
      : { existed: false, layoutId: changeSet.layoutId };

    let saved: DesignerDraftRecord;
    try {
      saved = saveDesignerDraft({
        id: changeSet.layoutId,
        name,
        folder,
        description: changeSet.summary,
        document,
        bindingDefinitions: bindingDefinitions as Record<string, import('../../../domain/component-designer/types').DesignerBindingDefinition>,
        actor: 'ai-agent',
      });
      const persisted = getDesignerDraft(saved.id);
      if (!persisted?.document) {
        throw new HttpError(
          500,
          `Component layout apply did not persist draft "${saved.id}".`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpError(400, `Component layout patch failed: ${message}`);
    }

    await this.applyLayoutMenuEntryIfPresent(patch, folder, name);

    return {
      changeSetId: changeSet.id,
      kind: changeSet.kind,
      target: saved.id,
      before,
    };
  }

  /** Phase 56 — DesignerAddToMenuButton parity after scaffold page layouts are saved. */
  private async applyLayoutMenuEntryIfPresent(
    patch: Record<string, unknown>,
    folder: string,
    name: string,
  ): Promise<void> {
    const menuEntry = isRecord(patch.menuEntry) ? patch.menuEntry : null;
    if (!menuEntry) return;

    const portalSegment = typeof menuEntry.portalSegment === 'string'
      ? menuEntry.portalSegment.trim()
      : '';
    const navLabel = typeof menuEntry.navLabel === 'string' && menuEntry.navLabel.trim()
      ? menuEntry.navLabel.trim()
      : name;
    const pageKey = typeof menuEntry.pageKey === 'string' && menuEntry.pageKey.trim()
      ? menuEntry.pageKey.trim()
      : buildDesignerComponentPath(folder, name);
    if (!portalSegment || !pageKey) return;

    const path = typeof menuEntry.path === 'string' ? menuEntry.path.trim() : undefined;
    const loaderRef = typeof menuEntry.loaderRef === 'string' ? menuEntry.loaderRef.trim() : undefined;
    const actor: PlatformRegistryActor = { userId: null, username: 'ai-agent' };

    try {
      await appendDesignerPageToPortalMenu(
        portalSegment,
        { pageKey, path, navLabel, loaderRef },
        actor,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Idempotent: page already on portal is not a hard apply failure.
      if (/already assigned/i.test(message)) {
        logger.info('ChangeSetService', 'Menu entry already present; skipping', {
          portalSegment,
          pageKey,
        });
        return;
      }
      throw new HttpError(400, `Portal menu entry failed: ${message}`);
    }
  }

  private async applyFilePatch(changeSet: Extract<ChangeSet, { kind: 'file_patch' }>): Promise<ApplySnapshotEntry> {
    const resolved = resolveAllowlistedPath(changeSet.path);
    if (resolved.ok === false) {
      throw new HttpError(400, resolved.error);
    }

    let beforeContent: string | undefined;
    if (fs.existsSync(resolved.absolutePath) && fs.statSync(resolved.absolutePath).isFile()) {
      beforeContent = fs.readFileSync(resolved.absolutePath, 'utf8');
    }

    fs.mkdirSync(path.dirname(resolved.absolutePath), { recursive: true });
    fs.writeFileSync(resolved.absolutePath, changeSet.content, 'utf8');

    return {
      changeSetId: changeSet.id,
      kind: changeSet.kind,
      target: resolved.relativePath,
      before: beforeContent !== undefined ? { content: beforeContent, hash: hashContent(beforeContent) } : { content: null },
    };
  }

  private async applyGitOperation(changeSet: Extract<ChangeSet, { kind: 'git_operation' }>): Promise<ApplySnapshotEntry> {
    try {
      const applied = await applyGitOperationChangeSet(changeSet);
      return {
        changeSetId: changeSet.id,
        kind: changeSet.kind,
        target: applied.target,
        before: applied.before,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpError(400, message);
    }
  }

  private resolveManagedFunctionId(
    changeSet: Extract<ChangeSet, { kind: 'function_source_patch' }>,
  ): string {
    return resolveManagedFunctionIdFromChangeSet(changeSet);
  }

  private async applyFunctionSourcePatch(changeSet: Extract<ChangeSet, { kind: 'function_source_patch' }>): Promise<ApplySnapshotEntry> {
    if (!isRecord(changeSet.patch)) {
      throw new HttpError(400, 'Function source patch payload is invalid.');
    }

    const patch = changeSet.patch;
    const source = typeof patch.source === 'string' ? patch.source : '';
    const name = typeof patch.name === 'string' ? patch.name : changeSet.functionId;
    const folder = typeof patch.folder === 'string' ? patch.folder : 'general';
    const method = typeof patch.method === 'string' ? patch.method : 'GET';
    const fnPath = typeof patch.path === 'string'
      ? patch.path
      : buildManagedServerFunctionPath(folder, sanitizeFunctionSegment(name));
    const testPayload = typeof patch.testPayload === 'string' ? patch.testPayload : '{}';
    const managedFunctionId = this.resolveManagedFunctionId(changeSet);

    if (!source.trim()) {
      throw new HttpError(400, 'Function source patch requires source code.');
    }

    const existing = await findManagedFunctionById(managedFunctionId)
      ?? (managedFunctionId !== changeSet.functionId
        ? await findManagedFunctionById(changeSet.functionId)
        : null);
    const before = existing ? { ...existing } : undefined;

    if (existing) {
      await updateManagedFunction([
        name,
        folder,
        method,
        fnPath,
        source,
        'ts',
        existing.test_payload ?? testPayload,
        existing.runtime_version ?? 'v20.x',
        existing.memory_limit ?? 128,
        existing.timeout_ms ?? 1500,
        existing.cache_enabled ?? false,
        existing.cache_ttl_ms ?? 180000,
        existing.cache_by_param ?? false,
        existing.cache_by_user ?? false,
        existing.engine_type,
        existing.metadata_json,
        existing.access_control,
        existing.id,
      ]);
    } else {
      await insertManagedFunction([
        managedFunctionId,
        name,
        folder,
        method,
        fnPath,
        source,
        'ts',
        testPayload,
        'v20.x',
        128,
        1500,
        false,
        180000,
        false,
        false,
      ]);
    }

    refreshOpenApiDocumentationCaches(managedFunctionId);

    return {
      changeSetId: changeSet.id,
      kind: changeSet.kind,
      target: managedFunctionId,
      before,
    };
  }

  private async rollbackSnapshot(snapshot: ApplySnapshotEntry): Promise<void> {
    switch (snapshot.kind) {
      case 'file_patch': {
        const resolved = resolveAllowlistedPath(snapshot.target);
        if (!resolved.ok) return;

        const before = snapshot.before as { content?: string | null } | undefined;
        if (before?.content) {
          fs.writeFileSync(resolved.absolutePath, before.content, 'utf8');
        } else if (fs.existsSync(resolved.absolutePath)) {
          fs.unlinkSync(resolved.absolutePath);
        }
        break;
      }
      case 'component_layout_patch': {
        const before = snapshot.before as ComponentLayoutBeforeSnapshot | undefined;
        if (!before) {
          break;
        }

        if (before.existed) {
          try {
            saveDesignerDraft({
              id: before.record.id,
              name: before.record.name,
              folder: before.record.folder,
              document: before.record.document,
              bindingDefinitions: before.record.bindingDefinitions,
              actor: 'ai-agent-rollback',
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new HttpError(400, `Component layout rollback failed: ${message}`);
          }
        } else if (!before.existed) {
          deleteDesignerDraft(before.layoutId);
        }
        break;
      }
      case 'function_source_patch':
        await this.rollbackFunctionSourcePatch(snapshot);
        break;
      case 'git_operation':
        await rollbackGitOperationSnapshot(
          snapshot.before as GitOperationBeforeSnapshot,
          snapshot.target,
        );
        break;
      default:
        break;
    }
  }

  private async rollbackFunctionSourcePatch(snapshot: ApplySnapshotEntry): Promise<void> {
    const before = snapshot.before as Record<string, unknown> | undefined;

    if (before && typeof before.id === 'string') {
      await updateManagedFunction([
        before.name,
        before.folder,
        before.method,
        before.path,
        before.code,
        before.language ?? 'ts',
        before.test_payload ?? '{}',
        before.runtime_version ?? 'v20.x',
        before.memory_limit ?? 128,
        before.timeout_ms ?? 1500,
        before.cache_enabled ?? false,
        before.cache_ttl_ms ?? 180000,
        before.cache_by_param ?? false,
        before.cache_by_user ?? false,
        before.engine_type,
        before.metadata_json,
        before.access_control,
        snapshot.target,
      ]);
      refreshOpenApiDocumentationCaches(snapshot.target);
      return;
    }

    await deleteManagedFunction(snapshot.target);
    refreshOpenApiDocumentationCaches(snapshot.target);
  }
}

export const changeSetService = new ChangeSetService();
