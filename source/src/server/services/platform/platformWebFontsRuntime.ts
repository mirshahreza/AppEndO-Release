import { setPlatformWebFonts } from '../../../core/culture/platformWebFontRegistry';
import { SETTINGS_PATH } from '../../config/settingsFile';
import {
  bootstrapPlatformWebFontsFromSettings,
  ensureBundledWorkspaceWebFontsInSettings,
} from './platformWebFonts.service';

export function applyPlatformWebFontsRuntime(settingsPath: string = SETTINGS_PATH): void {
  ensureBundledWorkspaceWebFontsInSettings(settingsPath);
  const config = bootstrapPlatformWebFontsFromSettings(settingsPath);
  setPlatformWebFonts(config.fonts);
}
