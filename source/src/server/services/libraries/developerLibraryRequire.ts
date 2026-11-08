import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ensureDeveloperLibrariesStore, getDeveloperLibrariesManifestPath } from './developerLibrariesStore';

export function createDeveloperLibraryRequire(projectRoot = process.cwd()) {
  ensureDeveloperLibrariesStore(projectRoot);
  return createRequire(getDeveloperLibrariesManifestPath(projectRoot));
}

export async function importDeveloperLibrary(specifier: string, projectRoot = process.cwd()): Promise<unknown> {
  const requireLib = createDeveloperLibraryRequire(projectRoot);
  const resolved = requireLib.resolve(specifier);
  return import(pathToFileURL(resolved).href);
}
