import type { AppBootResponse } from '../../../shared/api/contracts/boot/types';
import { getPlatformRuntimeConfig } from '../platform/platformRuntimeConfig.service';
import { getDefaultPlatformCultureSettingsService } from '../platform/platformCultureSettings.service';
import { getDefaultPlatformWebFontsService } from '../platform/platformWebFonts.service';
import { bootstrapPlatformCultureTranslationsFromSettings } from '../platform/platformCultureTranslations.service';
import { InstallService } from '../install/install.service';
import { PwaService } from '../pwa.service';
import { FeedbackService } from '../feedback/feedback.service';
import { RouteLoadingService } from '../routeLoading/routeLoading.service';
import { getEnabledInstalledVersionsMap } from '../../domain/package-domain/installStateRepository';

export class BootService {
  constructor(private readonly settingsPath: string) {}

  async getBootPayload(): Promise<AppBootResponse> {
    const cultureService = getDefaultPlatformCultureSettingsService();
    const webFontsService = getDefaultPlatformWebFontsService();
    const feedbackService = new FeedbackService(this.settingsPath);
    const routeLoadingService = new RouteLoadingService(this.settingsPath);
    const installService = new InstallService({ settingsPath: this.settingsPath });
    const pwaService = new PwaService({ settingsPath: this.settingsPath });

    const [runtimeConfig, culturesResult, installResult, cultureTranslations, feedbackPolicy, routeLoading] =
      await Promise.all([
      getPlatformRuntimeConfig(),
      Promise.resolve(cultureService.getCultures()),
      installService.getStatus(),
      Promise.resolve(bootstrapPlatformCultureTranslationsFromSettings(this.settingsPath)),
      feedbackService.getBootPolicy(),
      Promise.resolve(routeLoadingService.getConfig()),
    ]);

    return {
      success: true,
      runtimeConfig,
      cultures: culturesResult.body,
      cultureTranslations,
      install: installResult.body,
      enabledPackages: [...getEnabledInstalledVersionsMap().keys()],
      pwa: pwaService.readConfig(),
      webFonts: webFontsService.listFonts().fonts,
      feedbackPolicy,
      routeLoading,
    };
  }
}
