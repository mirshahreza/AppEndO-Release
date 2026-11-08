import fs from 'fs';
import { atomicWriteText, packageDirs, readInstallState } from '../../../core/packages/PackageFileStore';
import { installStatePath } from './storage';
import type { InstallHistoryEntry, InstallStateV1 } from './types';
import { MAX_HISTORY_ITEMS } from './types';

export function readInstallStateV1(packageId: string): InstallStateV1 | null {
  const state = readInstallState(packageId);
  if (!state) return null;
  return state as InstallStateV1;
}

export function writeInstallState(state: InstallStateV1): void {
  fs.mkdirSync(packageDirs.installed, { recursive: true });
  atomicWriteText(installStatePath(state.packageId), JSON.stringify(state, null, 2));
}

export function appendStateHistory(
  state: InstallStateV1,
  entry: InstallHistoryEntry,
): InstallStateV1 {
  const history = [entry, ...(state.history ?? [])].slice(0, MAX_HISTORY_ITEMS);
  return { ...state, history };
}

export function getInstalledPluginIds(): string[] {
  if (!fs.existsSync(packageDirs.installed)) return [];
  return fs
    .readdirSync(packageDirs.installed)
    .filter((f) => f.endsWith('.install-state.json'))
    .map((f) => f.replace('.install-state.json', ''));
}

export function getInstalledVersionsMap(): Map<string, string> {
  const out = new Map<string, string>();
  for (const packageId of getInstalledPluginIds()) {
    const st = readInstallStateV1(packageId);
    if (st?.status === 'installed' && st.activeVersion) {
      out.set(packageId, st.activeVersion);
    }
  }
  return out;
}

export function isPluginRuntimeEnabled(packageId: string): boolean {
  const state = readInstallStateV1(packageId);
  if (!state || state.status !== 'installed' || !state.activeVersion) {
    return false;
  }
  return state.enabled !== false;
}

export function getEnabledInstalledVersionsMap(): Map<string, string> {
  const out = new Map<string, string>();
  for (const packageId of getInstalledPluginIds()) {
    if (!isPluginRuntimeEnabled(packageId)) continue;
    const st = readInstallStateV1(packageId);
    if (st?.activeVersion) {
      out.set(packageId, st.activeVersion);
    }
  }
  return out;
}

export function getRetainedPackageUiVersionsMap(): Map<string, string> {
  const out = new Map<string, string>();
  for (const packageId of getInstalledPluginIds()) {
    const st = readInstallStateV1(packageId);
    if (st?.status !== 'not_installed') continue;
    if (!st.retainedArtifacts?.uiComponents || !st.retainedArtifacts.version) continue;
    out.set(packageId, st.retainedArtifacts.version);
  }
  return out;
}
