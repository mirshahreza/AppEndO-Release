import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { validateScriptsWithTimeout } from '../../domain/package-domain/scriptPolicy';
import type { ScriptPolicy } from '../../domain/package-domain/types';

export type ScriptValidationOutcome =
  | { ok: true; policy: ScriptPolicy }
  | { ok: false; error: string; details: string[]; policy: ScriptPolicy };

export interface PackageScriptPolicyService {
  validateForInstall(manifest: PackageManifest): ScriptValidationOutcome;
  validateForUninstall(manifest: PackageManifest): ScriptValidationOutcome;
}

export class DefaultPackageScriptPolicyService implements PackageScriptPolicyService {
  validateForInstall(manifest: PackageManifest): ScriptValidationOutcome {
    return validateScriptsWithTimeout(manifest, 'install');
  }

  validateForUninstall(manifest: PackageManifest): ScriptValidationOutcome {
    return validateScriptsWithTimeout(manifest, 'uninstall');
  }
}

export const createPackageScriptPolicyService = (): PackageScriptPolicyService =>
  new DefaultPackageScriptPolicyService();
