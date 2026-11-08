import { createRequire } from 'node:module';
import path from 'node:path';
import {
  ensureDeveloperLibrariesStore,
  getDeveloperLibrariesRoot,
} from '../libraries/developerLibrariesStore';

function libsRequire() {
  ensureDeveloperLibrariesStore();
  return createRequire(path.join(getDeveloperLibrariesRoot(), 'package.json'));
}

/**
 * Resolve a Remote Hubs native/protocol library from packages-storage/libs only.
 * Host node_modules is not a fallback — uninstall must actually drop these packages.
 */
export function requireRemoteHubLibrary<T>(specifier: string): T {
  try {
    return libsRequire()(specifier) as T;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Remote Hubs library "${specifier}" is not installed. Install the Remote Hubs package. ${detail}`,
    );
  }
}

export function resolveRemoteHubLibraryPath(specifier: string): string {
  try {
    return libsRequire().resolve(specifier);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Remote Hubs library "${specifier}" is not installed. Install the Remote Hubs package. ${detail}`,
    );
  }
}

export function isRemoteHubLibraryInstalled(specifier: string): boolean {
  try {
    libsRequire().resolve(specifier);
    return true;
  } catch {
    return false;
  }
}
