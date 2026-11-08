import fs from 'fs';
import { atomicWriteText, packageDirs } from '../../../core/packages/PackageFileStore';
import { objectRegistryPath } from './storage';
import type { PluginObjectRegistry } from './types';

export function readObjectRegistry(packageId: string): PluginObjectRegistry | null {
  const p = objectRegistryPath(packageId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as PluginObjectRegistry;
  } catch {
    return null;
  }
}

export function writeObjectRegistry(registry: PluginObjectRegistry): void {
  fs.mkdirSync(packageDirs.objects, { recursive: true });
  atomicWriteText(objectRegistryPath(registry.packageId), JSON.stringify(registry, null, 2));
}

export function removeObjectRegistry(packageId: string): void {
  const p = objectRegistryPath(packageId);
  if (fs.existsSync(p)) {
    fs.rmSync(p, { force: true });
  }
}

export function listInstalledObjectRegistriesForConflictScan(
  excludePluginId: string,
  installedPluginIds: ReadonlySet<string>,
): Array<{ ownerPackageId: string; registry: PluginObjectRegistry }> {
  if (!fs.existsSync(packageDirs.objects)) {
    return [];
  }

  const registries: Array<{ ownerPackageId: string; registry: PluginObjectRegistry }> = [];

  for (const file of fs.readdirSync(packageDirs.objects)) {
    if (!file.endsWith('.object-registry.json')) continue;
    const ownerPackageId = file.replace('.object-registry.json', '');
    if (ownerPackageId === excludePluginId) continue;
    if (!installedPluginIds.has(ownerPackageId)) continue;

    const registry = readObjectRegistry(ownerPackageId);
    if (!registry) continue;

    registries.push({ ownerPackageId, registry });
  }

  return registries;
}
