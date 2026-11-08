import fs from 'fs';
import path from 'path';
import { packageDirs } from '../../../../core/packages/PackageFileStore';
import { getEnabledInstalledVersionsMap } from '../../package-domain/installStateRepository';
import { readObjectRegistry } from '../../package-domain/objectRegistryRepository';
import { resolveRuntimeEntryPath } from '../../../services/package-runtime/packageUiRuntime.service';
import { createPackageWorkflowActionExecutor } from './packageActionSandboxExecutor';
import type { ActionDefinition, ActionProviderRegistration } from './types';

/**
 * p-99/WFT-1 — live, mtime-cached resolver for package-contributed workflow Actions. Deliberately
 * NOT part of `registry.ts`'s in-process `definitions`/`providers` Maps (that registry is a "doc04
 * §3... sole authority... boot-time registration" frozen contract — this module does not touch it).
 * Instead it mirrors `packageApiRuntime.service.ts`'s `listCompiledApiRoutes` pattern exactly: a
 * package install/uninstall/enable/disable only ever touches files under `packageDirs.installed`/
 * `packageDirs.objects`, so a cheap signature over those two directories' file mtimes is enough to
 * know when to re-scan — no server restart needed to pick up a newly installed package's Actions.
 *
 * IMPORTANT — this resolver is not yet consulted by the live dispatch engine (`dispatchService.ts`/
 * `actionResolutionValidation.ts` still only resolve CORE/PLATFORM Actions via `registry.ts`). That
 * wiring is deliberately deferred to its own focused pass (see `plans/core/todo/
 * p-99-workflow-toolbox-upgrade.md`, WFT-1) — it touches the heavily-tested dispatch core and
 * deserves its own dedicated verification, not a same-turn bolt-on. This module is real, tested,
 * and callable today; it is simply not wired into a caller yet.
 */

export type PackageActionEntry = {
  packageId: string;
  version: string;
  definition: ActionDefinition;
  scriptRuntimePath: string;
};

type PackageActionIndexCache = {
  entries: Map<string, PackageActionEntry>;
  signature: string;
};

let cache: PackageActionIndexCache | null = null;

function computeDirFilesSignature(dirPath: string): string {
  let fileNames: string[];
  try {
    fileNames = fs.readdirSync(dirPath).sort();
  } catch {
    return '';
  }
  const parts: string[] = [];
  for (const fileName of fileNames) {
    try {
      const stat = fs.statSync(path.join(dirPath, fileName));
      parts.push(`${fileName}:${stat.mtimeMs}`);
    } catch {
      // File removed between readdir and stat — ignore, next call reconciles.
    }
  }
  return parts.join(',');
}

function computeIndexSignature(): string {
  return `${computeDirFilesSignature(packageDirs.installed)}|${computeDirFilesSignature(packageDirs.objects)}`;
}

const entryKey = (actionKey: string, actionVersion: string): string => `${actionKey}@${actionVersion}`;

function buildIndex(): Map<string, PackageActionEntry> {
  const entries = new Map<string, PackageActionEntry>();
  const enabledMap = getEnabledInstalledVersionsMap();

  for (const [packageId, version] of enabledMap.entries()) {
    const registry = readObjectRegistry(packageId);
    if (!registry) continue;

    for (const record of registry.records.workflowActions ?? []) {
      const definitionPath = resolveRuntimeEntryPath(packageId, version, record.definitionEntry);
      const scriptPath = resolveRuntimeEntryPath(packageId, version, record.scriptEntry);
      if (!definitionPath || !scriptPath) continue;

      let definition: ActionDefinition;
      try {
        definition = JSON.parse(fs.readFileSync(definitionPath, 'utf8')) as ActionDefinition;
      } catch {
        continue; // Extraction already validated this file; a read failure here is transient/removed.
      }

      const key = entryKey(record.actionKey, record.actionVersion);
      if (entries.has(key)) continue; // First enabled package wins; true conflict rejection happens at install time.
      entries.set(key, { packageId, version, definition, scriptRuntimePath: scriptPath });
    }
  }

  return entries;
}

function listEntries(): Map<string, PackageActionEntry> {
  const signature = computeIndexSignature();
  if (cache && cache.signature === signature) {
    return cache.entries;
  }
  const entries = buildIndex();
  cache = { entries, signature };
  return entries;
}

export function resolvePackageActionDefinition(actionKey: string, actionVersion: string): ActionDefinition | undefined {
  return listEntries().get(entryKey(actionKey, actionVersion))?.definition;
}

export function resolvePackageActionProvider(actionKey: string, actionVersion: string): ActionProviderRegistration | undefined {
  const entry = listEntries().get(entryKey(actionKey, actionVersion));
  if (!entry) return undefined;
  return {
    actionKey,
    actionVersion,
    providerId: entry.packageId,
    providerVersion: entry.version,
    contributorType: 'PACKAGE',
    providesCapabilities: entry.definition.requiredCapabilities,
    registryPriority: entry.definition.registryPriority ?? 1000,
    executor: createPackageWorkflowActionExecutor(entry.packageId, entry.scriptRuntimePath, entry.definition.executionTimeoutMs),
  };
}

export function listPackageActionDefinitions(): ActionDefinition[] {
  return Array.from(listEntries().values()).map((entry) => entry.definition);
}

/** Test-only cache reset — the live index otherwise persists for the process lifetime between signature changes. */
export function __resetPackageActionRegistryCacheForTests(): void {
  cache = null;
}
