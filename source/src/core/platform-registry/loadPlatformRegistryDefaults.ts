import fs from 'fs';
import path from 'path';
import type {
  PlatformMount,
  PlatformPageModule,
  PlatformRouteBinding,
  PlatformShell,
  PlatformShellRule,
} from '../../shared/api/contracts/platform/types';
import type { NavigationManifest } from '../../shared/api/contracts/platform/navigation';
import { PLATFORM_REGISTRY_DEFAULTS_ROOT } from './platformRegistryDefaults';

function readEntityFiles<T>(subdir: string): T[] {
  const dir = path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, subdir);
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as T);
}

export function loadPlatformRegistryDefaultMounts(): PlatformMount[] {
  return readEntityFiles<PlatformMount>('mounts');
}

export function loadPlatformRegistryDefaultShells(): PlatformShell[] {
  return readEntityFiles<PlatformShell>('shells');
}

export function loadPlatformRegistryDefaultShellRules(): PlatformShellRule[] {
  return readEntityFiles<PlatformShellRule>('shell-rules');
}

export function loadPlatformRegistryDefaultPageModules(): PlatformPageModule[] {
  return readEntityFiles<PlatformPageModule>('page-modules');
}

export function loadPlatformRegistryDefaultRouteBindings(): PlatformRouteBinding[] {
  return readEntityFiles<PlatformRouteBinding>('route-bindings');
}

export function loadPlatformRegistryDefaultNavigations(): NavigationManifest[] {
  return readEntityFiles<NavigationManifest>('navigation');
}

export function loadPlatformRegistryDefaultMount(id: string): PlatformMount | undefined {
  const filePath = path.join(PLATFORM_REGISTRY_DEFAULTS_ROOT, 'mounts', `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as PlatformMount;
}
