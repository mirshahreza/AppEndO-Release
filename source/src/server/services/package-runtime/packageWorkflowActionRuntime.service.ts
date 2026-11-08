import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { atomicWriteBinary, packageDirs, readPackageIndex } from '../../../core/packages/PackageFileStore';
import { actionDefinitionSchema } from '../../domain/workflow/actions/schemas';
import { getPackageRuntimeRoot, isSafeRelativeEntry, resolveRuntimeEntryPath } from './packageUiRuntime.service';

export type WorkflowActionRuntimeExtractResult =
  | { ok: true; extractedCount: number }
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

function readZipEntryMap(artifactPath: string): Map<string, Buffer> | null {
  if (!fs.existsSync(artifactPath)) return null;
  const zip = new AdmZip(artifactPath);
  const entries = new Map<string, Buffer>();
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    entries.set(normalizeZipEntryName(entry.entryName), entry.getData());
  }
  return entries;
}

/**
 * Extracts `capabilities.workflow_actions` (p-99/WFT-1) into the package's shared runtime root —
 * the same directory `extractPackageApiRuntime` uses, so `removePluginUiRuntime`'s existing
 * whole-directory wipe on uninstall already covers these files with no dedicated removal code.
 *
 * The definition JSON is validated against `actionDefinitionSchema` here, at install time, with
 * `key`/`version`/`contributor`/`availability`/`executionMode` always forced server-side —
 * never trusted from the package, even if its JSON sets them. This is fail-fast: a malformed or
 * dishonest definition fails the whole install, matching `installPackageEdgeData`'s per-item
 * validation posture. The script entry is copied verbatim, unvalidated (it is only ever run inside
 * `packageActionSandboxExecutor.ts`'s `vm` sandbox, never `require()`d natively — see that
 * module's doc comment for the security rationale).
 */
export function extractPackageWorkflowActionRuntime(
  packageId: string,
  version: string,
  manifest: PackageManifest,
): WorkflowActionRuntimeExtractResult {
  const actions = manifest.capabilities.workflow_actions ?? [];
  if (actions.length === 0) {
    return { ok: true, extractedCount: 0 };
  }

  const artifactPath = resolveArtifactPath(packageId, version);
  if (!artifactPath) {
    return { ok: false, error: `Artifact for package "${packageId}"@${version} was not found.`, details: [] };
  }

  const zipEntries = readZipEntryMap(artifactPath);
  if (!zipEntries) {
    return { ok: false, error: `Artifact for package "${packageId}"@${version} could not be read.`, details: [] };
  }

  const runtimeRoot = getPackageRuntimeRoot(packageId, version);
  fs.mkdirSync(runtimeRoot, { recursive: true });

  const details: string[] = [];
  let extractedCount = 0;

  for (const action of actions) {
    const definitionEntry = normalizeZipEntryName(action.definitionEntry);
    const scriptEntry = normalizeZipEntryName(action.scriptEntry);
    const label = `${action.key}@${action.version}`;

    if (!isSafeRelativeEntry(definitionEntry) || !isSafeRelativeEntry(scriptEntry)) {
      details.push(`Unsafe entry path for workflow action "${label}".`);
      continue;
    }

    const definitionRaw = zipEntries.get(definitionEntry);
    const scriptRaw = zipEntries.get(scriptEntry);
    if (!definitionRaw) {
      details.push(`Workflow action "${label}": definition entry "${action.definitionEntry}" is missing from artifact.`);
      continue;
    }
    if (!scriptRaw) {
      details.push(`Workflow action "${label}": script entry "${action.scriptEntry}" is missing from artifact.`);
      continue;
    }

    let parsedDefinition: unknown;
    try {
      parsedDefinition = JSON.parse(definitionRaw.toString('utf8'));
    } catch {
      details.push(`Workflow action "${label}": definitionEntry is not valid JSON.`);
      continue;
    }
    if (!parsedDefinition || typeof parsedDefinition !== 'object' || Array.isArray(parsedDefinition)) {
      details.push(`Workflow action "${label}": definitionEntry must be a JSON object.`);
      continue;
    }

    const forced = {
      ...(parsedDefinition as Record<string, unknown>),
      key: action.key,
      version: action.version,
      contributor: { type: 'PACKAGE' as const, id: packageId },
      availability: 'AVAILABLE' as const,
      executionMode: 'DETERMINISTIC' as const,
      agenticConstraints: undefined,
    };
    const validation = actionDefinitionSchema.safeParse(forced);
    if (!validation.success) {
      details.push(`Workflow action "${label}": ${validation.error.issues.map((i) => i.message).join('; ')}`);
      continue;
    }

    const definitionTargetPath = resolveRuntimeEntryPath(packageId, version, definitionEntry);
    const scriptTargetPath = resolveRuntimeEntryPath(packageId, version, scriptEntry);
    if (!definitionTargetPath || !scriptTargetPath) {
      details.push(`Workflow action "${label}": entry path resolved outside runtime root.`);
      continue;
    }

    fs.mkdirSync(path.dirname(definitionTargetPath), { recursive: true });
    fs.mkdirSync(path.dirname(scriptTargetPath), { recursive: true });
    atomicWriteBinary(definitionTargetPath, Buffer.from(JSON.stringify(validation.data)));
    atomicWriteBinary(scriptTargetPath, scriptRaw);
    extractedCount += 1;
  }

  if (details.length > 0) {
    return { ok: false, error: 'Failed to extract one or more package workflow actions.', details };
  }

  return { ok: true, extractedCount };
}
