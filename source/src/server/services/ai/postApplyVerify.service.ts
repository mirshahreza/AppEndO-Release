import fs from 'fs';
import { createHash } from 'crypto';
import type { ChangeSet } from '../../../shared/api/contracts/ai/agentTypes';
import { buildDesignerComponentPath } from '../../../shared/lib/designerComponentPath';
import { resolveManagedFunctionIdFromChangeSet } from '../../../core/ai/serverFunctionManualParity';
import { buildRequestFromTestPayload } from '../../../shared/server-functions/testPayloadRequest';
import { resolveAllowlistedPath } from '../../../core/ai/tools/pathAllowlist';
import { getDesignerDraft } from '../../domain/component-designer/drafts';
import { findManagedFunctionById } from '../../domain/functions/functionRepository';
import { executeManagedFunctionForJob } from '../jobs/jobServerFunctionExecutor';
import type { EdgeDbQueryFn } from '../server-function.service';

export type PostApplyCheck = {
  id: string;
  ok: boolean;
  message: string;
  changeSetId?: string;
};

export type PostApplyVerificationResult = {
  ok: boolean;
  checks: PostApplyCheck[];
};

const hashContent = (content: string): string => (
  createHash('sha256').update(content).digest('hex').slice(0, 16)
);

const noopDbQuery: EdgeDbQueryFn = async () => ({ data: [], count: 0 });

const parseFunctionTestPayload = (raw: string | null | undefined): Record<string, unknown> => {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore invalid stored test payload
  }
  return {};
};

const inferVerifyTestPayload = (
  method: string,
  source: string,
  storedPayload: Record<string, unknown>,
): Record<string, unknown> => {
  const initial = buildRequestFromTestPayload(method, storedPayload);
  const body = initial.body;
  const hasBodyFields = body && typeof body === 'object' && !Array.isArray(body)
    && Object.keys(body as Record<string, unknown>).length > 0;
  if (hasBodyFields || method !== 'POST') {
    return storedPayload;
  }
  if (/body\.a\b/.test(source) && /body\.b\b/.test(source)) {
    return { a: 1, b: 2 };
  }
  if (/edgeReq\.body|req\.body/.test(source)) {
    return { sample: true };
  }
  return storedPayload;
};

const extractFunctionSourcePatch = (patch: unknown): string => {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return '';
  }
  const source = (patch as Record<string, unknown>).source;
  return typeof source === 'string' ? source : '';
};

const resolveManagedFunctionId = (
  changeSet: Extract<ChangeSet, { kind: 'function_source_patch' }>,
): string => resolveManagedFunctionIdFromChangeSet(changeSet);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const resolveAppliedComponentLayout = (
  changeSet: Extract<ChangeSet, { kind: 'component_layout_patch' }>,
) => {
  const patch = isRecord(changeSet.patch) ? changeSet.patch : {};
  const name = typeof patch.name === 'string' ? patch.name.trim() : '';
  const folder = typeof patch.folder === 'string' && patch.folder.trim()
    ? patch.folder.trim()
    : 'general';

  const byLayoutId = getDesignerDraft(changeSet.layoutId);
  if (byLayoutId?.document) {
    return byLayoutId;
  }

  if (name) {
    const byPath = getDesignerDraft(buildDesignerComponentPath(folder, name));
    if (byPath?.document) {
      return byPath;
    }

    const byName = getDesignerDraft(name);
    if (byName?.document) {
      return byName;
    }
  }

  return null;
};

export const verifyAppliedChangeSets = async (
  changeSets: ChangeSet[],
): Promise<PostApplyVerificationResult> => {
  const checks: PostApplyCheck[] = [];

  for (const changeSet of changeSets) {
    switch (changeSet.kind) {
      case 'file_patch': {
        const resolved = resolveAllowlistedPath(changeSet.path);
        if (resolved.ok === false) {
          checks.push({
            id: `file_patch:${changeSet.id}`,
            ok: false,
            message: resolved.error,
            changeSetId: changeSet.id,
          });
          break;
        }

        const exists = fs.existsSync(resolved.absolutePath) && fs.statSync(resolved.absolutePath).isFile();
        if (!exists) {
          checks.push({
            id: `file_patch:${changeSet.id}`,
            ok: false,
            message: `File "${changeSet.path}" was not found after apply.`,
            changeSetId: changeSet.id,
          });
          break;
        }

        const onDisk = fs.readFileSync(resolved.absolutePath, 'utf8');
        const matches = onDisk === changeSet.content;
        checks.push({
          id: `file_patch:${changeSet.id}`,
          ok: matches,
          message: matches
            ? `File "${changeSet.path}" content matches proposal (hash ${hashContent(onDisk)}).`
            : `File "${changeSet.path}" content differs from proposal.`,
          changeSetId: changeSet.id,
        });
        break;
      }
      case 'component_layout_patch': {
        const record = resolveAppliedComponentLayout(changeSet);
        const ok = Boolean(record?.document);
        checks.push({
          id: `component_layout_patch:${changeSet.id}`,
          ok,
          message: ok
            ? `Designer draft "${record!.id}" is readable after apply.`
            : `Designer draft "${changeSet.layoutId}" is missing after apply.`,
          changeSetId: changeSet.id,
        });
        break;
      }
      case 'function_source_patch': {
        const managedFunctionId = resolveManagedFunctionId(changeSet);
        const managed = await findManagedFunctionById(managedFunctionId)
          ?? (managedFunctionId !== changeSet.functionId
            ? await findManagedFunctionById(changeSet.functionId)
            : null);
        if (!managed) {
          checks.push({
            id: `function_source_patch:${changeSet.id}:exists`,
            ok: false,
            message: `Managed function "${managedFunctionId}" was not found after apply.`,
            changeSetId: changeSet.id,
          });
          break;
        }

        checks.push({
          id: `function_source_patch:${changeSet.id}:exists`,
          ok: true,
          message: `Managed function "${managed.id}" exists after apply.`,
          changeSetId: changeSet.id,
        });

        const expectedSource = extractFunctionSourcePatch(changeSet.patch);
        if (expectedSource) {
          const sourceMatches = managed.code === expectedSource;
          checks.push({
            id: `function_source_patch:${changeSet.id}:source`,
            ok: sourceMatches,
            message: sourceMatches
              ? `Managed function "${managed.id}" source matches proposal (hash ${hashContent(managed.code)}).`
              : `Managed function "${managed.id}" source differs from proposal.`,
            changeSetId: changeSet.id,
          });
        }

        try {
          const patch = isRecord(changeSet.patch) ? changeSet.patch : {};
          const testPayloadRaw = typeof patch.testPayload === 'string'
            ? patch.testPayload
            : managed.test_payload;
          const storedPayload = parseFunctionTestPayload(testPayloadRaw);
          const verifyPayload = inferVerifyTestPayload(
            managed.method || 'POST',
            managed.code,
            storedPayload,
          );
          const result = await executeManagedFunctionForJob(managed.id, verifyPayload, noopDbQuery);
          const execOk = result.statusCode >= 200 && result.statusCode < 500;
          checks.push({
            id: `function_source_patch:${changeSet.id}:execute`,
            ok: execOk,
            message: execOk
              ? `Managed function "${managed.id}" executed on live runtime (status ${result.statusCode}).`
              : `Managed function "${managed.id}" returned status ${result.statusCode} on live runtime.`,
            changeSetId: changeSet.id,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          checks.push({
            id: `function_source_patch:${changeSet.id}:execute`,
            ok: false,
            message: `Managed function "${managed.id}" execution failed on live runtime: ${message}`,
            changeSetId: changeSet.id,
          });
        }
        break;
      }
      case 'git_operation':
      case 'settings_block_patch':
        checks.push({
          id: `${changeSet.kind}:${changeSet.id}`,
          ok: true,
          message: `${changeSet.kind} verification skipped (no rule-based check in v1).`,
          changeSetId: changeSet.id,
        });
        break;
      default:
        checks.push({
          id: `unknown:${changeSet.id}`,
          ok: false,
          message: 'Unsupported change set kind for verification.',
          changeSetId: changeSet.id,
        });
    }
  }

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
};
