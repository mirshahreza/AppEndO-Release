import path from 'path';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { readRuntimeSettings } from '../../config/settingsFile';
import { DEFAULT_SCRIPT_POLICY_TIMEOUT_MS, type ScriptPolicy, type ScriptValidationIssue } from './types';

function toPosixPath(input: string): string {
  return input.replace(/\\/g, '/');
}

function normalizeAllowedPrefixes(raw: string | undefined): string[] {
  const source = raw?.trim()
    ? raw
    : 'db/install/,db/uninstall/,db/seed/,sql/';

  return source
    .split(',')
    .map((item) => toPosixPath(item.trim()))
    .filter(Boolean)
    .map((item) => (item.endsWith('/') ? item : `${item}/`));
}

export function resolveScriptPolicy(): ScriptPolicy {
  const runtime = readRuntimeSettings();
  const timeoutRaw = Number(runtime.packageScriptPolicyTimeoutMs || DEFAULT_SCRIPT_POLICY_TIMEOUT_MS);
  const maxTimeoutMs = Number.isFinite(timeoutRaw)
    ? Math.max(300, Math.min(10_000, Math.floor(timeoutRaw)))
    : DEFAULT_SCRIPT_POLICY_TIMEOUT_MS;

  return {
    allowedPathPrefixes: normalizeAllowedPrefixes(runtime.packageScriptAllowedPathPrefixes),
    maxTimeoutMs,
  };
}

export function isSafeSqlScriptPath(scriptPath: string, policy: ScriptPolicy): boolean {
  if (!scriptPath || scriptPath.includes('\0')) return false;
  const normalized = path.posix.normalize(toPosixPath(scriptPath));
  if (!normalized || normalized === '.' || normalized === '..') return false;
  if (normalized.startsWith('../') || path.posix.isAbsolute(normalized)) return false;
  if (/^[a-zA-Z]:\//.test(normalized)) return false;
  if (!normalized.endsWith('.sql')) return false;
  return policy.allowedPathPrefixes.some((prefix) => normalized.startsWith(prefix));
}

export function collectScriptIssues(
  manifest: PackageManifest,
  policy: ScriptPolicy,
  operation: 'install' | 'uninstall',
): ScriptValidationIssue[] {
  const issues: ScriptValidationIssue[] = [];

  for (const item of manifest.capabilities.db_objects) {
    const candidates: string[] = [];
    if (operation === 'install') {
      candidates.push(item.installScript);
      if (item.seedScript) candidates.push(item.seedScript);
    } else if (item.uninstallScript) {
      candidates.push(item.uninstallScript);
    }

    for (const scriptPath of candidates) {
      if (!isSafeSqlScriptPath(scriptPath, policy)) {
        issues.push({
          scriptPath,
          reason: 'Path is not allowed by script allowlist policy.',
        });
      }
    }
  }

  return issues;
}

export function validateScriptsWithTimeout(
  manifest: PackageManifest,
  operation: 'install' | 'uninstall',
): { ok: true; policy: ScriptPolicy } | { ok: false; error: string; details: string[]; policy: ScriptPolicy } {
  const policy = resolveScriptPolicy();
  const started = Date.now();

  const issues = collectScriptIssues(manifest, policy, operation);
  if (Date.now() - started > policy.maxTimeoutMs) {
    return {
      ok: false,
      error: `Script policy validation timed out after ${policy.maxTimeoutMs}ms.`,
      details: ['Script validation timeout reached before completion.'],
      policy,
    };
  }

  if (issues.length > 0) {
    return {
      ok: false,
      error: 'Script policy validation failed for one or more script paths.',
      details: issues.map((issue) => `${issue.scriptPath}: ${issue.reason}`),
      policy,
    };
  }

  return { ok: true, policy };
}
