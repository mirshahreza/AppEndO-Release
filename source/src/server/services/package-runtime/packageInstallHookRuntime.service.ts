import fs from 'fs';
import path from 'path';
import vm from 'vm';
import AdmZip from 'adm-zip';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { packageDirs, readPackageIndex } from '../../../core/packages/PackageFileStore';
import { invalidateBaseInfoOptionsCache } from '../baseInfoOptionsCache';
import { createPackageInstallHookApi } from './packageInstallHookApi';
import { transpileSandboxSource } from './sandboxTranspile';

export type PackageInstallHookRunResult =
  | { ok: true; executed: string[]; logs: string[] }
  | { ok: false; error: string; details?: string[] };

const DEFAULT_HOOK_TIMEOUT_MS = 30_000;

function normalizeZipEntryName(entryName: string): string {
  return entryName.replace(/\\/g, '/').replace(/^\.\//, '');
}

function resolveArtifactPath(packageId: string, version: string): string | null {
  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === packageId);
  const versionEntry = entry?.versions.find((item) => item.version === version);
  if (!versionEntry?.artifactPath) return null;
  return path.join(packageDirs.root, versionEntry.artifactPath.replace(/\\/g, '/'));
}

function readSourceFromArtifact(artifactPath: string, entryPath: string): string | null {
  const zip = new AdmZip(artifactPath);
  const normalized = normalizeZipEntryName(entryPath);
  const entry = zip.getEntries().find((item) => normalizeZipEntryName(item.entryName) === normalized);
  if (!entry || entry.isDirectory) return null;
  return entry.getData().toString('utf8');
}

async function runSingleHook(
  packageId: string,
  hookId: string,
  source: string,
  entry: string,
  timeoutMs: number,
  onLog: (line: string) => void,
): Promise<void> {
  const compiledCode = await transpileSandboxSource(source, entry);

  const wrappedCode = `(async () => {
    ${compiledCode}
    const __installHook = module.exports?.default ?? module.exports;
    if (typeof __installHook !== 'function') {
      throw new Error('Package install hook must export a default async function.');
    }
    await __installHook(api);
  })()`;

  const moduleRef = { exports: {} as Record<string, unknown> };
  const sandboxEnv = {
    module: moduleRef,
    exports: moduleRef.exports,
    api: createPackageInstallHookApi(packageId, onLog),
  };

  const script = new vm.Script(wrappedCode, { filename: `package-install-hook-${packageId}-${hookId}.js` });
  const context = vm.createContext(sandboxEnv);
  const execution = script.runInContext(context, { timeout: timeoutMs }) as Promise<void>;
  await execution;
}

/** Runs a package's (at most one, per manifest validation) install hook once during install(). */
export async function runPackageInstallHooks(
  packageId: string,
  version: string,
  manifest: PackageManifest,
): Promise<PackageInstallHookRunResult> {
  const hooks = manifest.capabilities.install_hooks;
  if (hooks.length === 0) {
    return { ok: true, executed: [], logs: [] };
  }

  const artifactPath = resolveArtifactPath(packageId, version);
  if (!artifactPath || !fs.existsSync(artifactPath)) {
    return { ok: false, error: `Artifact for package "${packageId}"@${version} was not found.` };
  }

  const executed: string[] = [];
  const logs: string[] = [];

  for (const hook of hooks) {
    const source = readSourceFromArtifact(artifactPath, hook.entry);
    if (!source) {
      return {
        ok: false,
        error: `Install hook entry "${hook.entry}" is missing from artifact.`,
        details: [hook.id],
      };
    }

    const timeoutMs = Math.min(60_000, Math.max(1_000, hook.timeoutMs ?? DEFAULT_HOOK_TIMEOUT_MS));

    try {
      await runSingleHook(packageId, hook.id, source, hook.entry, timeoutMs, (line) => logs.push(`[${hook.id}] ${line}`));
      executed.push(hook.id);
    } catch (error: unknown) {
      // Errors thrown inside the vm sandbox belong to a separate realm, so `instanceof Error`
      // can't be trusted here — duck-type on `.message` instead.
      const message = typeof (error as { message?: unknown })?.message === 'string'
        ? (error as { message: string }).message
        : String(error);
      return {
        ok: false,
        error: `Install hook "${hook.id}" failed: ${message}`,
        details: logs.length > 0 ? logs : undefined,
      };
    }
  }

  invalidateBaseInfoOptionsCache();

  return { ok: true, executed, logs };
}
