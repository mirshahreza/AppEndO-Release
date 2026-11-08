import type { InstallStatusResponse } from '../install/types';
import type { PlatformCulturesResponse } from '../platform/cultures';
import type { PlatformCultureTranslationsBootMeta } from '../platform/cultureTranslations';
import type { PlatformRuntimeConfig } from '../platform/types';
import type { PlatformWebFontsResponse } from '../platform/webFonts';
import type { PwaSettings } from '../settings/pwa';
import type { FeedbackBootPolicy } from '../feedback/types';
import type { PlatformRouteLoadingConfig } from '../routeLoading/schema';

export type AppBootResponse = {
  success: true;
  runtimeConfig: PlatformRuntimeConfig;
  cultures: PlatformCulturesResponse;
  cultureTranslations: PlatformCultureTranslationsBootMeta;
  install: InstallStatusResponse;
  /** Enabled package ids (install-state, runtime on). */
  enabledPackages: string[];
  pwa: PwaSettings;
  webFonts: PlatformWebFontsResponse['fonts'];
  feedbackPolicy: FeedbackBootPolicy;
  routeLoading: PlatformRouteLoadingConfig;
};
