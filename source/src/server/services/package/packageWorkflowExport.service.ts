import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { exportWorkflowDefinition } from '../../domain/workflow/portability/workflowDefinitionPortabilityService';
import { findWorkflowDefinitionByScopeAndKey, getWorkflowDefinitionById } from '../../domain/workflow/workflowDefinitionRepository';

export type PackageWorkflowExportZipEntry = {
  path: string;
  content: Buffer;
};

export type CapabilityWorkflow = {
  scopeKey: string;
  key: string;
  entry: string;
};

export type PackageWorkflowExportResult = {
  capabilities: { workflows: CapabilityWorkflow[] };
  zipEntries: PackageWorkflowExportZipEntry[];
  warnings: string[];
};

function jsonEntry(entryPath: string, payload: unknown): PackageWorkflowExportZipEntry {
  return { path: entryPath, content: Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8') };
}

/**
 * WFV2-23 — package ZIP entries for selected workflow definitions (authoring bundles only).
 * Selection is by definition id or by `scopeKey/key` pairs.
 */
export async function buildPackageWorkflowExportEntries(input: {
  workflowDefinitionIds?: number[];
  workflowKeys?: Array<{ scopeKey?: string; key: string }>;
}): Promise<PackageWorkflowExportResult | { ok: false; error: string; details: string[] }> {
  const warnings: string[] = [];
  const details: string[] = [];
  const definitionIds = new Set<number>();

  for (const id of input.workflowDefinitionIds ?? []) {
    if (Number.isFinite(id) && id > 0) definitionIds.add(id);
  }

  for (const ref of input.workflowKeys ?? []) {
    const scopeKey = (ref.scopeKey?.trim() || 'global').trim();
    const key = ref.key?.trim();
    if (!key) {
      details.push('workflowKeys entries require a non-empty key.');
      continue;
    }
    const found = await findWorkflowDefinitionByScopeAndKey(scopeKey, key);
    if (!found) {
      details.push(`Workflow "${scopeKey}/${key}" was not found.`);
      continue;
    }
    definitionIds.add(found.id);
  }

  if (details.length > 0 && definitionIds.size === 0) {
    return { ok: false, error: 'One or more requested workflows were not found.', details };
  }

  const workflows: CapabilityWorkflow[] = [];
  const zipEntries: PackageWorkflowExportZipEntry[] = [];

  for (const id of definitionIds) {
    const definition = await getWorkflowDefinitionById(id);
    if (!definition) {
      details.push(`Workflow definition id ${id} was not found.`);
      continue;
    }
    const { bundle } = await exportWorkflowDefinition(id);
    const entry = `workflows/${definition.scopeKey}/${definition.key}.json`;
    workflows.push({ scopeKey: definition.scopeKey, key: definition.key, entry });
    zipEntries.push(jsonEntry(entry, bundle));
  }

  if (details.length > 0 && workflows.length === 0) {
    return { ok: false, error: 'One or more requested workflows were not found.', details };
  }
  if (details.length > 0) {
    warnings.push(...details);
  }

  return {
    capabilities: { workflows },
    zipEntries,
    warnings,
  };
}

export type { PackageManifest };
