import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { packageDirs, readPackageIndex } from '../../../core/packages/PackageFileStore';
import { validateManifest, type PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { readManifestCapabilityArray } from '../../../core/packages/manifestCapabilityArrays';
import {
  resolveApiMetaEntryPath,
  validatePluginApiMetaSidecar,
} from '../../../core/packages/packageApiMetaSidecar';
import { CORE_SLOT_CATALOG } from '../../../shared/api/contracts/slots/catalog';

const KNOWN_SLOT_IDS = new Set(CORE_SLOT_CATALOG.map((slot) => slot.id));

export type PluginSmokeCheck = {
  id: string;
  ok: boolean;
  message: string;
};

export type PluginSmokeTestResult = {
  ok: boolean;
  checks: PluginSmokeCheck[];
};

function normalizeZipEntryName(entryName: string): string {
  return entryName.replace(/\\/g, '/').replace(/^\.\//, '');
}

function zipHasEntry(entries: Set<string>, entryPath: string): boolean {
  const normalized = normalizeZipEntryName(entryPath);
  return entries.has(normalized);
}

function resolveArtifactPath(packageId: string, version: string): string | null {
  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === packageId);
  const versionEntry = entry?.versions.find((item) => item.version === version);
  if (!versionEntry?.artifactPath) return null;
  return path.join(packageDirs.root, versionEntry.artifactPath.replace(/\\/g, '/'));
}

export function runPluginInstallSmokeTest(
  manifest: PackageManifest,
  packageId: string,
  version: string,
): PluginSmokeTestResult {
  const checks: PluginSmokeCheck[] = [];

  const manifestValidation = validateManifest(manifest);
  checks.push({
    id: 'manifest-valid',
    ok: manifestValidation.valid,
    message: manifestValidation.valid
      ? 'Manifest passed schema validation.'
      : manifestValidation.errors[0] || 'Manifest validation failed.',
  });

  checks.push({
    id: 'manifest-id-match',
    ok: manifest.id === packageId,
    message: manifest.id === packageId
      ? 'Manifest id matches package artifact.'
      : `Manifest id "${manifest.id}" does not match "${packageId}".`,
  });

  const seenUiKeys = new Set<string>();
  for (const ui of readManifestCapabilityArray(manifest.capabilities.ui_components)) {
    const key = `${ui.slotId}::${ui.componentKey}`;
    const duplicate = seenUiKeys.has(key);
    seenUiKeys.add(key);
    checks.push({
      id: `ui-unique-${ui.componentKey}`,
      ok: !duplicate,
      message: duplicate
        ? `Duplicate UI registration for slot "${ui.slotId}" and component "${ui.componentKey}".`
        : `UI component "${ui.componentKey}" is unique within the manifest.`,
    });
    checks.push({
      id: `slot-${ui.slotId}`,
      ok: KNOWN_SLOT_IDS.has(ui.slotId),
      message: KNOWN_SLOT_IDS.has(ui.slotId)
        ? `Slot "${ui.slotId}" is registered in the platform catalog.`
        : `Slot "${ui.slotId}" is not registered in the platform catalog.`,
    });
  }

  const artifactPath = resolveArtifactPath(packageId, version);
  if (!artifactPath || !fs.existsSync(artifactPath)) {
    checks.push({
      id: 'artifact-exists',
      ok: false,
      message: 'Artifact ZIP was not found for smoke test.',
    });
    return { ok: checks.every((check) => check.ok), checks };
  }

  checks.push({
    id: 'artifact-exists',
    ok: true,
    message: 'Artifact ZIP is present.',
  });

  const zip = new AdmZip(artifactPath);
  const entries = new Set(
    zip.getEntries().map((entry) => normalizeZipEntryName(entry.entryName)),
  );

  for (const ui of readManifestCapabilityArray(manifest.capabilities.ui_components)) {
    const exists = zipHasEntry(entries, ui.entry);
    checks.push({
      id: `ui-entry-${ui.componentKey}`,
      ok: exists,
      message: exists
        ? `UI entry "${ui.entry}" exists in artifact.`
        : `UI entry "${ui.entry}" is missing from artifact.`,
    });
  }

  for (const route of manifest.capabilities.ui_routes ?? []) {
    const exists = zipHasEntry(entries, route.entry);
    checks.push({
      id: `ui-route-entry-${route.pageKey}`,
      ok: exists,
      message: exists
        ? `UI route entry "${route.entry}" exists in artifact.`
        : `UI route entry "${route.entry}" is missing from artifact.`,
    });
  }

  for (const api of manifest.capabilities.apis) {
    const exists = zipHasEntry(entries, api.entry);
    checks.push({
      id: `api-entry-${api.id}`,
      ok: exists,
      message: exists
        ? `API entry "${api.entry}" exists in artifact.`
        : `API entry "${api.entry}" is missing from artifact.`,
    });

    const metaEntry = resolveApiMetaEntryPath(api.entry);
    if (!zipHasEntry(entries, metaEntry)) {
      continue;
    }

    const metaPayload = zip.readAsText(metaEntry);
    let parsedMeta: unknown;
    try {
      parsedMeta = JSON.parse(metaPayload);
    } catch {
      checks.push({
        id: `api-meta-${api.id}`,
        ok: false,
        message: `API meta sidecar "${metaEntry}" is not valid JSON.`,
      });
      continue;
    }

    const metaValidation = validatePluginApiMetaSidecar(parsedMeta);
    checks.push({
      id: `api-meta-${api.id}`,
      ok: metaValidation.valid,
      message: metaValidation.valid
        ? `API meta sidecar "${metaEntry}" passed validation.`
        : metaValidation.errors[0] || `API meta sidecar "${metaEntry}" failed validation.`,
    });
  }

  for (const model of manifest.capabilities.edge_models) {
    const exists = zipHasEntry(entries, model.entry);
    checks.push({
      id: `edge-model-entry-${model.id}`,
      ok: exists,
      message: exists
        ? `Edge model entry "${model.entry}" exists in artifact.`
        : `Edge model entry "${model.entry}" is missing from artifact.`,
    });
  }

  for (const api of manifest.capabilities.edge_apis) {
    const exists = zipHasEntry(entries, api.entry);
    checks.push({
      id: `edge-api-entry-${api.id}`,
      ok: exists,
      message: exists
        ? `Edge API entry "${api.entry}" exists in artifact.`
        : `Edge API entry "${api.entry}" is missing from artifact.`,
    });
  }

  for (const meta of manifest.capabilities.edge_model_studio_meta) {
    const exists = zipHasEntry(entries, meta.entry);
    checks.push({
      id: `edge-model-studio-meta-entry-${meta.edgeModelId}`,
      ok: exists,
      message: exists
        ? `Edge model studio-meta entry "${meta.entry}" exists in artifact.`
        : `Edge model studio-meta entry "${meta.entry}" is missing from artifact.`,
    });
  }

  for (const hook of manifest.capabilities.install_hooks) {
    const exists = zipHasEntry(entries, hook.entry);
    checks.push({
      id: `install-hook-entry-${hook.id}`,
      ok: exists,
      message: exists
        ? `Install hook entry "${hook.entry}" exists in artifact.`
        : `Install hook entry "${hook.entry}" is missing from artifact.`,
    });
  }

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}
