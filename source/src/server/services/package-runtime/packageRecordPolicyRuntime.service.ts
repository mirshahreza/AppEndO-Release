import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { packageDirs, readPackageIndex } from '../../../core/packages/PackageFileStore';
import { saveRecordPolicy, deleteRecordPolicy } from '../record-policy/recordPolicyStore';
import { saveRecordPolicyBinding, deleteRecordPolicyBinding } from '../record-policy/recordPolicyBindingStore';
import {
  isPresetScopeDimensionKey,
  normalizeRecordPolicyBindingDocument,
  normalizeRecordPolicyDocument,
} from '../../../shared/api/contracts/record-policy';

export type PackageRecordPolicyInstallResult =
  | {
    ok: true;
    installed: { dimensions: string[]; policies: string[]; bindings: string[] };
  }
  | {
    ok: false;
    error: string;
    details: string[];
    installed: { dimensions: string[]; policies: string[]; bindings: string[] };
  };

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
 * Install Record Policy authoring artifacts from a package zip.
 * Built-in dimensions are platform-native (acknowledged, not written).
 * Custom dimension payloads are ignored. Memberships are never installed (D9).
 */
export async function installPackageRecordPolicyData(
  packageId: string,
  version: string,
  manifest: PackageManifest,
): Promise<PackageRecordPolicyInstallResult> {
  const dimensions = manifest.capabilities.scope_dimensions ?? [];
  const policies = manifest.capabilities.record_policies ?? [];
  const bindings = manifest.capabilities.record_policy_bindings ?? [];

  if (dimensions.length === 0 && policies.length === 0 && bindings.length === 0) {
    return { ok: true, installed: { dimensions: [], policies: [], bindings: [] } };
  }

  const artifactPath = resolveArtifactPath(packageId, version);
  if (!artifactPath || !fs.existsSync(artifactPath)) {
    return { ok: false, error: `Artifact for package "${packageId}"@${version} was not found.`, details: [], installed: { dimensions: [], policies: [], bindings: [] } };
  }

  const details: string[] = [];
  const installedDimensions: string[] = [];
  const installedPolicies: string[] = [];
  const installedBindings: string[] = [];

  for (const item of dimensions) {
    if (isPresetScopeDimensionKey(item.key)) {
      installedDimensions.push(item.key);
    }
  }

  for (const item of bindings) {
    const raw = readJsonFromArtifact(artifactPath, item.entry);
    if (raw === undefined) {
      details.push(`Record policy binding entry "${item.entry}" is missing from artifact.`);
      continue;
    }
    const normalized = normalizeRecordPolicyBindingDocument(raw);
    if (!normalized.ok) {
      details.push(`Record policy binding "${item.edgeModelId}" failed: ${normalized.message}`);
      continue;
    }
    try {
      saveRecordPolicyBinding(normalized.binding);
      installedBindings.push(normalized.binding.edgeModelId);
    } catch (error: unknown) {
      details.push(`Record policy binding "${item.edgeModelId}" failed: ${error instanceof Error ? error.message : 'save error'}`);
    }
  }

  for (const item of policies) {
    const raw = readJsonFromArtifact(artifactPath, item.entry);
    if (raw === undefined) {
      details.push(`Record policy entry "${item.entry}" is missing from artifact.`);
      continue;
    }
    const normalized = normalizeRecordPolicyDocument(raw);
    if (!normalized.ok) {
      details.push(`Record policy "${item.id}" failed: ${normalized.message}`);
      continue;
    }
    try {
      saveRecordPolicy(normalized.policy);
      installedPolicies.push(normalized.policy.id);
    } catch (error: unknown) {
      details.push(`Record policy "${item.id}" failed: ${error instanceof Error ? error.message : 'save error'}`);
    }
  }

  if (details.length > 0) {
    return { ok: false, error: 'One or more record-policy capabilities failed to install.', details, installed: {
      dimensions: installedDimensions,
      policies: installedPolicies,
      bindings: installedBindings,
    } };
  }

  return {
    ok: true,
    installed: {
      dimensions: installedDimensions,
      policies: installedPolicies,
      bindings: installedBindings,
    },
  };
}

export function uninstallPackageRecordPolicyData(installed: {
  policies: string[];
  bindings: string[];
}): void {
  for (const bindingId of installed.bindings) {
    deleteRecordPolicyBinding(bindingId);
  }
  for (const policyId of installed.policies) {
    deleteRecordPolicy(policyId);
  }
}

