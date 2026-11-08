import path from 'path';
import { WORKSPACE_ROOT, runtimeDirs } from '../runtime/runtimePaths';

export const PLATFORM_REGISTRY_ROOT = path.join(WORKSPACE_ROOT, 'platform-registry');

export const platformRegistryDirs = {
  root: PLATFORM_REGISTRY_ROOT,
  mounts: path.join(PLATFORM_REGISTRY_ROOT, 'mounts'),
  shells: path.join(PLATFORM_REGISTRY_ROOT, 'shells'),
  pageModules: path.join(PLATFORM_REGISTRY_ROOT, 'page-modules'),
  shellRules: path.join(PLATFORM_REGISTRY_ROOT, 'shell-rules'),
  routeBindings: path.join(PLATFORM_REGISTRY_ROOT, 'route-bindings'),
  navigations: path.join(PLATFORM_REGISTRY_ROOT, 'navigation'),
  locks: path.join(PLATFORM_REGISTRY_ROOT, 'locks'),
  tmp: runtimeDirs.workspaceTemp,
} as const;

export const PLATFORM_REGISTRY_INDEX_PATH = path.join(PLATFORM_REGISTRY_ROOT, 'index.json');
