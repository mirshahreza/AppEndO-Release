/**
 * PlatformRegistryFileStore — file-based persistence for core platform registry rows.
 * Layout: workspace/platform-registry/{mounts,shells,page-modules,shell-rules,route-bindings}/
 */

import fs from 'fs';
import path from 'path';
import {
  acquireRuntimeLock,
  atomicWriteText,
  atomicWriteTextIfChanged,
  cleanupRuntimeTmpFiles,
  ensureRuntimeDirs,
  releaseRuntimeLock,
} from '../runtime/RuntimeFileStore';
import {
  PLATFORM_REGISTRY_INDEX_PATH,
  platformRegistryDirs,
} from './platformRegistryPaths';
import { parseHomeWidgetsField } from '../../shared/api/contracts/home-widgets';
import type {
  PlatformMount,
  PlatformPageModule,
  PlatformRouteBinding,
  PlatformShell,
  PlatformShellRule,
} from '../../shared/api/contracts/platform/types';
import type { NavigationManifest } from '../../shared/api/contracts/platform/navigation';
import {
  clearRegistryEntityDeleted,
  markRegistryEntityDeleted,
} from './platformRegistryDeletions';
import {
  HAWIETY_PACKAGE_ID,
  HAWIETY_PORTAL_SEGMENT,
  isHawietyHostPageKey,
  isHawietyRoutePattern,
} from '../packages/hawietyPackage';

const LOCK_NAME = 'platform-registry';

export type PlatformRegistryIndex = {
  schema: 'platform-registry-index';
  schemaVersion: '1.0.0';
  updatedAt: string;
};

function makeEmptyIndex(): PlatformRegistryIndex {
  return {
    schema: 'platform-registry-index',
    schemaVersion: '1.0.0',
    updatedAt: new Date().toISOString(),
  };
}

export function ensurePlatformRegistryDirs(): void {
  ensureRuntimeDirs([
    platformRegistryDirs.root,
    platformRegistryDirs.mounts,
    platformRegistryDirs.shells,
    platformRegistryDirs.pageModules,
    platformRegistryDirs.shellRules,
    platformRegistryDirs.routeBindings,
    platformRegistryDirs.navigations,
    platformRegistryDirs.locks,
    platformRegistryDirs.tmp,
  ]);
}

export function cleanupPlatformRegistryTmpFiles(): void {
  cleanupRuntimeTmpFiles(platformRegistryDirs.tmp);
}

export function readPlatformRegistryIndex(): PlatformRegistryIndex {
  if (!fs.existsSync(PLATFORM_REGISTRY_INDEX_PATH)) {
    return makeEmptyIndex();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(PLATFORM_REGISTRY_INDEX_PATH, 'utf8')) as PlatformRegistryIndex;
    return { ...makeEmptyIndex(), ...parsed };
  } catch {
    return makeEmptyIndex();
  }
}

export function touchPlatformRegistryIndex(): void {
  const index = readPlatformRegistryIndex();
  index.updatedAt = new Date().toISOString();
  atomicWriteText(
    PLATFORM_REGISTRY_INDEX_PATH,
    `${JSON.stringify(index, null, 2)}\n`,
    platformRegistryDirs.tmp,
  );
}

export function withPlatformRegistryLock<T>(fn: () => T): T {
  if (!acquireRuntimeLock(platformRegistryDirs.locks, LOCK_NAME)) {
    throw new Error('Platform registry is locked by another process.');
  }
  try {
    return fn();
  } finally {
    releaseRuntimeLock(platformRegistryDirs.locks, LOCK_NAME);
  }
}

function entityPath(dir: string, fileName: string): string {
  return path.join(dir, fileName);
}

function listEntityFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.json'));
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function writeJsonFile(filePath: string, value: unknown): boolean {
  return atomicWriteTextIfChanged(
    filePath,
    `${JSON.stringify(value, null, 2)}\n`,
    platformRegistryDirs.tmp,
  );
}

function deleteJsonFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function mountFilePath(id: string): string {
  return entityPath(platformRegistryDirs.mounts, `${id}.json`);
}

function shellFilePath(shellKey: string): string {
  return entityPath(platformRegistryDirs.shells, `${shellKey}.json`);
}

function pageModuleFilePath(pageKey: string): string {
  return entityPath(platformRegistryDirs.pageModules, `${pageKey}.json`);
}

function shellRuleFilePath(id: number): string {
  return entityPath(platformRegistryDirs.shellRules, `${id}.json`);
}

function routeBindingFilePath(id: number): string {
  return entityPath(platformRegistryDirs.routeBindings, `${id}.json`);
}

export function listMountFiles(): PlatformMount[] {
  return listEntityFiles(platformRegistryDirs.mounts)
    .map((name) => readJsonFile<PlatformMount>(path.join(platformRegistryDirs.mounts, name)))
    .filter((item): item is PlatformMount => item != null);
}

export function readMountFile(id: string): PlatformMount | null {
  return readJsonFile<PlatformMount>(mountFilePath(id));
}

export function writeMountFile(mount: PlatformMount): void {
  clearRegistryEntityDeleted('mounts', mount.id);
  writeJsonFile(mountFilePath(mount.id), mount);
}

export function deleteMountFile(id: string): void {
  deleteJsonFile(mountFilePath(id));
  markRegistryEntityDeleted('mounts', id);
}

export function listShellFiles(): PlatformShell[] {
  return listEntityFiles(platformRegistryDirs.shells)
    .map((name) => readJsonFile<PlatformShell>(path.join(platformRegistryDirs.shells, name)))
    .filter((item): item is PlatformShell => item != null);
}

export function readShellFile(shellKey: string): PlatformShell | null {
  return readJsonFile<PlatformShell>(shellFilePath(shellKey));
}

export function writeShellFile(shell: PlatformShell): void {
  clearRegistryEntityDeleted('shells', shell.shellKey);
  writeJsonFile(shellFilePath(shell.shellKey), shell);
}

export function deleteShellFile(shellKey: string): void {
  deleteJsonFile(shellFilePath(shellKey));
  markRegistryEntityDeleted('shells', shellKey);
}

export function listPageModuleFiles(): PlatformPageModule[] {
  return listEntityFiles(platformRegistryDirs.pageModules)
    .map((name) => readJsonFile<PlatformPageModule>(path.join(platformRegistryDirs.pageModules, name)))
    .filter((item): item is PlatformPageModule => item != null);
}

export function readPageModuleFile(pageKey: string): PlatformPageModule | null {
  return readJsonFile<PlatformPageModule>(pageModuleFilePath(pageKey));
}

export function writePageModuleFile(pageModule: PlatformPageModule): void {
  const homeWidgets = pageModule.homeWidgets === undefined
    ? undefined
    : parseHomeWidgetsField(pageModule.homeWidgets);
  clearRegistryEntityDeleted('page-modules', pageModule.pageKey);
  const changed = writeJsonFile(pageModuleFilePath(pageModule.pageKey), {
    ...pageModule,
    homeWidgets,
  });
  if (changed) {
    touchPlatformRegistryIndex();
  }
}

export function deletePageModuleFile(pageKey: string): void {
  deleteJsonFile(pageModuleFilePath(pageKey));
  markRegistryEntityDeleted('page-modules', pageKey);
}

export function listShellRuleFiles(): PlatformShellRule[] {
  return listEntityFiles(platformRegistryDirs.shellRules)
    .map((name) => readJsonFile<PlatformShellRule>(path.join(platformRegistryDirs.shellRules, name)))
    .filter((item): item is PlatformShellRule => item != null);
}

export function readShellRuleFile(id: number): PlatformShellRule | null {
  return readJsonFile<PlatformShellRule>(shellRuleFilePath(id));
}

export function writeShellRuleFile(rule: PlatformShellRule): void {
  writeJsonFile(shellRuleFilePath(rule.id), rule);
}

export function deleteShellRuleFile(id: number): void {
  deleteJsonFile(shellRuleFilePath(id));
}

export function listRouteBindingFiles(): PlatformRouteBinding[] {
  return listEntityFiles(platformRegistryDirs.routeBindings)
    .map((name) => readJsonFile<PlatformRouteBinding>(path.join(platformRegistryDirs.routeBindings, name)))
    .filter((item): item is PlatformRouteBinding => item != null);
}

export function readRouteBindingFile(id: number): PlatformRouteBinding | null {
  return readJsonFile<PlatformRouteBinding>(routeBindingFilePath(id));
}

export function writeRouteBindingFile(binding: PlatformRouteBinding): boolean {
  clearRegistryEntityDeleted('route-bindings', String(binding.id));
  const changed = writeJsonFile(routeBindingFilePath(binding.id), binding);
  if (changed) {
    touchPlatformRegistryIndex();
  }
  return changed;
}

export function deleteRouteBindingFile(id: number): void {
  deleteJsonFile(routeBindingFilePath(id));
  markRegistryEntityDeleted('route-bindings', String(id));
}

function navigationFilePath(id: string): string {
  return entityPath(platformRegistryDirs.navigations, `${id}.json`);
}

export function listNavigationFiles(): NavigationManifest[] {
  return listEntityFiles(platformRegistryDirs.navigations)
    .map((name) => readJsonFile<NavigationManifest>(path.join(platformRegistryDirs.navigations, name)))
    .filter((item): item is NavigationManifest => item != null);
}

export function readNavigationFile(id: string): NavigationManifest | null {
  return readJsonFile<NavigationManifest>(navigationFilePath(id));
}

export function writeNavigationFile(manifest: NavigationManifest): void {
  clearRegistryEntityDeleted('navigation', manifest.id);
  const changed = writeJsonFile(navigationFilePath(manifest.id), manifest);
  if (changed) {
    touchPlatformRegistryIndex();
  }
}

export function deleteNavigationFile(id: string): void {
  deleteJsonFile(navigationFilePath(id));
  markRegistryEntityDeleted('navigation', id);
  touchPlatformRegistryIndex();
}

export function nextShellRuleId(): number {
  const ids = listShellRuleFiles().map((item) => item.id);
  return ids.length === 0 ? 1 : Math.max(...ids) + 1;
}

export function nextRouteBindingId(): number {
  const ids = listRouteBindingFiles().map((item) => item.id);
  return ids.length === 0 ? 1 : Math.max(...ids) + 1;
}

export function deleteShellRulesForMount(mountId: string): void {
  for (const rule of listShellRuleFiles()) {
    if (rule.mountId === mountId) {
      deleteShellRuleFile(rule.id);
    }
  }
}

export function deleteRouteBindingsForMount(mountId: string): void {
  for (const binding of listRouteBindingFiles()) {
    if (binding.mountId === mountId) {
      deleteRouteBindingFile(binding.id);
    }
  }
}

export function deleteRowsByOwnerPluginId(packageId: string): void {
  if (packageId === HAWIETY_PACKAGE_ID && readNavigationFile(HAWIETY_PORTAL_SEGMENT)) {
    deleteNavigationFile(HAWIETY_PORTAL_SEGMENT);
  }

  for (const binding of listRouteBindingFiles()) {
    if (
      binding.ownerPackageId === packageId
      || (packageId === HAWIETY_PACKAGE_ID && isHawietyRoutePattern(binding.routePattern))
    ) {
      deleteRouteBindingFile(binding.id);
    }
  }
  for (const rule of listShellRuleFiles()) {
    if (rule.ownerPackageId === packageId) {
      deleteShellRuleFile(rule.id);
    }
  }
  for (const mount of listMountFiles()) {
    if (mount.ownerPackageId === packageId) {
      deleteMountFile(mount.id);
    }
  }
  for (const pageModule of listPageModuleFiles()) {
    if (
      pageModule.ownerPackageId === packageId
      || (packageId === HAWIETY_PACKAGE_ID && isHawietyHostPageKey(pageModule.pageKey))
    ) {
      deletePageModuleFile(pageModule.pageKey);
    }
  }
  for (const shell of listShellFiles()) {
    if (shell.ownerPackageId === packageId || (packageId === HAWIETY_PACKAGE_ID && shell.shellKey === HAWIETY_PORTAL_SEGMENT)) {
      deleteShellFile(shell.shellKey);
    }
  }
}

export function platformRegistryIsSeeded(): boolean {
  return fs.existsSync(mountFilePath('studio'));
}
