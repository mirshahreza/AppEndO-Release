import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { packageDirs, readPackageIndex } from '../../../core/packages/PackageFileStore';
import { importWorkflowDefinition } from '../../domain/workflow/portability/workflowDefinitionPortabilityService';
import { findWorkflowDefinitionByScopeAndKey } from '../../domain/workflow/workflowDefinitionRepository';
import { deleteWorkflowDefinition } from '../../domain/workflow/workflowDefinitionDeletionService';
import type { PluginObjectRegistry } from '../../domain/package-domain/types';

export type PackageWorkflowInstallResult =
  | { ok: true; installed: Array<{ scopeKey: string; key: string; definitionId: number }> }
  | { ok: false; error: string; details: string[] };

function normalizeZipEntryName(entryName: string): string {
  return entryName.replace(/\\/g, '/').replace(/^\.\//, '');
}

function resolveArtifactPath(packageId: string, version: string): string | null {
  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === packageId);
  const versionEntry = entry?.versions.find((item) => item.version === version);
  if (!versionEntry?.artifactPath) return null;
  return path.join(packageDirs.root, versionEntry.artifactPath.replace(/\\/g, '/'));
}

function readJsonFromArtifact(artifactPath: string, entryPath: string): unknown {
  const zip = new AdmZip(artifactPath);
  const normalized = normalizeZipEntryName(entryPath);
  const entry = zip.getEntries().find((item) => normalizeZipEntryName(item.entryName) === normalized);
  if (!entry || entry.isDirectory) return undefined;
  return JSON.parse(entry.getData().toString('utf8'));
}

/**
 * Installs `capabilities.workflows` from a package artifact into the control-plane DB as DRAFT
 * definitions (import never auto-publishes; webhook secrets are never imported).
 */
export async function installPackageWorkflows(
  packageId: string,
  version: string,
  manifest: PackageManifest,
): Promise<PackageWorkflowInstallResult> {
  const workflows = manifest.capabilities.workflows ?? [];
  if (workflows.length === 0) {
    return { ok: true, installed: [] };
  }

  const artifactPath = resolveArtifactPath(packageId, version);
  if (!artifactPath || !fs.existsSync(artifactPath)) {
    return { ok: false, error: `Artifact for package "${packageId}"@${version} was not found.`, details: [] };
  }

  const details: string[] = [];
  const installed: Array<{ scopeKey: string; key: string; definitionId: number }> = [];

  for (const item of workflows) {
    const scopeKey = (item.scopeKey || 'global').trim();
    const key = item.key.trim();
    try {
      const raw = readJsonFromArtifact(artifactPath, item.entry);
      if (raw === undefined) {
        details.push(`Workflow entry "${item.entry}" was not found in the artifact.`);
        continue;
      }
      const existing = await findWorkflowDefinitionByScopeAndKey(scopeKey, key);
      const result = await importWorkflowDefinition(raw, {
        scopeKey,
        key,
        overwrite: existing?.lifecycleStatus === 'DRAFT',
      });
      installed.push({ scopeKey, key, definitionId: result.definition.id });
    } catch (error) {
      details.push(
        `Workflow "${scopeKey}/${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (details.length > 0 && installed.length === 0) {
    return { ok: false, error: 'Failed to install package workflows.', details };
  }
  if (details.length > 0) {
    return { ok: false, error: 'Some package workflows failed to install.', details };
  }
  return { ok: true, installed };
}

/** Best-effort uninstall: deletes DRAFT definitions owned by the registry snapshot. ACTIVE defs are left (operator must unpublish). */
export async function uninstallPackageWorkflows(registry: PluginObjectRegistry): Promise<void> {
  for (const record of registry.records.workflows ?? []) {
    const existing = await findWorkflowDefinitionByScopeAndKey(record.scopeKey, record.key);
    if (!existing) continue;
    if (existing.lifecycleStatus !== 'DRAFT') continue;
    try {
      await deleteWorkflowDefinition(existing.id, existing.stateVersion);
    } catch {
      // Best-effort uninstall — leave conflicts for operator.
    }
  }
}
