import { buildPwaWebManifest, type PwaSettings } from '../../shared/api/contracts/settings/pwa';
import { readAppPwaSettings } from './settings/appSettings.service';

export type PwaServiceDeps = {
  settingsPath: string;
};

export class PwaService {
  constructor(_deps: PwaServiceDeps) {}

  readConfig(): PwaSettings {
    return readAppPwaSettings();
  }

  buildManifest(config: PwaSettings) {
    return buildPwaWebManifest(config);
  }
}
