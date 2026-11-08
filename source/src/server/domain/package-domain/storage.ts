import path from 'path';
import { packageDirs } from '../../../core/packages/PackageFileStore';

export function installStatePath(packageId: string): string {
  return path.join(packageDirs.installed, `${packageId}.install-state.json`);
}

export function objectRegistryPath(packageId: string): string {
  return path.join(packageDirs.objects, `${packageId}.object-registry.json`);
}

export const GRAPH_PATH = path.join(packageDirs.dependencies, 'graph.json');
