import {
  ensurePlatformRouteLoadingConfig,
  getPlatformRouteLoadingConfig,
  savePlatformRouteLoadingConfig,
} from '../../db/routeLoadingSettingsStore';
import type { PlatformRouteLoadingConfig } from '../../../shared/api/contracts/routeLoading/schema';
import { normalizePlatformRouteLoadingConfig } from '../../../shared/api/contracts/routeLoading/normalizers';

export class RouteLoadingService {
  constructor(private readonly settingsPath: string) {}

  getConfig(): PlatformRouteLoadingConfig {
    return ensurePlatformRouteLoadingConfig(this.settingsPath);
  }

  saveConfig(config: PlatformRouteLoadingConfig): PlatformRouteLoadingConfig {
    return savePlatformRouteLoadingConfig(this.settingsPath, normalizePlatformRouteLoadingConfig(config));
  }
}
