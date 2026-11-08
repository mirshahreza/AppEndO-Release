import type { ExperienceManifest } from '../../../shared/api/contracts/platform/experienceManifest';
import {
  enforceBuiltInPortals,
  validateExperienceManifest,
} from '../../../shared/api/contracts/platform/experienceManifest';
import type { PlatformRegistryActor } from '../../../core/platform-registry/platformRegistryAudit';
import {
  compileExperienceManifest,
  decompileExperienceManifest,
  type CompileExperienceManifestResult,
} from './compileExperienceManifest';
import { getDefaultPlatformCultureSettingsService } from './platformCultureSettings.service';

export class ExperienceManifestService {
  async getManifest(manifestId?: string): Promise<{ manifest: ExperienceManifest | null; error?: string }> {
    const cultureSettings = await getDefaultPlatformCultureSettingsService().getCultures();
    const cultureId = cultureSettings.body.defaultCultureId ?? 'us';

    const manifest = await decompileExperienceManifest({
      manifestId,
      cultureId,
    });

    return { manifest };
  }

  async compileManifest(
    actor: PlatformRegistryActor,
    raw: unknown,
  ): Promise<
    | { ok: true; manifest: ExperienceManifest; result: CompileExperienceManifestResult }
    | { ok: false; errors: string[] }
  > {
    const validation = validateExperienceManifest(raw);
    if (!validation.valid) {
      return { ok: false, errors: validation.errors };
    }

    const cultureSettings = await getDefaultPlatformCultureSettingsService().getCultures();
    const cultureId = cultureSettings.body.defaultCultureId ?? validation.manifest.cultureId;
    const authoritative = await decompileExperienceManifest({
      manifestId: validation.manifest.id,
      cultureId,
    });

    const manifest = authoritative
      ? enforceBuiltInPortals(validation.manifest, authoritative)
      : validation.manifest;

    const result = await compileExperienceManifest(manifest, actor);
    return { ok: true, manifest, result };
  }
}

let defaultExperienceManifestService: ExperienceManifestService | null = null;

export function getDefaultExperienceManifestService(): ExperienceManifestService {
  if (!defaultExperienceManifestService) {
    defaultExperienceManifestService = new ExperienceManifestService();
  }
  return defaultExperienceManifestService;
}
